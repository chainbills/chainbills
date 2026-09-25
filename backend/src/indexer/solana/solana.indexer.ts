// ──────────────────────────────────────────────────────────────────────────────
// Chainbills Backend — Solana activity indexer
//
// Polls the Chainbills program's Stats PDA for new activities each tick and
// dispatches each ActivityRecord to the same tables as the EVM indexer:
// Payable (+ allowed tokens, balances), UserPayment, PayablePayment,
// Withdrawal, and Activity.
//
// Dispatch table (Anchor enum variant name -> action):
//   userInitialized           -> Activity row only
//   createdPayable            -> upsert Payable; Outbox PAYABLE_CREATED
//   closedPayable,
//   reopenedPayable,
//   updatedPayableAtaa,
//   updatedAutoWithdraw       -> refresh Payable
//   userPaid,
//   paidForeignPayable        -> upsert UserPayment; Outbox PAYMENT_RECEIPT
//   payableReceived,
//   foreignPaymentReceived    -> upsert PayablePayment + refresh Payable; Outbox PAYMENT_RECEIVED
//   withdrew                  -> upsert Withdrawal + refresh Payable; Outbox WITHDRAWAL_COMPLETED
//
// Invariants:
//   - One prisma.$transaction per activity: entity upserts + Activity row +
//     optional Outbox rows + cursor increment.
//   - Stop on first failure — cursor does not advance past a failed activity.
//   - lastTickAt is updated at the end of every tick.
//   - Solana host/payer addresses are base58; wallet keys are "solana:<base58>".
//   - requestedAmount and amount are the same value for Solana (the program
//     stores a single `amount` field on UserPayment and PayablePayment).
//   - PayablePayment.payer is decoded as base58 when the payer's chain is
//     Solana, and as EVM hex (last 20 bytes) when the payer's chain is EVM,
//     using the same normalisePayerBytes32 helper as the EVM indexer.
//   - Relay trigger detection (Wormhole/CCTP message scanning) only runs when
//     the chain's relayEnabled flag is true.
// ──────────────────────────────────────────────────────────────────────────────

import { Injectable, Logger } from '@nestjs/common';
import { PublicKey } from '@solana/web3.js';
import { walletKey as makeWalletKey } from '../../chains/wallet-key';
import { ChainsService } from '../../chains/chains.service';
import type { SolanaChainConfig } from '../../chains/types';
import { PrismaService } from '../../prisma/prisma.service';
import { AppConfigService } from '../../config/app-config.service';
import { enqueueOutbox } from '../../notifications/outbox.writer';
import { normalisePayerBytes32, payerWalletKey } from '../evm/payer-normalise';
import { makeConnection, makeCoder, decodeAccount } from './solana.client';
import { activityRecordPDA, statsPDA } from './solana.accounts';
import { detectSolanaRelayTriggers } from '../../relay/solana-trigger.detector';

/** Mapping from Anchor enum variant key to the Prisma ActivityType string. */
const ACTIVITY_TYPE_MAP: Record<string, string> = {
  userInitialized: 'INITIALIZED_USER',
  createdPayable: 'CREATED_PAYABLE',
  userPaid: 'USER_PAID',
  paidForeignPayable: 'USER_PAID',
  payableReceived: 'PAYABLE_RECEIVED',
  foreignPaymentReceived: 'PAYABLE_RECEIVED',
  withdrew: 'WITHDREW',
  closedPayable: 'CLOSED_PAYABLE',
  reopenedPayable: 'REOPENED_PAYABLE',
  updatedPayableAtaa: 'UPDATED_PAYABLE_ALLOWED_TOKENS_AND_AMOUNTS',
  updatedAutoWithdraw: 'UPDATED_PAYABLE_AUTO_WITHDRAW_STATUS',
};

/** Polls the Chainbills program's Stats PDA and upserts indexed entities into Postgres for one Solana chain per tick. */
@Injectable()
export class SolanaIndexer {
  private readonly logger = new Logger(SolanaIndexer.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly chains: ChainsService,
    private readonly config: AppConfigService
  ) {}

