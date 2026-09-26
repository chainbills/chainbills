// Chainbills Backend — Relay trigger detector
//
// Detects new outbound cross-chain messages on one EVM chain using a
// counter-vs-cursor pattern. For each stream the diamond exposes a stats
// counter and a paginated getter that returns the per-emission tuples. The
// detector reads the stats counter, compares against the caller-supplied
// cursor snapshot, and walks the getter to queue one relay job per new
// emission. No RPC log scan is involved.
//
// Cursor discipline: the caller (EvmIndexer.tick) reads chain_cursors once
// and passes the snapshot in; subdetectors advance in-memory and write ONLY
// the fields that actually moved, one row-level UPDATE per stream that
// advanced. If nothing advanced, zero writes.
//
//   Wormhole  counter: wormholeStats.publishedWormholeMessagesCount
//             cursor:  cursor.wormholeRelayed
//             getter:  getEmittedWormholeMessages(offset, limit)
//             job:     PAYABLE_UPDATE_VIA_WORMHOLE per eligible dest
//
//   CCTP upd  counter: cctpStats.emittedCctpPayableUpdateMessagesCount
//             cursor:  cursor.cctpPayableUpdatesRelayed
//             getter:  getEmittedCctpPayableUpdateMessages(offset, limit)
//             job:     PAYABLE_UPDATE_VIA_CCTP targeted at emission.destChainId
//
//   CCTP pay  counter: cctpStats.emittedCctpPaymentMessagesCount
//             cursor:  cursor.cctpPaymentsRelayed
//             getter:  getEmittedCctpPaymentMessages(offset, limit)
//             job:     PAYMENT_VIA_CCTP targeted at emission.destChainId

import { Logger } from '@nestjs/common';
import type { PublicClient } from 'viem';
import { chainbillsAbi } from '../chains/abi/chainbills';
import type { EvmChainConfig } from '../chains/types';
import type { ChainsService } from '../chains/chains.service';
import type { PrismaService } from '../prisma/prisma.service';
import { sameNetwork } from '../chains/registry';
import { createJob } from './job.store';

const logger = new Logger('TriggerDetector');

/** Messaging counters passed in from the indexer (result of `getAllStats()`). */
export interface MessagingStats {
  wormholeStats: { publishedWormholeMessagesCount: bigint | number };
  cctpStats: {
    emittedCctpPaymentMessagesCount: bigint | number;
    emittedCctpPayableUpdateMessagesCount: bigint | number;
  };
}

/** Cursor snapshot the indexer already read once at the top of the tick. */
export interface CursorSnapshot {
  wormholeRelayed: bigint;
  cctpPayableUpdatesRelayed: bigint;
  cctpPaymentsRelayed: bigint;
}

/** How many `did-advance` diffs to report back for adaptive polling. */
export interface DetectorResult {
  wormholeAdvanced: boolean;
  cctpPayableUpdateAdvanced: boolean;
  cctpPaymentAdvanced: boolean;
}

/** How many emissions to fetch per getter call. */
const PAGE_SIZE = 50;

/**
 * Runs all three subdetectors for one chain. `cursor` is a snapshot from the
 * indexer's single tick-scoped read; each subdetector reads it, walks the
 * getter, queues jobs, and — only when it advanced — writes a targeted
 * one-field UPDATE. Returns per-stream advance flags so the caller can drive
 * adaptive polling.
 */
export async function detectRelayTriggers(
  chain: EvmChainConfig,
  chains: ChainsService,
  prisma: PrismaService,
  stats: MessagingStats,
  cursor: CursorSnapshot,
  client: PublicClient
): Promise<DetectorResult> {
  const wormholeAdvanced = await detectWormholeTriggers(chain, chains, prisma, stats, cursor.wormholeRelayed, client);
  const cctpPayableUpdateAdvanced = await detectCctpPayableUpdateTriggers(
    chain,
    chains,
    prisma,
    stats,
    cursor.cctpPayableUpdatesRelayed,
    client
  );
  const cctpPaymentAdvanced = await detectCctpPaymentTriggers(
    chain,
    chains,
    prisma,
    stats,
    cursor.cctpPaymentsRelayed,
    client
  );
  return { wormholeAdvanced, cctpPayableUpdateAdvanced, cctpPaymentAdvanced };
}

