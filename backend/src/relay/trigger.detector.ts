// Chainbills Backend — Relay trigger detector
//
// Detects new outbound Wormhole payable-update messages on one EVM chain using
// the same counter-vs-cursor pattern as the activity indexer:
//   1. Read `wormholeStats.publishedWormholeMessagesCount` from the already-
//      fetched `getChainStats()` result (no extra RPC call needed).
//   2. Compare to `cursor.wormholeRelayed`.
//   3. For each new message, queue one PAYABLE_UPDATE_VIA_WORMHOLE job per
//      eligible destination (same network, Wormhole-capable).
//
// CCTP relay job creation (PAYABLE_UPDATE_VIA_CCTP, PAYMENT_VIA_CCTP) requires
// the EVM diamond to expose emitted CCTP message nonces by index via getter
// functions analogous to `getChainActivities`. Add
// `getEmittedCctpPaymentMessages(offset, limit)` and
// `getEmittedCctpPayableUpdateMessages(offset, limit)` to the diamond, then
// wire them here using the same counter-vs-cursor pattern.

import { Logger } from '@nestjs/common';
import type { EvmChainConfig } from '../chains/types';
import type { ChainsService } from '../chains/chains.service';
import type { PrismaService } from '../prisma/prisma.service';
import { sameNetwork } from '../chains/registry';
import { createJob } from './job.store';

const logger = new Logger('TriggerDetector');

/**
 * Creates Wormhole relay jobs for new outbound payable-update messages on one
 * EVM source chain.
 *
 * @param chain   Source EVM chain.
 * @param chains  ChainsService for destination lookup.
 * @param prisma  PrismaService for cursor reads and job writes.
 * @param stats   Already-fetched result of `getChainStats()` for this chain.
 */
export async function detectRelayTriggers(
  chain: EvmChainConfig,
  chains: ChainsService,
  prisma: PrismaService,
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  stats: any
): Promise<void> {
  if (!chain.wormholeChainId) return;

  const publishedCount = BigInt(stats?.wormholeStats?.publishedWormholeMessagesCount ?? 0);

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