  /**
   * Runs one indexing tick for the given Solana chain. Reads the Stats PDA,
   * dispatches new activities to upserts, and updates the cursor.
   */
  async tick(chain: SolanaChainConfig): Promise<void> {
    const rpcUrl = this.chains.getRpcUrl(chain);
    const connection = makeConnection(rpcUrl);
    const coder = makeCoder();

    // Read Stats PDA to get total activity count.
    const statsAddr = statsPDA(chain.programId);
    const statsInfo = await connection.getAccountInfo(statsAddr);

    if (!statsInfo) {
      this.logger.warn({ chain: chain.slug }, 'Stats PDA not found — program not initialised yet');
      await this.updateLastTickAt(chain.cbChainId);
      return;
    }

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    let stats: Record<string, any>;
    try {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      stats = decodeAccount<Record<string, any>>(coder, 'Stats', statsInfo.data);
    } catch (e) {
      this.logger.error({ chain: chain.slug, err: e }, 'Failed to decode Stats PDA');
      await this.updateLastTickAt(chain.cbChainId);
      return;
    }

    const totalActivities = BigInt(stats.total_activities.toString());

    // Get or initialise the cursor.
    const cursor = await this.prisma.chainCursor.upsert({
      where: { chainId: chain.cbChainId },
      create: { chainId: chain.cbChainId },
      update: {},
    });
    const indexed = BigInt(cursor.activitiesIndexed.toString());

    if (totalActivities > indexed) {
      const delta = totalActivities - indexed;
      this.logger.debug({ chain: chain.slug, from: indexed, delta }, 'new Solana activities to index');

      for (let i = indexed; i < totalActivities; i++) {
        try {
          await this.processActivity(chain, connection, coder, i);
        } catch (err) {
          this.logger.error(
            { chain: chain.slug, activityIndex: i.toString(), err },
            'activity processing failed — stopping batch'
          );
          break;
        }
      }
    }

    // Relay trigger detection — only when relayEnabled.
    if (chain.relayEnabled) {
      try {
        await detectSolanaRelayTriggers(chain, this.chains, this.prisma, connection, coder, stats);
      } catch (err) {
        this.logger.error({ chain: chain.slug, err }, 'Solana relay trigger scan failed');
      }
    }

    await this.updateLastTickAt(chain.cbChainId);
  }

  private async updateLastTickAt(chainId: string): Promise<void> {
    await this.prisma.chainCursor.upsert({
      where: { chainId },
      create: { chainId, lastTickAt: new Date() },
      update: { lastTickAt: new Date() },
    });
  }