// ─── Wormhole ─────────────────────────────────────────────────────────────────

/**
 * Walks `emittedWormholeMessages` from `wormholeRelayed` and queues one
 * PAYABLE_UPDATE_VIA_WORMHOLE job per eligible destination. Writes the
 * advanced cursor position once per page consumed.
 * @returns true when the cursor advanced.
 */
async function detectWormholeTriggers(
  chain: EvmChainConfig,
  chains: ChainsService,
  prisma: PrismaService,
  stats: MessagingStats,
  startCursor: bigint,
  client: PublicClient
): Promise<boolean> {
  if (!chain.wormholeChainId) return false;

  const publishedCount = BigInt(stats.wormholeStats.publishedWormholeMessagesCount);
  if (publishedCount <= startCursor) return false;

  let wormholeRelayed = startCursor;
  logger.debug(
    { chain: chain.slug, from: wormholeRelayed.toString(), count: publishedCount.toString() },
    'new Wormhole messages'
  );

  while (wormholeRelayed < publishedCount) {
    const remaining = publishedCount - wormholeRelayed;
    const pageLimit = remaining < BigInt(PAGE_SIZE) ? Number(remaining) : PAGE_SIZE;

    const page = (await client.readContract({
      address: chain.diamondAddress!,
      abi: chainbillsAbi,
      functionName: 'getEmittedWormholeMessages',
      args: [wormholeRelayed, BigInt(pageLimit)],
    })) as readonly {
      payableId: `0x${string}`;
      chainbillsNonce: bigint;
      wormholeSequence: bigint;
    }[];

    if (page.length === 0) break;

    for (const emission of page) {
      try {
        await queueWormholeJob(chain, chains, prisma, emission);
      } catch (err) {
        logger.error(
          { chain: chain.slug, wormholeSequence: emission.wormholeSequence.toString(), err },
          'Wormhole relay job creation failed'
        );
        // Persist whatever progress we made before bailing.
        if (wormholeRelayed > startCursor) {
          await prisma.chainCursor.update({
            where: { chainId: chain.cbChainId },
            data: { wormholeRelayed },
          });
        }
        return wormholeRelayed > startCursor;
      }
      wormholeRelayed++;
    }

    await prisma.chainCursor.update({
      where: { chainId: chain.cbChainId },
      data: { wormholeRelayed },
    });
  }

  return wormholeRelayed > startCursor;
}

async function queueWormholeJob(
  chain: EvmChainConfig,
  chains: ChainsService,
  prisma: PrismaService,
  emission: { payableId: `0x${string}`; chainbillsNonce: bigint; wormholeSequence: bigint }
): Promise<void> {
  const syntheticKey = `wormhole-seq-${chain.slug}-${emission.wormholeSequence.toString()}`;

  for (const dest of chains.enabled) {
    if (!dest.isEvm) continue;
    if (dest.cbChainId === chain.cbChainId) continue;
    if (!sameNetwork(chain, dest)) continue;
    if (!dest.wormholeChainId) continue;

    const created = await createJob(prisma, {
      type: 'PAYABLE_UPDATE_VIA_WORMHOLE',
      sourceChainId: chain.cbChainId,
      destChainId: dest.cbChainId,
      txHash: syntheticKey,
      eventData: {
        wormholeSequence: emission.wormholeSequence.toString(),
        payableId: emission.payableId,
        chainbillsNonce: emission.chainbillsNonce.toString(),
      },
    });

    if (created > 0) {
      logger.log(
        { chain: chain.slug, dest: dest.slug, wormholeSequence: emission.wormholeSequence.toString() },
        'queued PAYABLE_UPDATE_VIA_WORMHOLE'
      );
    }
  }
}

