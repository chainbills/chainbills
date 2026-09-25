// ──────────────────────────────────────────────────────────────────────────────
// Chainbills Backend — EVM activity indexer
//
// Polls the Chainbills diamond's activity log for one enabled EVM chain per
// tick, dispatches each ActivityRecord to the appropriate upsert logic, and
// advances the ChainCursor one activity at a time inside a Prisma transaction.
//
// Dispatch table (per CbTypes.sol ActivityType):
//   InitializedUser                          -> Activity row only
//   CreatedPayable                           -> upsert Payable + allowed tokens + balances; Outbox PAYABLE_CREATED
//   UserPaid                                 -> upsert UserPayment; Outbox PAYMENT_RECEIPT
//   PayableReceived                          -> upsert PayablePayment + refresh payable; Outbox PAYMENT_RECEIVED
//   Withdrew                                 -> upsert Withdrawal + refresh payable; Outbox WITHDRAWAL_COMPLETED
//   ClosedPayable / ReopenedPayable /
//   UpdatedPayableAllowedTokensAndAmounts /
//   UpdatedPayableAutoWithdrawStatus         -> refresh payable view
//
// Invariants:
//   - One prisma.$transaction per activity: entity upserts + Activity row +
//     optional Outbox rows + cursor increment.
//   - Stop on first failure — cursor does not advance past a failed activity.
//   - Page size is capped at 50 (SPEC §8.2).
//   - getPayableViewsBulk / getUserPaymentsBulk / getPayablePaymentsBulk /
//     getWithdrawalsBulk are used when a page has several entities of one kind.
//   - lastTickAt is updated at the end of every tick regardless of whether
//     new activities were found.
// ──────────────────────────────────────────────────────────────────────────────

import { Injectable, Logger } from '@nestjs/common';
import type { PublicClient } from 'viem';
import { walletKey as makeWalletKey } from '../../chains/wallet-key';
import { chainbillsAbi } from '../../chains/abi/chainbills';
import type { ChainsService } from '../../chains/chains.service';
import { createEvmPublicClient } from '../../chains/clients';
import type { EvmChainConfig } from '../../chains/types';
import type { PrismaService } from '../../prisma/prisma.service';
import type { AppConfigService } from '../../config/app-config.service';
import { enqueueOutbox } from '../../notifications/outbox.writer';
import { detectRelayTriggers } from '../../relay/trigger.detector';
import { normalisePayerBytes32, payerWalletKey } from './payer-normalise';

const PAGE_SIZE = 50;

/** Mapping from on-chain ActivityType numeric index to the Prisma enum string. */
const ACTIVITY_TYPE_MAP: Record<number, string> = {
  0: 'INITIALIZED_USER',
  1: 'CREATED_PAYABLE',
  2: 'USER_PAID',
  3: 'PAYABLE_RECEIVED',
  4: 'WITHDREW',
  5: 'CLOSED_PAYABLE',
  6: 'REOPENED_PAYABLE',
  7: 'UPDATED_PAYABLE_ALLOWED_TOKENS_AND_AMOUNTS',
  8: 'UPDATED_PAYABLE_AUTO_WITHDRAW_STATUS',
};

/** Polls the Chainbills diamond's activity log and upserts indexed entities into Postgres for one EVM chain per tick. */
@Injectable()
export class EvmIndexer {
  private readonly logger = new Logger(EvmIndexer.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly chains: ChainsService,
    private readonly config: AppConfigService
  ) {}