  private async processActivity(
    chain: SolanaChainConfig,
    connection: InstanceType<typeof import('@solana/web3.js').Connection>,
    coder: ReturnType<typeof makeCoder>,
    globalIndex: bigint
  ): Promise<void> {
    const actAddr = activityRecordPDA(globalIndex, chain.programId);
    const actInfo = await connection.getAccountInfo(actAddr);
    if (!actInfo) throw new Error(`ActivityRecord not found at index ${globalIndex}`);

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const act = decodeAccount<Record<string, any>>(coder, 'ActivityRecord', actInfo.data);

    // Anchor enums are objects with one key being the variant name.
    const activityTypeKey = Object.keys(act.activity_type)[0] as string;
    const entity = act.entity as PublicKey;

    // Derive a deterministic activity id: "<chainId>-<globalIndex>".
    const actId = `${chain.cbChainId}-${globalIndex.toString()}`;
    const timestamp = new Date(Number(act.created_at) * 1000);
    const maxEventAgeMs = this.config.env.emailMaxEventAgeMs;

    const actType = ACTIVITY_TYPE_MAP[activityTypeKey] ?? 'INITIALIZED_USER';

    await this.prisma.$transaction(async (tx) => {
      switch (activityTypeKey) {
        case 'userInitialized':
          // Activity row only; no entity record.
          break;

        case 'createdPayable': {
          const payableId = entity.toBase58();
          await this.upsertPayable(tx, chain, connection, coder, payableId);

          const hostWalletKey = await this.getPayableHostWalletKey(tx, payableId);
          if (hostWalletKey) {
            await enqueueOutbox(
              tx,
              'PAYABLE_CREATED',
              payableId,
              hostWalletKey,
              timestamp,
              { payableId, chainId: chain.cbChainId },
              maxEventAgeMs
            );
          }
          break;
        }

        case 'closedPayable':
        case 'reopenedPayable':
        case 'updatedPayableAtaa':
        case 'updatedAutoWithdraw': {
          const payableId = entity.toBase58();
          await this.upsertPayable(tx, chain, connection, coder, payableId);
          break;
        }

        case 'userPaid':
        case 'paidForeignPayable': {
          const paymentId = entity.toBase58();
          await this.indexUserPayment(tx, chain, connection, coder, paymentId, timestamp, maxEventAgeMs);
          break;
        }

        case 'payableReceived':
        case 'foreignPaymentReceived': {
          const paymentId = entity.toBase58();
          await this.indexPayablePayment(tx, chain, connection, coder, paymentId, timestamp, maxEventAgeMs);
          break;
        }

        case 'withdrew': {
          const withdrawalId = entity.toBase58();
          await this.indexWithdrawal(tx, chain, connection, coder, withdrawalId, timestamp, maxEventAgeMs);
          break;
        }

        default:
          this.logger.warn(
            { chain: chain.slug, activityTypeKey, globalIndex: globalIndex.toString() },
            'unknown activity type'
          );
          break;
      }

      // Write Activity row.
      await tx.activity.upsert({
        where: { id: actId },
        create: {
          id: actId,
          chainId: chain.cbChainId,
          chainCount: BigInt(act.chain_count?.toString() ?? '0'),
          userCount: BigInt(act.user_count?.toString() ?? '0'),
          payableCount: BigInt(act.payable_count?.toString() ?? '0'),
          entity: entity.toBase58(),
          type: actType as Parameters<typeof tx.activity.upsert>[0]['create']['type'],
          timestamp,
        },
        update: {},
      });

      // Advance cursor to one past this activity's global index.
      await tx.chainCursor.upsert({
        where: { chainId: chain.cbChainId },
        create: { chainId: chain.cbChainId, activitiesIndexed: globalIndex + 1n },
        update: { activitiesIndexed: globalIndex + 1n },
      });
    });
  }

  /**
   * Fetches the Payable account from Solana and upserts it in the database.
   * Replaces PayableAllowedToken and PayableBalance rows in full.
   */

  private async upsertPayable(
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    tx: any,
    chain: SolanaChainConfig,
    connection: InstanceType<typeof import('@solana/web3.js').Connection>,
    coder: ReturnType<typeof makeCoder>,
    payableId: string
  ): Promise<void> {
    const payableAddr = new PublicKey(payableId);
    const info = await connection.getAccountInfo(payableAddr);
    if (!info) throw new Error(`Payable account not found: ${payableId}`);

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const payable = decodeAccount<Record<string, any>>(coder, 'Payable', info.data);

    const host = (payable.host as PublicKey).toBase58();
    const hostKey = makeWalletKey('solana', host);
    const createdAt = new Date(Number(payable.created_at) * 1000);

    await tx.payable.upsert({
      where: { id: payableId },
      create: {
        id: payableId,
        chainId: chain.cbChainId,
        host,
        hostWalletKey: hostKey,
        chainCount: BigInt(payable.chain_count?.toString() ?? '0'),
        hostCount: BigInt(payable.host_count?.toString() ?? '0'),
        paymentsCount: BigInt(payable.payments_count?.toString() ?? '0'),
        withdrawalsCount: BigInt(payable.withdrawals_count?.toString() ?? '0'),
        isClosed: payable.is_closed ?? false,
        isAutoWithdraw: payable.is_auto_withdraw ?? false,
        createdAt,
      },
      update: {
        paymentsCount: BigInt(payable.payments_count?.toString() ?? '0'),
        withdrawalsCount: BigInt(payable.withdrawals_count?.toString() ?? '0'),
        isClosed: payable.is_closed ?? false,
        isAutoWithdraw: payable.is_auto_withdraw ?? false,
      },
    });

    // Replace allowed tokens and amounts in full.
    await tx.payableAllowedToken.deleteMany({ where: { payableId } });
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const ataas: any[] = payable.allowed_tokens_and_amounts ?? [];
    for (const ta of ataas) {
      await tx.payableAllowedToken.create({
        data: {
          payableId,
          token: (ta.token_mint as PublicKey).toBase58(),
          amount: BigInt(ta.amount?.toString() ?? '0').toString(),
        },
      });
    }

    // Replace balances in full.
    await tx.payableBalance.deleteMany({ where: { payableId } });
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const balances: any[] = payable.balances ?? [];
    for (const bal of balances) {
      await tx.payableBalance.create({
        data: {
          payableId,
          token: (bal.token_mint as PublicKey).toBase58(),
          amount: BigInt(bal.amount?.toString() ?? '0').toString(),
        },
      });
    }
  }