// ─── CCTP payable-update ──────────────────────────────────────────────────────

/** Walks `emittedCctpPayableUpdates` from `startCursor` and queues one PAYABLE_UPDATE_VIA_CCTP job per emission. */
async function detectCctpPayableUpdateTriggers(
  chain: EvmChainConfig,
  chains: ChainsService,
  prisma: PrismaService,
  stats: MessagingStats,
  startCursor: bigint,
  client: PublicClient
): Promise<boolean> {
  if (chain.circleDomain === undefined) return false;

  const emittedCount = BigInt(stats.cctpStats.emittedCctpPayableUpdateMessagesCount);
  if (emittedCount <= startCursor) return false;

  let cctpRelayed = startCursor;

  while (cctpRelayed < emittedCount) {
    const remaining = emittedCount - cctpRelayed;
    const pageLimit = remaining < BigInt(PAGE_SIZE) ? Number(remaining) : PAGE_SIZE;

    const page = (await client.readContract({
      address: chain.diamondAddress!,
      abi: chainbillsAbi,
      functionName: 'getEmittedCctpPayableUpdateMessages',
      args: [cctpRelayed, BigInt(pageLimit)],
    })) as readonly {
      payableId: `0x${string}`;
      destChainId: `0x${string}`;
      chainbillsNonce: bigint;
      messageBodyHash: `0x${string}`;
    }[];

    if (page.length === 0) break;

    for (const emission of page) {
      try {
        await queueCctpPayableUpdateJob(chain, chains, prisma, cctpRelayed, emission);
      } catch (err) {
        logger.error(
          { chain: chain.slug, index: cctpRelayed.toString(), err },
          'CCTP payable-update job creation failed'
        );
        if (cctpRelayed > startCursor) {
          await prisma.chainCursor.update({
            where: { chainId: chain.cbChainId },
            data: { cctpPayableUpdatesRelayed: cctpRelayed },
          });
        }
        return cctpRelayed > startCursor;
      }
      cctpRelayed++;
    }

    await prisma.chainCursor.update({
      where: { chainId: chain.cbChainId },
      data: { cctpPayableUpdatesRelayed: cctpRelayed },
    });
  }

  return cctpRelayed > startCursor;
}

async function queueCctpPayableUpdateJob(
  chain: EvmChainConfig,
  chains: ChainsService,
  prisma: PrismaService,
  index: bigint,
  emission: {
    payableId: `0x${string}`;
    destChainId: `0x${string}`;
    chainbillsNonce: bigint;
    messageBodyHash: `0x${string}`;
  }
): Promise<void> {
  const dest = chains.enabled.find((c) => c.cbChainId === emission.destChainId);
  if (!dest || !dest.isEvm || dest.circleDomain === undefined || !sameNetwork(chain, dest)) {
    logger.debug(
      { chain: chain.slug, destChainId: emission.destChainId, index: index.toString() },
      'CCTP payable-update destination not eligible on this instance — skipping job creation'
    );
    return;
  }

  const syntheticKey = `cctp-msg-${emission.messageBodyHash}`;

  const created = await createJob(prisma, {
    type: 'PAYABLE_UPDATE_VIA_CCTP',
    sourceChainId: chain.cbChainId,
    destChainId: dest.cbChainId,
    txHash: syntheticKey,
    eventData: {
      payableId: emission.payableId,
      chainbillsNonce: emission.chainbillsNonce.toString(),
      messageBodyHash: emission.messageBodyHash,
      sourceDiamond: chain.diamondAddress,
    },
  });

  if (created > 0) {
    logger.log(
      {
        chain: chain.slug,
        dest: dest.slug,
        payableId: emission.payableId,
        messageBodyHash: emission.messageBodyHash,
      },
      'queued PAYABLE_UPDATE_VIA_CCTP'
    );
  }
}

