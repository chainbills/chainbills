// Chainbills Backend — Relay trigger detector
//
// Detects new outbound cross-chain messages on one EVM chain using a
// counter-vs-cursor pattern:
//   Wormhole  read wormholeStats.publishedWormholeMessagesCount vs cursor.wormholeRelayed
//   CCTP upd  read cctpStats.emittedCctpPayableUpdateMessagesCount vs cursor.cctpPayableUpdatesRelayed,
//             walk the on-chain `emittedCctpPayableUpdates` array via
//             `getEmittedCctpPayableUpdateMessages(offset, limit)` to fetch per-emission tuples.
//
// For each new message a relay job is queued per eligible destination.
// PAYMENT_VIA_CCTP jobs are not created here yet — that requires the
// `burnWithPayment` path to also record per-emission storage on the diamond.

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

/** How many CCTP emissions to fetch per getter call. */
const CCTP_PAGE_SIZE = 50;

/**
 * Creates Wormhole and CCTP relay jobs for new outbound messages on one EVM
 * source chain.
 *
 * @param chain   Source EVM chain.
 * @param chains  ChainsService for destination lookup.
 * @param prisma  PrismaService for cursor reads and job writes.
 * @param stats   Messaging counters from `getAllStats()` on this chain.
 * @param client  Public client used to read the CCTP per-emission getter.
 */
export async function detectRelayTriggers(
  chain: EvmChainConfig,
  chains: ChainsService,
  prisma: PrismaService,
  stats: MessagingStats,
  client?: PublicClient
): Promise<void> {
  await detectWormholeTriggers(chain, chains, prisma, stats);
  if (client) await detectCctpPayableUpdateTriggers(chain, chains, prisma, stats, client);
}

/** Advances the Wormhole cursor and queues one PAYABLE_UPDATE_VIA_WORMHOLE job per eligible destination. */
async function detectWormholeTriggers(
  chain: EvmChainConfig,
  chains: ChainsService,
  prisma: PrismaService,
  stats: MessagingStats
): Promise<void> {
  if (!chain.wormholeChainId) return;

  const publishedCount = BigInt(stats.wormholeStats.publishedWormholeMessagesCount);

  const cursor = await prisma.chainCursor.findUnique({ where: { chainId: chain.cbChainId } });
  const wormholeRelayed = BigInt(cursor?.wormholeRelayed?.toString() ?? '0');

  if (publishedCount <= wormholeRelayed) return;

  const delta = publishedCount - wormholeRelayed;
  logger.debug({ chain: chain.slug, from: wormholeRelayed.toString(), delta: delta.toString() }, 'new Wormhole messages');

  let done = 0n;
  for (let i = 0n; i < delta; i++) {
    const sequence = wormholeRelayed + i;
    try {
      await queueWormholeJob(chain, chains, prisma, sequence);
      done++;
    } catch (err) {
      logger.error({ chain: chain.slug, sequence: sequence.toString(), err }, 'Wormhole relay job creation failed');
      break;
    }
  }

  if (done > 0n) {
    await prisma.chainCursor.update({
      where: { chainId: chain.cbChainId },
      data: { wormholeRelayed: wormholeRelayed + done },
    });
  }
}

async function queueWormholeJob(
  chain: EvmChainConfig,
  chains: ChainsService,
  prisma: PrismaService,
  sequence: bigint
): Promise<void> {
  const syntheticKey = `wormhole-seq-${chain.slug}-${sequence.toString()}`;

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
      eventData: { wormholeSequence: sequence.toString() },
    });

    if (created > 0) {
      logger.log(
        { chain: chain.slug, dest: dest.slug, sequence: sequence.toString() },
        'queued PAYABLE_UPDATE_VIA_WORMHOLE'
      );
    }
  }
}

/**
 * Walks the on-chain `emittedCctpPayableUpdates` array from the current cursor
 * position, queues a PAYABLE_UPDATE_VIA_CCTP job per emission, and advances
 * the cursor. Each job carries the (destChainId, chainbillsNonce,
 * messageBodyHash) tuple recorded by `sendPayableUpdate`; the resolver later
 * asks Circle for every message this diamond emitted to that destination and
 * matches by `keccak256(messageBody)`, so no RPC log scan is needed.
 */
async function detectCctpPayableUpdateTriggers(
  chain: EvmChainConfig,
  chains: ChainsService,
  prisma: PrismaService,
  stats: MessagingStats,
  client: PublicClient
): Promise<void> {
  if (chain.circleDomain === undefined) return;

  const emittedCount = BigInt(stats.cctpStats.emittedCctpPayableUpdateMessagesCount);
  const cursor = await prisma.chainCursor.findUnique({ where: { chainId: chain.cbChainId } });
  let cctpRelayed = BigInt(cursor?.cctpPayableUpdatesRelayed?.toString() ?? '0');

  if (emittedCount <= cctpRelayed) return;

  while (cctpRelayed < emittedCount) {
    const remaining = emittedCount - cctpRelayed;
    const pageLimit = remaining < BigInt(CCTP_PAGE_SIZE) ? Number(remaining) : CCTP_PAGE_SIZE;

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
        return;
      }
      cctpRelayed++;
    }

    await prisma.chainCursor.update({
      where: { chainId: chain.cbChainId },
      data: { cctpPayableUpdatesRelayed: cctpRelayed },
    });
  }
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
  // The destination may not be enabled on this backend instance; skip but advance the cursor either way
  // so we don't repeatedly retry a destination we can't relay to.
  if (!dest || !dest.isEvm || dest.circleDomain === undefined || !sameNetwork(chain, dest)) {
    logger.debug(
      { chain: chain.slug, destChainId: emission.destChainId, index: index.toString() },
      'CCTP payable-update destination not eligible on this instance — skipping job creation'
    );
    return;
  }

  // The synthetic key uses the message body hash so the (type, txHash, destChainId) unique index in
  // relay_jobs de-duplicates identical emissions even if the counter is scanned twice.
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