  /**
   * Returns the hostWalletKey for an already-upserted payable row.
   * Returns undefined when the payable row is absent (should not happen after upsertPayable).
   */
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  private async getPayableHostWalletKey(tx: any, payableId: string): Promise<string | undefined> {
    const row = await tx.payable.findUnique({ where: { id: payableId }, select: { hostWalletKey: true } });
    return row?.hostWalletKey;
  }

  private async indexUserPayment(
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    tx: any,
    chain: SolanaChainConfig,
    connection: InstanceType<typeof import('@solana/web3.js').Connection>,
    coder: ReturnType<typeof makeCoder>,
    paymentId: string,
    timestamp: Date,
    maxEventAgeMs: number
  ): Promise<void> {
    const paymentAddr = new PublicKey(paymentId);
    const info = await connection.getAccountInfo(paymentAddr);
    if (!info) throw new Error(`UserPayment not found: ${paymentId}`);

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const up = decodeAccount<Record<string, any>>(coder, 'UserPayment', info.data);

    const payableChainIdHex = '0x' + Buffer.from(up.payable_chain_id as number[]).toString('hex');

    const payer = (up.payer as PublicKey).toBase58();
    const payerKey = makeWalletKey('solana', payer);
    const amount = BigInt(up.amount?.toString() ?? '0').toString();

    await tx.userPayment.upsert({
      where: { id: paymentId },
      create: {
        id: paymentId,
        chainId: chain.cbChainId,
        payer,
        payerWalletKey: payerKey,
        payerCount: BigInt(up.payer_count?.toString() ?? '0'),
        chainCount: BigInt(up.chain_count?.toString() ?? '0'),
        payableId: (up.payable as PublicKey).toBase58(),
        payableChainId: payableChainIdHex,
        token: (up.token_mint as PublicKey).toBase58(),
        requestedAmount: amount,
        amount,
        timestamp,
      },
      update: {
        requestedAmount: amount,
        amount,
      },
    });

    await enqueueOutbox(
      tx,
      'PAYMENT_RECEIPT',
      paymentId,
      payerKey,
      timestamp,
      {
        paymentId,
        payableId: (up.payable as PublicKey).toBase58(),
        payableChainId: payableChainIdHex,
        token: (up.token_mint as PublicKey).toBase58(),
        amount,
      },
      maxEventAgeMs
    );
  }