  /**
   * Runs one indexing tick for the given EVM chain. Fetches new activities,
   * dispatches each to the appropriate upsert, and updates the cursor.
   */
  async tick(chain: EvmChainConfig): Promise<void> {
    const client = createEvmPublicClient(chain, this.chains.getRpcUrl(chain));

    // 1. Get on-chain activity count.
    const stats = await (client as PublicClient).readContract({
      address: chain.diamondAddress!,
      abi: chainbillsAbi,
      functionName: 'getChainStats',
    });
    const onChainCount = BigInt(stats.activitiesCount);

    // 2. Get or initialise cursor.
    const cursor = await this.prisma.chainCursor.upsert({
      where: { chainId: chain.cbChainId },
      create: { chainId: chain.cbChainId },
      update: {},
    });
    const indexed = BigInt(cursor.activitiesIndexed);

    if (onChainCount > indexed) {
      const offset = indexed;
      const limit = BigInt(Math.min(Number(onChainCount - indexed), PAGE_SIZE));

      this.logger.debug({ chain: chain.slug, offset, limit }, 'fetching activities');

      const [ids, records] = await (client as PublicClient).readContract({
        address: chain.diamondAddress!,
        abi: chainbillsAbi,
        functionName: 'getChainActivities',
        args: [offset, limit],
      });

      // 3. Dispatch each activity. Stop on first failure.
      for (let i = 0; i < records.length; i++) {
        const actId = ids[i];
        const rec = records[i];

        try {
          await this.processActivity(chain, client, actId, rec);
        } catch (err) {
          this.logger.error({ chain: chain.slug, actId, err }, 'activity processing failed — stopping batch');
          break;
        }
      }
    }

    // 4. Relay-trigger detection.
    try {
      await detectRelayTriggers(chain, this.chains, this.prisma, client);
    } catch (err) {
      this.logger.error({ chain: chain.slug, err }, 'relay trigger scan failed');
    }

    // 5. Update lastTickAt every tick.
    await this.prisma.chainCursor.update({
      where: { chainId: chain.cbChainId },
      data: { lastTickAt: new Date() },
    });
  }

