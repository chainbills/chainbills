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
import { chainbillsAbi } from '../../chains/abi/chainbills';
import { ChainsService } from '../../chains/chains.service';
import { createEvmPublicClient } from '../../chains/clients';
import type { EvmChainConfig } from '../../chains/types';
import { walletKey as makeWalletKey } from '../../chains/wallet-key';
import { AppConfigService } from '../../config/app-config.service';
import { enqueueOutbox } from '../../notifications/outbox.writer';
import { PrismaService } from '../../prisma/prisma.service';
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

/** Result of one tick; drives adaptive polling in the caller. */
export interface TickResult {
  /** True when any on-chain counter surfaced new work this tick. */
  didWork: boolean;
}

/**
 * Only bump `chain_cursors.last_tick_at` this often. Faster ticks (arc's 500 ms)
 * would otherwise write once per tick; the health check only needs ~minute
 * resolution, so 30 s is comfortably fresh with 60x fewer DB writes.
 */
const LAST_TICK_WRITE_INTERVAL_MS = 30_000;

/**
 * Force-flush the activity batch when it reaches this many items even if the
 * flush interval hasn't elapsed — keeps memory bounded when a chain is very
 * active. 500 items keeps the flush transaction under a few seconds.
 */
const MAX_BATCH_SIZE = 500;

/** One activity queued for the next batch flush. */
interface BatchedActivity {
  actId: `0x${string}`;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  rec: any;
}

/** Polls the Chainbills diamond's activity log and upserts indexed entities into Postgres for one EVM chain per tick. */
@Injectable()
export class EvmIndexer {
  private readonly logger = new Logger(EvmIndexer.name);
  /** Per-chain in-memory `last_tick_at` — flushed to DB every LAST_TICK_WRITE_INTERVAL_MS. */
  private readonly lastTickFlushedAt = new Map<string, number>();
  /** Per-chain in-memory activity buffer; drained by `flushChain` every INDEXER_BATCH_FLUSH_MS. */
  private readonly batches = new Map<string, BatchedActivity[]>();
  /** Per-chain timestamp of the last successful batch flush. */
  private readonly lastBatchFlushAt = new Map<string, number>();

  constructor(
    private readonly prisma: PrismaService,
    private readonly chains: ChainsService,
    private readonly config: AppConfigService
  ) {}

