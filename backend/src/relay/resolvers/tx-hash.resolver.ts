// ──────────────────────────────────────────────────────────────────────────────
// Chainbills Backend — Source-tx-hash resolver
//
// Circle's Iris v2 API requires a source `transactionHash` (or CCTP nonce) to
// return a message + attestation, and Solidity cannot record its own tx hash.
// This resolver bridges the gap: for a given emission (identified by
// (chainId, destChainId, payableId or userPaymentId)), it returns the source
// tx hash that Circle needs.
//
// Resolution order:
//   1. Hint table (`RelayTxHint`) — filled in by the /relay/nudge endpoint
//      when the frontend forwards a fresh receipt. Instant, one DB read.
//   2. Timestamp-narrowed `eth_getLogs` — look up the associated entity in
//      Prisma (Payable / UserPayment) to get its on-chain `createdAt` /
//      `timestamp`, convert to an approximate block via cached avgBlockTime,
//      then getLogs on a ±BLOCK_WINDOW range filtered by topic0 (event) +
//      topic1 (payableId) + topic2 (destChainId). Returns exactly one log.
// ──────────────────────────────────────────────────────────────────────────────

import { Logger } from '@nestjs/common';
import { keccak256, numberToHex, toBytes, type PublicClient } from 'viem';
import type { EvmChainConfig } from '../../chains/types';
import type { PrismaService } from '../../prisma/prisma.service';

const logger = new Logger('TxHashResolver');

/** ± block window around the estimated emission block for the getLogs fallback. */
const BLOCK_WINDOW = 50n;

/** Cached (secondsPerBlock, deployBlockNumber, deployBlockTimestamp) per chain. */
const blockTimeCache = new Map<
  string,
  { secondsPerBlock: number; anchorBlock: bigint; anchorTimestamp: bigint }
>();

/** Event topic0 hashes — computed once, matches the on-chain event signatures. */
const TOPIC_SENT_PAYABLE_UPDATE_VIA_CCTP = keccak256(
  toBytes('SentPayableUpdateViaCctp(bytes32,bytes32,uint64)')
);
const TOPIC_SENT_FOREIGN_PAYMENT_VIA_CCTP = keccak256(
  toBytes('SentForeignPaymentViaCctp(bytes32,bytes32,bytes32,uint64,uint256,uint256,uint32)')
);

/**
 * Resolves a source tx hash for one CCTP payable-update emission.
 *
 * @param chain        Source EVM chain the emission happened on.
 * @param prisma       For hint lookup and Payable timestamp lookup.
 * @param client       Public client for eth_getLogs / block reads.
 * @param payableId    Payable that was updated (indexed topic on the event).
 * @param destChainId  Destination cbChainId (indexed topic on the event).
 * @returns            The `0x…` tx hash, or null when neither hint nor fallback
 *                     find a match (caller retries later).
 */
export async function resolveCctpPayableUpdateTxHash(
  chain: EvmChainConfig,
  prisma: PrismaService,
  client: PublicClient,
  payableId: `0x${string}`,
  destChainId: `0x${string}`
): Promise<`0x${string}` | null> {
  const hint = await prisma.relayTxHint.findFirst({
    where: { chainId: chain.cbChainId, destChainId, payableId },
    orderBy: { receivedAt: 'desc' },
    select: { txHash: true },
  });
  if (hint) return hint.txHash as `0x${string}`;

  const payable = await prisma.payable.findUnique({
    where: { id: payableId },
    select: { createdAt: true, updatedAt: true },
  });
  // Payable updates fire on create and on state changes — use the most recent timestamp we know.
  const timestamp = payable?.updatedAt ?? payable?.createdAt;
  if (!timestamp) {
    logger.debug({ payableId }, 'no payable timestamp available; cannot narrow getLogs window');
    return null;
  }

  return findLogTxHash(chain, client, TOPIC_SENT_PAYABLE_UPDATE_VIA_CCTP, [payableId, destChainId], timestamp);
}

/**
 * Resolves a source tx hash for one CCTP payment (burn) emission.
 *
 * @param chain          Source EVM chain the burn happened on.
 * @param prisma         For hint lookup and UserPayment timestamp lookup.
 * @param client         Public client for eth_getLogs / block reads.
 * @param userPaymentId  UserPayment.id (indexed topic on the event).
 * @param destChainId    Destination cbChainId (payableChainId — indexed topic).
 * @returns              The `0x…` tx hash, or null when unresolvable this tick.
 */