// ─── CCTP payment ─────────────────────────────────────────────────────────────

/** Walks `emittedCctpPayments` from `startCursor` and queues one PAYMENT_VIA_CCTP job per emission. */
async function detectCctpPaymentTriggers(
  chain: EvmChainConfig,
  chains: ChainsService,
  prisma: PrismaService,
  stats: MessagingStats,
  startCursor: bigint,
  client: PublicClient
): Promise<boolean> {
  if (chain.circleDomain === undefined) return false;

  const emittedCount = BigInt(stats.cctpStats.emittedCctpPaymentMessagesCount);
  if (emittedCount <= startCursor) return false;

  let cctpPaid = startCursor;

  while (cctpPaid < emittedCount) {
    const remaining = emittedCount - cctpPaid;
    const pageLimit = remaining < BigInt(PAGE_SIZE) ? Number(remaining) : PAGE_SIZE;

    const page = (await client.readContract({
      address: chain.diamondAddress!,
      abi: chainbillsAbi,
      functionName: 'getEmittedCctpPaymentMessages',
      args: [cctpPaid, BigInt(pageLimit)],
    })) as readonly {
      payableId: `0x${string}`;
      destChainId: `0x${string}`;
      userPaymentId: `0x${string}`;
      chainbillsNonce: bigint;
      hookDataHash: `0x${string}`;
    }[];

    if (page.length === 0) break;

    for (const emission of page) {
      try {
        await queueCctpPaymentJob(chain, chains, prisma, cctpPaid, emission);
      } catch (err) {
        logger.error(
          { chain: chain.slug, index: cctpPaid.toString(), err },
          'CCTP payment job creation failed'
        );
        if (cctpPaid > startCursor) {
          await prisma.chainCursor.update({
            where: { chainId: chain.cbChainId },
            data: { cctpPaymentsRelayed: cctpPaid },
          });
        }
        return cctpPaid > startCursor;
      }
      cctpPaid++;
    }

    await prisma.chainCursor.update({
      where: { chainId: chain.cbChainId },
      data: { cctpPaymentsRelayed: cctpPaid },
    });
  }

  return cctpPaid > startCursor;
}

async function queueCctpPaymentJob(
  chain: EvmChainConfig,
  chains: ChainsService,
  prisma: PrismaService,
  index: bigint,
  emission: {
    payableId: `0x${string}`;
    destChainId: `0x${string}`;
    userPaymentId: `0x${string}`;
    chainbillsNonce: bigint;
    hookDataHash: `0x${string}`;
  }
): Promise<void> {
  const dest = chains.enabled.find((c) => c.cbChainId === emission.destChainId);
  if (!dest || !dest.isEvm || dest.circleDomain === undefined || !sameNetwork(chain, dest)) {
    logger.debug(
      { chain: chain.slug, destChainId: emission.destChainId, index: index.toString() },
      'CCTP payment destination not eligible on this instance — skipping job creation'
    );
    return;
  }

  const syntheticKey = `cctp-pay-${emission.hookDataHash}`;

  // `userPaymentId` is auto-extracted from eventData into the RelayJob column by createJob.
  const created = await createJob(prisma, {
    type: 'PAYMENT_VIA_CCTP',
    sourceChainId: chain.cbChainId,
    destChainId: dest.cbChainId,
    txHash: syntheticKey,
    eventData: {
      payableId: emission.payableId,
      userPaymentId: emission.userPaymentId,
      chainbillsNonce: emission.chainbillsNonce.toString(),
      hookDataHash: emission.hookDataHash,
      sourceDiamond: chain.diamondAddress,
    },
  });

  if (created > 0) {
    logger.log(
      {
        chain: chain.slug,
        dest: dest.slug,
        userPaymentId: emission.userPaymentId,
        hookDataHash: emission.hookDataHash,
      },
      'queued PAYMENT_VIA_CCTP'
    );
  }
}