  /**
   * Runs one indexing tick for the given EVM chain: read counters + cursor
   * once, dispatch any new activities, hand the messaging stats + cursor to
   * the relay detector, then persist only the fields that changed. Returns
   * `didWork = true` when any counter advanced so the caller can drive
   * adaptive polling.
   */
  async tick(chain: EvmChainConfig): Promise<TickResult> {
    const client = createEvmPublicClient(chain, this.chains.getRpcUrl(chain));

    // 1. Read all counters in one RPC.
    const [chainStats, wormholeStats, cctpStats] = await (client as PublicClient).readContract({
      address: chain.diamondAddress!,
      abi: chainbillsAbi,
      functionName: 'getAllStats',
    });
    const onChainCount = BigInt(chainStats.activitiesCount);

    // 2. Read cursor once for the whole tick — hand it to the detector so
    // it doesn't do its own findUnique per stream.
    const cursor = await this.prisma.chainCursor.upsert({
      where: { chainId: chain.cbChainId },
      create: { chainId: chain.cbChainId },
      update: {},
    });
    const indexedBefore = BigInt(cursor.activitiesIndexed);
    const buffer = this.batches.get(chain.cbChainId) ?? [];
    // What we've already buffered (in memory) counts toward "already fetched"
    // even though it hasn't been flushed to DB yet — otherwise we'd re-fetch
    // the same activities on every tick until the next flush.
    const fetchedSoFar = indexedBefore + BigInt(buffer.length);
    let bufferedThisTick = 0;

    if (onChainCount > fetchedSoFar) {
      const offset = fetchedSoFar;
      const limit = BigInt(Math.min(Number(onChainCount - fetchedSoFar), PAGE_SIZE));

      this.logger.debug({ chain: chain.slug, offset, limit }, 'fetching activities into batch');

      const [ids, records] = await (client as PublicClient).readContract({
        address: chain.diamondAddress!,
        abi: chainbillsAbi,
        functionName: 'getChainActivities',
        args: [offset, limit],
      });

      for (let i = 0; i < records.length; i++) {
        buffer.push({ actId: ids[i], rec: records[i] });
        bufferedThisTick++;
      }
      this.batches.set(chain.cbChainId, buffer);
    }

    // Decide whether to flush now: interval elapsed OR buffer is at cap.
    const nowMs = Date.now();
    const lastFlush = this.lastBatchFlushAt.get(chain.cbChainId) ?? 0;
    const batchFlushMs = this.config.env.indexerBatchFlushMs;
    const shouldFlush =
      buffer.length > 0 &&
      (buffer.length >= MAX_BATCH_SIZE || nowMs - lastFlush >= batchFlushMs);

    if (shouldFlush) {
      await this.flushChain(chain, client);
    }

    // 3. Relay-trigger detection — pass the cursor we already loaded so the
    // detector doesn't do its own findUnique per stream. It returns per-stream
    // did-advance flags so we can drive adaptive polling without another read.
    let detectorAdvanced = false;
    try {
      const result = await detectRelayTriggers(
        chain,
        this.chains,
        this.prisma,
        { wormholeStats, cctpStats },
        {
          wormholeRelayed: BigInt(cursor.wormholeRelayed),
          cctpPayableUpdatesRelayed: BigInt(cursor.cctpPayableUpdatesRelayed),
          cctpPaymentsRelayed: BigInt(cursor.cctpPaymentsRelayed),
        },
        client as PublicClient
      );
      detectorAdvanced =
        result.wormholeAdvanced || result.cctpPayableUpdateAdvanced || result.cctpPaymentAdvanced;
    } catch (err) {
      this.logger.error({ chain: chain.slug, err }, 'relay trigger scan failed');
    }

    // "Did work" for adaptive polling means either we buffered fresh activities
    // this tick or the detector queued relay jobs. A flush by itself isn't
    // considered work — it's bookkeeping.
    const activitiesAdvanced = bufferedThisTick > 0;

    // 4. Only touch `last_tick_at` at most every LAST_TICK_WRITE_INTERVAL_MS
    // (or whenever we already have to write for other reasons). Skips ~59
    // out of every 60 seconds of writes on fast-poll chains.
    const now = Date.now();
    const lastFlushed = this.lastTickFlushedAt.get(chain.cbChainId) ?? 0;
    if (now - lastFlushed >= LAST_TICK_WRITE_INTERVAL_MS) {
      await this.prisma.chainCursor.update({
        where: { chainId: chain.cbChainId },
        data: { lastTickAt: new Date(now) },
      });
      this.lastTickFlushedAt.set(chain.cbChainId, now);
    }

    return { didWork: activitiesAdvanced || detectorAdvanced };
  }

  /**
   * Drains the per-chain activity buffer into a single Prisma transaction:
   * every buffered activity is processed sequentially inside the same
   * transaction, and the cursor is advanced once at the end. On any per-item
   * failure the transaction rolls back — nothing partial lands, and the
   * failed items stay in the buffer so the next flush attempts them again
   * with the on-chain state as source of truth.
   */
  private async flushChain(chain: EvmChainConfig, client: unknown): Promise<void> {
    const buffer = this.batches.get(chain.cbChainId);
    if (!buffer || buffer.length === 0) return;

    const items = [...buffer];
    this.logger.debug({ chain: chain.slug, count: items.length }, 'flushing activity batch');

    try {
      await this.prisma.$transaction(
        async (tx) => {
          for (const { actId, rec } of items) {
            await this.processActivity(tx, chain, client, actId, rec);
          }
        },
        { timeout: 60_000 }
      );
      // Success: clear buffer, mark flush time.
      this.batches.set(chain.cbChainId, []);
      this.lastBatchFlushAt.set(chain.cbChainId, Date.now());
      this.logger.log({ chain: chain.slug, flushed: items.length }, 'activity batch flushed');
    } catch (err) {
      // Buffer intact — next flush retries. If this keeps failing, the
      // on-chain cursor never advances so no data is lost.
      this.logger.error({ chain: chain.slug, err, count: items.length }, 'activity batch flush failed');
    }
  }

  /**
   * Flushes every chain's pending buffer — called from WorkerModule's
   * onApplicationShutdown so in-memory activities are persisted before exit.
   * Best-effort: a chain whose flush fails is left in the buffer, the process
   * exits anyway, and the next boot re-fetches from on-chain state.
   */
  async flushAll(): Promise<void> {
    for (const [chainId, buffer] of this.batches.entries()) {
      if (buffer.length === 0) continue;
      const chain = this.chains.enabled.find((c) => c.cbChainId === chainId);
      if (!chain || !chain.isEvm) continue;
      const client = createEvmPublicClient(chain as EvmChainConfig, this.chains.getRpcUrl(chain));
      await this.flushChain(chain as EvmChainConfig, client);
    }
  }

  private async processActivity(
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    tx: any,
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

    {
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
    }
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