export async function resolveCctpPaymentTxHash(
  chain: EvmChainConfig,
  prisma: PrismaService,
  client: PublicClient,
  userPaymentId: `0x${string}`,
  destChainId: `0x${string}`
): Promise<`0x${string}` | null> {
  const hint = await prisma.relayTxHint.findFirst({
    where: { chainId: chain.cbChainId, destChainId, userPaymentId },
    orderBy: { receivedAt: 'desc' },
    select: { txHash: true },
  });
  if (hint) return hint.txHash as `0x${string}`;

  const payment = await prisma.userPayment.findUnique({
    where: { id: userPaymentId },
    select: { timestamp: true },
  });
  if (!payment) {
    logger.debug({ userPaymentId }, 'no UserPayment row yet; cannot narrow getLogs window');
    return null;
  }

  // The payment event indexes (payableId, payableChainId, userPaymentId); we filter on
  // (payableChainId=destChainId, userPaymentId) to keep the topic filter selective — the
  // returned log's transactionHash is what we want.
  return findLogTxHash(
    chain,
    client,
    TOPIC_SENT_FOREIGN_PAYMENT_VIA_CCTP,
    // Wildcards for unknown topics leave the slot as null; viem/eth_getLogs skips it.
    [null, destChainId, userPaymentId],
    payment.timestamp
  );
}

/** Raw eth_getLogs result shape — we only care about transactionHash. */
interface RawLog {
  transactionHash: `0x${string}`;
}

/**
 * Runs a targeted eth_getLogs bounded to a ±BLOCK_WINDOW range around the
 * block estimated for `emissionTimestamp`, filtered by topic0 (event
 * signature) and up to three additional topics. Uses the raw JSON-RPC via
 * `client.request` because viem's typed `getLogs` requires an ABI event and
 * we want the flexibility of null-slot topic wildcards for the payment case.
 */
async function findLogTxHash(
  chain: EvmChainConfig,
  client: PublicClient,
  topic0: `0x${string}`,
  topics: (`0x${string}` | null)[],
  emissionTimestamp: Date
): Promise<`0x${string}` | null> {
  try {
    const estimatedBlock = await estimateBlockAt(chain, client, BigInt(Math.floor(emissionTimestamp.getTime() / 1000)));
    const fromBlock = estimatedBlock > BLOCK_WINDOW ? estimatedBlock - BLOCK_WINDOW : 0n;
    const toBlock = estimatedBlock + BLOCK_WINDOW;

    const logs = (await client.request({
      method: 'eth_getLogs',
      params: [
        {
          address: chain.diamondAddress!,
          fromBlock: numberToHex(fromBlock),
          toBlock: numberToHex(toBlock),
          topics: [topic0, ...topics],
        },
      ],
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
    } as any)) as RawLog[];

    if (!logs || logs.length === 0) {
      logger.debug(
        { chain: chain.slug, fromBlock: fromBlock.toString(), toBlock: toBlock.toString(), topic0 },
        'no matching log in narrowed window'
      );
      return null;
    }

    if (logs.length > 1) {
      logger.warn(
        { chain: chain.slug, count: logs.length, topic0 },
        'multiple matching logs — using the first (should be impossible under a payableId/userPaymentId filter)'
      );
    }
    return logs[0].transactionHash;
  } catch (err) {
    logger.warn({ chain: chain.slug, topic0, err }, 'getLogs fallback failed');
    return null;
  }
}

/**
 * Converts a unix-seconds timestamp to an approximate block number using a
 * per-chain cached `secondsPerBlock` calibrated against a stable anchor
 * (block 1). The anchor + secondsPerBlock is computed once per process per
 * chain, then all subsequent lookups are pure arithmetic — no extra RPC.
 */
async function estimateBlockAt(chain: EvmChainConfig, client: PublicClient, targetTimestamp: bigint): Promise<bigint> {
  let cache = blockTimeCache.get(chain.slug);
  if (!cache) {
    const latest = await client.getBlock({ blockTag: 'latest' });
    const anchor = await client.getBlock({ blockNumber: 1n });
    const blocksSpanned = latest.number - anchor.number;
    const secondsSpanned = Number(latest.timestamp - anchor.timestamp);
    const secondsPerBlock = blocksSpanned > 0n ? secondsSpanned / Number(blocksSpanned) : 2;
    cache = { secondsPerBlock, anchorBlock: anchor.number, anchorTimestamp: anchor.timestamp };
    blockTimeCache.set(chain.slug, cache);
  }
  const secondsFromAnchor = Number(targetTimestamp - cache.anchorTimestamp);
  const blocksFromAnchor = BigInt(Math.max(0, Math.round(secondsFromAnchor / cache.secondsPerBlock)));
  return cache.anchorBlock + blocksFromAnchor;
}
