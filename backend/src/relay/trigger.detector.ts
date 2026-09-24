// ──────────────────────────────────────────────────────────────────────────────
// Chainbills Backend — Relay trigger detector
//
// Scans the diamond's event logs from cursor.relayScanBlock+1 to the latest
// block, in 9000-block chunks, to detect relay-trigger events. For each
// matching event it creates the appropriate RelayJob row (dedup via unique key).
//
// Events handled:
//   PayableUpdateBroadcasted  -> PAYABLE_UPDATE_VIA_WORMHOLE jobs (Wormhole dests)
//   SentPayableUpdateViaCctp  -> PAYABLE_UPDATE_VIA_CCTP job (one CCTP dest per event)
//   SentForeignPaymentViaCctp -> PAYMENT_VIA_CCTP job (for payableChainId dest)
//
// Invariants:
//   - Destination must be enabled, registered on the source diamond, and on
//     the same network (sameNetwork check).
//   - relayScanBlock advances after each chunk, so a crash mid-batch resumes
//     from the last safe block.
//   - createJob with skipDuplicates guards against double-creation across retries.
// ──────────────────────────────────────────────────────────────────────────────

import { Logger } from '@nestjs/common';
import { type PublicClient, parseAbi } from 'viem';
import type { EvmChainConfig } from '../chains/types';
import type { ChainsService } from '../chains/chains.service';
import type { PrismaService } from '../prisma/prisma.service';
import { sameNetwork } from '../chains/registry';
import { createJob } from './job.store';

const logger = new Logger('TriggerDetector');

const CHUNK_SIZE = 9_000n;

// Minimal event ABI fragments used only for getLogs parsing.
const RELAY_EVENTS_ABI = parseAbi([
  'event PayableUpdateBroadcasted(bytes32 indexed payableId, uint64 nonce, uint8 actionType, uint64 wormholeSequence, uint256 cctpMessagesCount)',
  'event SentPayableUpdateViaCctp(bytes32 indexed payableId, bytes32 indexed cbChainId, uint64 nonce)',
  'event SentForeignPaymentViaCctp(bytes32 indexed payableId, bytes32 indexed payableChainId, bytes32 indexed userPaymentId, uint64 paymentNonce, uint256 burnAmount, uint256 maxFee, uint32 minFinalityThreshold)',
]);

/**
 * Scans one source chain's logs for relay-trigger events and creates relay jobs.
 * Called from the indexer tick for each enabled EVM chain.
 *
 * @param chain   Source EVM chain being scanned.
 * @param chains  ChainsService for enabled+registered destination lookup.
 * @param prisma  PrismaService to read the cursor and write jobs.
 * @param client  viem public client for the source chain.
 */
export async function detectRelayTriggers(
  chain: EvmChainConfig,
  chains: ChainsService,
  prisma: PrismaService,
  client: PublicClient
): Promise<void> {
  const cursor = await prisma.chainCursor.findUnique({ where: { chainId: chain.cbChainId } });
  const fromBlock = (cursor?.relayScanBlock ?? 0n) + 1n;
  const latestBlock = await client.getBlockNumber();

  if (fromBlock > latestBlock) return;

  logger.debug({ chain: chain.slug, fromBlock, latestBlock }, 'scanning relay triggers');

  for (let chunkFrom = fromBlock; chunkFrom <= latestBlock; chunkFrom += CHUNK_SIZE) {
    const chunkTo = chunkFrom + CHUNK_SIZE - 1n < latestBlock ? chunkFrom + CHUNK_SIZE - 1n : latestBlock;

    await processChunk(chain, chains, prisma, client, chunkFrom, chunkTo);

    // Advance the cursor after each chunk so a crash mid-scan resumes cleanly.
    await prisma.chainCursor.upsert({
      where: { chainId: chain.cbChainId },
      create: { chainId: chain.cbChainId, relayScanBlock: chunkTo },
      update: { relayScanBlock: chunkTo },
    });
  }
}