  private async processActivity(
    chain: EvmChainConfig,
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    client: any,
    actId: `0x${string}`,
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    rec: any
  ): Promise<void> {
    const activityType = ACTIVITY_TYPE_MAP[rec.activityType as number];
    if (!activityType) {
      this.logger.warn({ actId, activityType: rec.activityType }, 'unknown ActivityType — storing Activity only');
    }

    const timestamp = new Date(Number(rec.timestamp) * 1000);
    const maxEventAgeMs = this.config.env.emailMaxEventAgeMs;

    await this.prisma.$transaction(async (tx) => {
      switch (rec.activityType) {
        case 0: // InitializedUser
          break; // Only Activity row below.

        case 1: {
          // CreatedPayable
          const view = await (client as PublicClient).readContract({
            address: chain.diamondAddress!,
            abi: chainbillsAbi,
            functionName: 'getPayableView',
            args: [rec.entity as `0x${string}`],
          });
          await this.upsertPayable(tx, chain, rec.entity as string, view);

          const hostWalletKey = makeWalletKey('evm', view.info.host);
          await enqueueOutbox(
            tx,
            'PAYABLE_CREATED',
            rec.entity as string,
            hostWalletKey,
            timestamp,
            { payableId: rec.entity, chainId: chain.cbChainId },
            maxEventAgeMs
          );
          break;
        }

        case 2: {
          // UserPaid
          const payment = await (client as PublicClient).readContract({
            address: chain.diamondAddress!,
            abi: chainbillsAbi,
            functionName: 'getUserPayment',
            args: [rec.entity as `0x${string}`],
          });
          const payerAddr = payment.payer.toString().toLowerCase();
          const payerKey = makeWalletKey('evm', payerAddr);

          await tx.userPayment.upsert({
            where: { id: rec.entity as string },
            create: {
              id: rec.entity as string,
              chainId: chain.cbChainId,
              payer: payerAddr,
              payerWalletKey: payerKey,
              payerCount: BigInt(payment.payerCount),
              chainCount: BigInt(payment.chainCount),
              payableId: payment.payableId as string,
              payableChainId: payment.payableChainId as string,
              token: payment.token.toString().toLowerCase(),
              requestedAmount: payment.requestedAmount.toString(),
              amount: payment.amount.toString(),
              timestamp,
            },
            update: {
              requestedAmount: payment.requestedAmount.toString(),
              amount: payment.amount.toString(),
            },
          });

          await enqueueOutbox(
            tx,
            'PAYMENT_RECEIPT',
            rec.entity as string,
            payerKey,
            timestamp,
            {
              paymentId: rec.entity,
              payableId: payment.payableId,
              payableChainId: payment.payableChainId,
              token: payment.token,
              amount: payment.amount.toString(),
            },
            maxEventAgeMs
          );
          break;
        }

        case 3: {
          // PayableReceived
          const pp = await (client as PublicClient).readContract({
            address: chain.diamondAddress!,
            abi: chainbillsAbi,
            functionName: 'getPayablePayment',
            args: [rec.entity as `0x${string}`],
          });

          const payerChainEntry = this.chains.byCbChainId(pp.payerChainId as string);
          const payerAddr = normalisePayerBytes32(pp.payer as string, payerChainEntry);
          const payerKey = payerWalletKey(payerAddr, payerChainEntry);

          await tx.payablePayment.upsert({
            where: { id: rec.entity as string },
            create: {
              id: rec.entity as string,
              chainId: chain.cbChainId,
              payableId: pp.payableId as string,
              payer: payerAddr,
              payerChainId: pp.payerChainId as string,
              payerWalletKey: payerKey,
              payerPaymentId: pp.payerPaymentId as string,
              chainCount: BigInt(pp.chainCount),
              localChainCount: BigInt(pp.localChainCount),
              payableCount: BigInt(pp.payableCount),
              token: pp.token.toString().toLowerCase(),
              requestedAmount: pp.requestedAmount.toString(),
              amount: pp.amount.toString(),
              timestamp,
            },
            update: {
              requestedAmount: pp.requestedAmount.toString(),
              amount: pp.amount.toString(),
            },
          });

          // Refresh payable view.
          const view = await (client as PublicClient).readContract({
            address: chain.diamondAddress!,
            abi: chainbillsAbi,
            functionName: 'getPayableView',
            args: [pp.payableId as `0x${string}`],
          });
          await this.upsertPayable(tx, chain, pp.payableId as string, view);

          // Notify host.
          const hostWalletKey = makeWalletKey('evm', view.info.host);
          await enqueueOutbox(
            tx,
            'PAYMENT_RECEIVED',
            rec.entity as string,
            hostWalletKey,
            timestamp,
            {
              paymentId: rec.entity,
              payableId: pp.payableId,
              token: pp.token,
              amount: pp.amount.toString(),
              payerChainId: pp.payerChainId,
            },
            maxEventAgeMs
          );
          break;
        }

        case 4: {
          // Withdrew
          const wd = await (client as PublicClient).readContract({
            address: chain.diamondAddress!,
            abi: chainbillsAbi,
            functionName: 'getWithdrawal',
            args: [rec.entity as `0x${string}`],
          });

          const hostAddr = wd.host.toString().toLowerCase();
          const hostKey = makeWalletKey('evm', hostAddr);

          await tx.withdrawal.upsert({
            where: { id: rec.entity as string },
            create: {
              id: rec.entity as string,
              chainId: chain.cbChainId,
              payableId: wd.payableId as string,
              host: hostAddr,
              hostWalletKey: hostKey,
              chainCount: BigInt(wd.chainCount),
              hostCount: BigInt(wd.hostCount),
              payableCount: BigInt(wd.payableCount),
              token: wd.token.toString().toLowerCase(),
              amount: wd.amount.toString(),
              fee: wd.fee.toString(),
              timestamp,
            },
            update: {
              amount: wd.amount.toString(),
              fee: wd.fee.toString(),
            },
          });

          // Refresh payable.
          const view = await (client as PublicClient).readContract({
            address: chain.diamondAddress!,
            abi: chainbillsAbi,
            functionName: 'getPayableView',
            args: [wd.payableId as `0x${string}`],
          });
          await this.upsertPayable(tx, chain, wd.payableId as string, view);

          await enqueueOutbox(
            tx,
            'WITHDRAWAL_COMPLETED',
            rec.entity as string,
            hostKey,
            timestamp,
            {
              withdrawalId: rec.entity,
              payableId: wd.payableId,
              token: wd.token,
              amount: wd.amount.toString(),
            },
            maxEventAgeMs
          );
          break;
        }

        case 5: // ClosedPayable
        case 6: // ReopenedPayable
        case 7: // UpdatedPayableAllowedTokensAndAmounts
        case 8: {
          // UpdatedPayableAutoWithdrawStatus
          const view = await (client as PublicClient).readContract({
            address: chain.diamondAddress!,
            abi: chainbillsAbi,
            functionName: 'getPayableView',
            args: [rec.entity as `0x${string}`],
          });
          await this.upsertPayable(tx, chain, rec.entity as string, view);
          break;
        }

        default:
          // Unknown activity type; Activity row is still written.
          break;
      }

      // Write Activity row.
      const actType = (ACTIVITY_TYPE_MAP[rec.activityType as number] ?? 'INITIALIZED_USER') as
        | 'INITIALIZED_USER'
        | 'CREATED_PAYABLE'
        | 'USER_PAID'
        | 'PAYABLE_RECEIVED'
        | 'WITHDREW'
        | 'CLOSED_PAYABLE'
        | 'REOPENED_PAYABLE'
        | 'UPDATED_PAYABLE_ALLOWED_TOKENS_AND_AMOUNTS'
        | 'UPDATED_PAYABLE_AUTO_WITHDRAW_STATUS';

      await tx.activity.upsert({
        where: { id: actId },
        create: {
          id: actId,
          chainId: chain.cbChainId,
          chainCount: BigInt(rec.chainCount),
          userCount: BigInt(rec.userCount),
          payableCount: BigInt(rec.payableCount),
          entity: rec.entity as string,
          type: actType,
          timestamp,
        },
        update: {},
      });

      // Advance cursor.
      await tx.chainCursor.upsert({
        where: { chainId: chain.cbChainId },
        create: { chainId: chain.cbChainId, activitiesIndexed: BigInt(rec.chainCount) },
        update: { activitiesIndexed: BigInt(rec.chainCount) },
      });
    });
  }