  private async indexPayablePayment(
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    tx: any,
    chain: SolanaChainConfig,
    connection: InstanceType<typeof import('@solana/web3.js').Connection>,
    coder: ReturnType<typeof makeCoder>,
    paymentId: string,
    timestamp: Date,
    maxEventAgeMs: number
  ): Promise<void> {
    const paymentAddr = new PublicKey(paymentId);
    const info = await connection.getAccountInfo(paymentAddr);
    if (!info) throw new Error(`PayablePayment not found: ${paymentId}`);

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const pp = decodeAccount<Record<string, any>>(coder, 'PayablePayment', info.data);

    const payerChainIdHex = '0x' + Buffer.from(pp.payer_chain_id as number[]).toString('hex');
    const payerChainEntry = this.chains.byCbChainId(payerChainIdHex);

    // payer is [u8; 32] — base58 for Solana payer chains, 0x-hex (last 20 bytes) for EVM.
    const payerRaw = Buffer.from(pp.payer as number[]);
    const payerBytes32Hex = '0x' + payerRaw.toString('hex');
    const payerAddr = normalisePayerBytes32(payerBytes32Hex, payerChainEntry);
    const payerKey = payerWalletKey(payerAddr, payerChainEntry);

    const payableId = (pp.payable as PublicKey).toBase58();
    const amount = BigInt(pp.amount?.toString() ?? '0').toString();

    await tx.payablePayment.upsert({
      where: { id: paymentId },
      create: {
        id: paymentId,
        chainId: chain.cbChainId,
        payableId,
        payer: payerAddr,
        payerChainId: payerChainIdHex,
        payerWalletKey: payerKey,
        payerPaymentId: paymentId,
        chainCount: BigInt(pp.chain_count?.toString() ?? '0'),
        localChainCount: BigInt(pp.local_chain_count?.toString() ?? '0'),
        payableCount: BigInt(pp.payable_count?.toString() ?? '0'),
        token: (pp.token_mint as PublicKey).toBase58(),
        requestedAmount: amount,
        amount,
        timestamp,
      },
      update: {
        requestedAmount: amount,
        amount,
      },
    });

    // Refresh the payable view.
    await this.upsertPayable(tx, chain, connection, coder, payableId);

    // Notify host.
    const hostWalletKey = await this.getPayableHostWalletKey(tx, payableId);
    if (hostWalletKey) {
      await enqueueOutbox(
        tx,
        'PAYMENT_RECEIVED',
        paymentId,
        hostWalletKey,
        timestamp,
        {
          paymentId,
          payableId,
          token: (pp.token_mint as PublicKey).toBase58(),
          amount,
          payerChainId: payerChainIdHex,
        },
        maxEventAgeMs
      );
    }
  }

  private async indexWithdrawal(
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    tx: any,
    chain: SolanaChainConfig,
    connection: InstanceType<typeof import('@solana/web3.js').Connection>,
    coder: ReturnType<typeof makeCoder>,
    withdrawalId: string,
    timestamp: Date,
    maxEventAgeMs: number
  ): Promise<void> {
    const withdrawalAddr = new PublicKey(withdrawalId);
    const info = await connection.getAccountInfo(withdrawalAddr);
    if (!info) throw new Error(`Withdrawal not found: ${withdrawalId}`);

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const wdl = decodeAccount<Record<string, any>>(coder, 'Withdrawal', info.data);

    const host = (wdl.host as PublicKey).toBase58();
    const hostKey = makeWalletKey('solana', host);
    const payableId = (wdl.payable as PublicKey).toBase58();
    const amount = BigInt(wdl.amount?.toString() ?? '0').toString();

    await tx.withdrawal.upsert({
      where: { id: withdrawalId },
      create: {
        id: withdrawalId,
        chainId: chain.cbChainId,
        payableId,
        host,
        hostWalletKey: hostKey,
        chainCount: BigInt(wdl.chain_count?.toString() ?? '0'),
        hostCount: BigInt(wdl.host_count?.toString() ?? '0'),
        payableCount: BigInt(wdl.payable_count?.toString() ?? '0'),
        token: (wdl.token_mint as PublicKey).toBase58(),
        // Solana program stores the gross amount; fee is calculated off-chain as 2%.
        // Store amount and fee=0 — the fee field is only meaningful for EVM withdrawals.
        amount,
        fee: '0',
        timestamp,
      },
      update: {
        amount,
      },
    });

    // Refresh the payable.
    await this.upsertPayable(tx, chain, connection, coder, payableId);

    await enqueueOutbox(
      tx,
      'WITHDRAWAL_COMPLETED',
      withdrawalId,
      hostKey,
      timestamp,
      {
        withdrawalId,
        payableId,
        token: (wdl.token_mint as PublicKey).toBase58(),
        amount,
      },
      maxEventAgeMs
    );
  }
}