async function processChunk(
  chain: EvmChainConfig,
  chains: ChainsService,
  prisma: PrismaService,
  client: PublicClient,
  fromBlock: bigint,
  toBlock: bigint
): Promise<void> {
  const address = chain.diamondAddress!;

  // Fetch all three event types in parallel to minimise RPC round trips.
  const [broadcastedLogs, cctpUpdateLogs, cctpPaymentLogs] = await Promise.all([
    client.getLogs({ address, event: RELAY_EVENTS_ABI[0], fromBlock, toBlock }),
    client.getLogs({ address, event: RELAY_EVENTS_ABI[1], fromBlock, toBlock }),
    client.getLogs({ address, event: RELAY_EVENTS_ABI[2], fromBlock, toBlock }),
  ]);

  // 1. PayableUpdateBroadcasted -> PAYABLE_UPDATE_VIA_WORMHOLE per Wormhole-enabled dest.
  for (const log of broadcastedLogs) {
    if (!log.args) continue;
    const { payableId, nonce, wormholeSequence } = log.args as {
      payableId: `0x${string}`;
      nonce: bigint;
      wormholeSequence: bigint;
    };

    if (!chain.wormholeChainId) continue; // source has no Wormhole

    // Create one job per enabled+same-network dest that has Wormhole.
    for (const dest of chains.enabled) {
      if (!dest.isEvm) continue;
      if (dest.cbChainId === chain.cbChainId) continue;
      if (!sameNetwork(chain, dest)) continue;
      if (!dest.wormholeChainId) continue;

      const txHash = log.transactionHash ?? `wormhole-seq-${chain.slug}-${wormholeSequence.toString()}`;
      const created = await createJob(prisma, {
        type: 'PAYABLE_UPDATE_VIA_WORMHOLE',
        sourceChainId: chain.cbChainId,
        destChainId: dest.cbChainId,
        txHash,
        blockNumber: log.blockNumber ?? undefined,
        eventData: {
          payableId,
          nonce: nonce.toString(),
          wormholeSequence: wormholeSequence.toString(),
        },
      });

      if (created > 0) {
        logger.log(
          { chain: chain.slug, dest: dest.slug, payableId, wormholeSequence },
          'queued PAYABLE_UPDATE_VIA_WORMHOLE'
        );
      }
    }
  }

  // 2. SentPayableUpdateViaCctp -> PAYABLE_UPDATE_VIA_CCTP for the specific cbChainId dest.
  for (const log of cctpUpdateLogs) {
    if (!log.args) continue;
    const {
      payableId,
      cbChainId: destCbChainId,
      nonce,
    } = log.args as {
      payableId: `0x${string}`;
      cbChainId: `0x${string}`;
      nonce: bigint;
    };

    const destChain = chains.enabled.find((c) => c.cbChainId === destCbChainId);
    if (!destChain || !destChain.isEvm) continue;
    if (!sameNetwork(chain, destChain)) continue;

    const txHash = log.transactionHash!;
    // Use a deterministic synthetic key when multiple SentPayableUpdateViaCctp
    // events share the same tx — append the dest cbChainId to keep them distinct.
    const dedupTxHash = `${txHash}-${destCbChainId}`;

    const created = await createJob(prisma, {
      type: 'PAYABLE_UPDATE_VIA_CCTP',
      sourceChainId: chain.cbChainId,
      destChainId: destCbChainId,
      txHash: dedupTxHash,
      blockNumber: log.blockNumber ?? undefined,
      eventData: {
        payableId,
        nonce: nonce.toString(),
        originalTxHash: txHash,
      },
    });

    if (created > 0) {
      logger.log({ chain: chain.slug, dest: destCbChainId, payableId }, 'queued PAYABLE_UPDATE_VIA_CCTP');
    }
  }

  // 3. SentForeignPaymentViaCctp -> PAYMENT_VIA_CCTP for payableChainId dest.
  for (const log of cctpPaymentLogs) {
    if (!log.args) continue;
    const {
      payableId,
      payableChainId: destCbChainId,
      userPaymentId,
      paymentNonce,
      burnAmount,
      maxFee,
      minFinalityThreshold,
    } = log.args as {
      payableId: `0x${string}`;
      payableChainId: `0x${string}`;
      userPaymentId: `0x${string}`;
      paymentNonce: bigint;
      burnAmount: bigint;
      maxFee: bigint;
      minFinalityThreshold: number;
    };

    const destChain = chains.enabled.find((c) => c.cbChainId === destCbChainId);
    if (!destChain || !destChain.isEvm) continue;
    if (!sameNetwork(chain, destChain)) continue;

    const txHash = log.transactionHash!;
    const created = await createJob(prisma, {
      type: 'PAYMENT_VIA_CCTP',
      sourceChainId: chain.cbChainId,
      destChainId: destCbChainId,
      txHash,
      blockNumber: log.blockNumber ?? undefined,
      eventData: {
        payableId,
        payableChainId: destCbChainId,
        userPaymentId,
        paymentNonce: paymentNonce.toString(),
        burnAmount: burnAmount.toString(),
        maxFee: maxFee.toString(),
        minFinalityThreshold,
      },
    });

    if (created > 0) {
      logger.log({ chain: chain.slug, dest: destCbChainId, payableId, userPaymentId }, 'queued PAYMENT_VIA_CCTP');
    }
  }
}