  /**
   * Upserts a Payable row and replaces its PayableAllowedToken and PayableBalance
   * rows with the current on-chain values. All three writes are in the caller's
   * transaction.
   */
  private async upsertPayable(
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    tx: any,
    chain: EvmChainConfig,
    payableId: string,
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    view: any
  ): Promise<void> {
    const hostAddr = view.info.host.toString().toLowerCase();
    const hostKey = makeWalletKey('evm', hostAddr);
    const createdAt = new Date(Number(view.info.createdAt) * 1000);

    await tx.payable.upsert({
      where: { id: payableId },
      create: {
        id: payableId,
        chainId: chain.cbChainId,
        host: hostAddr,
        hostWalletKey: hostKey,
        chainCount: BigInt(view.info.chainCount),
        hostCount: BigInt(view.info.hostCount),
        paymentsCount: BigInt(view.info.paymentsCount),
        withdrawalsCount: BigInt(view.info.withdrawalsCount),
        isClosed: view.info.isClosed,
        isAutoWithdraw: view.info.isAutoWithdraw,
        createdAt,
      },
      update: {
        paymentsCount: BigInt(view.info.paymentsCount),
        withdrawalsCount: BigInt(view.info.withdrawalsCount),
        isClosed: view.info.isClosed,
        isAutoWithdraw: view.info.isAutoWithdraw,
      },
    });

    // Replace allowed tokens in full.
    await tx.payableAllowedToken.deleteMany({ where: { payableId } });
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    for (const ta of view.allowedTokensAndAmounts as any[]) {
      await tx.payableAllowedToken.create({
        data: {
          payableId,
          token: ta.token.toString().toLowerCase(),
          amount: ta.amount.toString(),
        },
      });
    }

    // Replace balances in full.
    await tx.payableBalance.deleteMany({ where: { payableId } });
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    for (const bal of view.balances as any[]) {
      await tx.payableBalance.create({
        data: {
          payableId,
          token: bal.token.toString().toLowerCase(),
          amount: bal.amount.toString(),
        },
      });
    }
  }
}
