// ──────────────────────────────────────────────────────────────────────────────
// Chainbills Relayer — Count-Based Chain Poller
//
// Design: contract-stats counters as cursors, minimal getLogs scanning.
// ──────────────────────────────────────────────────────────────────────────────
// Each poll tick:
//   1. Calls getChainStats() — one RPC call for indexing counts.
//   2. Compares each count against in-memory cursor; fetches new IDs.
//   3. Persists updated cursor to Firestore only when something advanced.
//
// Relay sections (separate from indexing):
//   5. Wormhole payable update relay — publishedWormholeMessagesCount cursor.
//   6. CCTP payment relay — emittedCctpPaymentMessagesCount cursor.
//      Scans UserPaid logs from deploymentBlock on each new tick (dedup safe).
//   7. CCTP payable update relay — emittedCctpPayableUpdateMessagesCount cursor.
//      Scans PayableUpdateBroadcasted logs from deploymentBlock on each new tick.
// ──────────────────────────────────────────────────────────────────────────────

import { type PublicClient, parseAbiItem } from 'viem';
import type { ChainConfig } from './chains.js';
import { ALL_CHAINS, chainByCbChainId } from './chains.js';
import { indexPayable, indexPayablePayment, indexUserPayment, indexWithdrawal } from './indexer.js';
import { createJob, jobExistsForTx } from './jobs/store.js';
import { notifyPaymentReceived } from './notify/host.js';
import { gettersAbi } from './utils/abis.js';
import { makePublicClient } from './utils/clients.js';
import { db } from './utils/firebase.js';
import { chainLogger } from './utils/logger.js';
import { resolveToken } from './utils/tokens.js';

// ── Event ABI fragments (only for targeted single-item getLogs calls) ──────────

const USER_PAID_EVENT = parseAbiItem(
  'event UserPaid(bytes32 indexed payableId, address indexed payerWallet, bytes32 indexed paymentId, bytes32 payableChainId, uint256 chainCount, uint256 payerCount)'
);
const PAYABLE_UPDATE_BROADCASTED_EVENT = parseAbiItem(
  'event PayableUpdateBroadcasted(bytes32 indexed payableId, uint64 nonce, uint8 actionType)'
);

// ── Cursor ────────────────────────────────────────────────────────────────────

interface ChainCursor {
  payablesIndexed: number;
  userPaymentsIndexed: number;
  payablePaymentsIndexed: number;
  withdrawalsIndexed: number;
  /** publishedWormholeMessagesCount high-watermark (Wormhole chains only). */
  wormholeRelayed: number;
  /** emittedCctpPaymentMessagesCount high-watermark (CCTP chains only). */
  cctpPaymentsRelayed: number;
  /** emittedCctpPayableUpdateMessagesCount high-watermark (CCTP chains only). */
  cctpPayableUpdatesRelayed: number;
}

const ZERO_CURSOR: ChainCursor = {
  payablesIndexed: 0,
  userPaymentsIndexed: 0,
  payablePaymentsIndexed: 0,
  withdrawalsIndexed: 0,
  wormholeRelayed: 0,
  cctpPaymentsRelayed: 0,
  cctpPayableUpdatesRelayed: 0,
};

// In-memory cursors: loaded from Firestore once at startup, never read again.
const memoryCursors = new Map<string, ChainCursor>();

async function loadCursor(chainName: string): Promise<ChainCursor> {
  const snap = await db.doc(`relayerCursors/${chainName}`).get();
  if (!snap.exists) return { ...ZERO_CURSOR };
  const d = snap.data()!;
  return {
    payablesIndexed: d.payablesIndexed ?? 0,
    userPaymentsIndexed: d.userPaymentsIndexed ?? 0,
    payablePaymentsIndexed: d.payablePaymentsIndexed ?? 0,
    withdrawalsIndexed: d.withdrawalsIndexed ?? 0,
    wormholeRelayed: d.wormholeRelayed ?? 0,
    cctpPaymentsRelayed: d.cctpPaymentsRelayed ?? 0,
    cctpPayableUpdatesRelayed: d.cctpPayableUpdatesRelayed ?? 0,
  };
}

async function saveCursor(chainName: string, cursor: ChainCursor): Promise<void> {
  await db.doc(`relayerCursors/${chainName}`).set(
    {
      payablesIndexed: cursor.payablesIndexed,
      userPaymentsIndexed: cursor.userPaymentsIndexed,
      payablePaymentsIndexed: cursor.payablePaymentsIndexed,
      withdrawalsIndexed: cursor.withdrawalsIndexed,
      wormholeRelayed: cursor.wormholeRelayed,
      cctpPaymentsRelayed: cursor.cctpPaymentsRelayed,
      cctpPayableUpdatesRelayed: cursor.cctpPayableUpdatesRelayed,
      updatedAt: new Date().toISOString(),
    },
    { merge: true }
  );
}

// ── Main watcher ──────────────────────────────────────────────────────────────

/**
 * Starts a polling loop for one chain. Runs indefinitely; errors are logged
 * and retried on the next tick — the process never crashes from a single error.
 */
export async function startChainWatcher(chain: ChainConfig): Promise<void> {
  const log = chainLogger(chain.name);
  const client = makePublicClient(chain) as PublicClient;

  // Load cursor once at startup — never read Firestore again during steady state.
  const cursor = await loadCursor(chain.name);
  memoryCursors.set(chain.name, cursor);

  const pollMs = chain.pollIntervalMs ?? 12_000;
  log.info(
    {
      payablesIndexed: cursor.payablesIndexed,
      userPaymentsIndexed: cursor.userPaymentsIndexed,
      payablePaymentsIndexed: cursor.payablePaymentsIndexed,
      withdrawalsIndexed: cursor.withdrawalsIndexed,
      wormholeRelayed: cursor.wormholeRelayed,
    },
    `Starting count-based watcher (poll every ${pollMs}ms)`
  );

  while (true) {
    try {
      await pollChain(chain, client, log);
    } catch (err) {
      log.error({ err: sanitizeErr(err) }, 'Watcher tick error — will retry next poll');
    }
    await sleep(pollMs);
  }
}

// ── Poll tick ─────────────────────────────────────────────────────────────────

async function pollChain(chain: ChainConfig, client: PublicClient, log: ReturnType<typeof chainLogger>): Promise<void> {
  const cursor = memoryCursors.get(chain.name)!;

  // One RPC call gets all chain-level counts.
  const chainStats = await client.readContract({
    address: chain.gettersAddress,
    abi: gettersAbi,
    functionName: 'getChainStats',
  });

  let changed = false;

  // ── 1. Payables ─────────────────────────────────────────────────────────────
  const onChainPayables = Number(chainStats.payablesCount);
  if (onChainPayables > cursor.payablesIndexed) {
    const delta = onChainPayables - cursor.payablesIndexed;
    log.info({ from: cursor.payablesIndexed, delta }, 'New payables detected');
    const ids = await client.readContract({
      address: chain.gettersAddress,
      abi: gettersAbi,
      functionName: 'chainPayableIdsPaginated',
      args: [BigInt(cursor.payablesIndexed), BigInt(delta)],
    });
    let done = 0;
    for (const id of ids) {
      try {
        await indexPayable(chain, id);
        done++;
      } catch (e) {
        log.error({ payableId: id, err: sanitizeErr(e) }, 'indexPayable failed — stopping batch, will retry next tick');
        break;
      }
    }
    if (done > 0) {
      cursor.payablesIndexed += done;
      changed = true;
    }
  }

  // ── 2. User payments — index only ─────────────────────────────────────────
  const onChainUserPayments = Number(chainStats.userPaymentsCount);
  if (onChainUserPayments > cursor.userPaymentsIndexed) {
    const delta = onChainUserPayments - cursor.userPaymentsIndexed;
    log.info({ from: cursor.userPaymentsIndexed, delta }, 'New user payments detected');
    const ids = await client.readContract({
      address: chain.gettersAddress,
      abi: gettersAbi,
      functionName: 'chainUserPaymentIdsPaginated',
      args: [BigInt(cursor.userPaymentsIndexed), BigInt(delta)],
    });
    let done = 0;
    for (const id of ids) {
      try {
        await indexUserPayment(chain, id);
        done++;
      } catch (e) {
        log.error(
          { paymentId: id, err: sanitizeErr(e) },
          'userPayment processing failed — stopping batch, will retry next tick'
        );
        break;
      }
    }
    if (done > 0) {
      cursor.userPaymentsIndexed += done;
      changed = true;
    }
  }

  // ── 3. Payable payments — index + notify host ──────────────────────────────
  const onChainPayablePayments = Number(chainStats.payablePaymentsCount);
  if (onChainPayablePayments > cursor.payablePaymentsIndexed) {
    const delta = onChainPayablePayments - cursor.payablePaymentsIndexed;
    log.info({ from: cursor.payablePaymentsIndexed, delta }, 'New payable payments detected');
    const ids = await client.readContract({
      address: chain.gettersAddress,
      abi: gettersAbi,
      functionName: 'chainPayablePaymentIdsPaginated',
      args: [BigInt(cursor.payablePaymentsIndexed), BigInt(delta)],
    });
    let done = 0;
    for (const id of ids) {
      try {
        await indexPayablePayment(chain, id);
        const raw = await client.readContract({
          address: chain.gettersAddress,
          abi: gettersAbi,
          functionName: 'getPayablePayment',
          args: [id],
        });
        const { name: tokenName, decimals } = resolveToken(raw.token, chain.name);
        await notifyPaymentReceived(raw.payableId, id, tokenName, Number(raw.amount) / 10 ** decimals);
        done++;
      } catch (e) {
        log.error(
          { paymentId: id, err: sanitizeErr(e) },
          'payablePayment processing failed — stopping batch, will retry next tick'
        );
        break;
      }
    }
    if (done > 0) {
      cursor.payablePaymentsIndexed += done;
      changed = true;
    }
  }

  // ── 4. Withdrawals ───────────────────────────────────────────────────────────
  const onChainWithdrawals = Number(chainStats.withdrawalsCount);
  if (onChainWithdrawals > cursor.withdrawalsIndexed) {
    const delta = onChainWithdrawals - cursor.withdrawalsIndexed;
    log.info({ from: cursor.withdrawalsIndexed, delta }, 'New withdrawals detected');
    const ids = await client.readContract({
      address: chain.gettersAddress,
      abi: gettersAbi,
      functionName: 'chainWithdrawalIdsPaginated',
      args: [BigInt(cursor.withdrawalsIndexed), BigInt(delta)],
    });
    let done = 0;
    for (const id of ids) {
      try {
        await indexWithdrawal(chain, id);
        done++;
      } catch (e) {
        log.error(
          { withdrawalId: id, err: sanitizeErr(e) },
          'indexWithdrawal failed — stopping batch, will retry next tick'
        );
        break;
      }
    }
    if (done > 0) {
      cursor.withdrawalsIndexed += done;
      changed = true;
    }
  }

  // ── 5. Wormhole payable update relay — sequence-based (Wormhole chains) ────
  if (chain.hasWormhole) {
    const wormholeStats = await client.readContract({
      address: chain.gettersAddress,
      abi: gettersAbi,
      functionName: 'getWormholeStats',
    });
    const onChainWormhole = Number(wormholeStats.publishedWormholeMessagesCount);
    if (onChainWormhole > cursor.wormholeRelayed) {
      const delta = onChainWormhole - cursor.wormholeRelayed;
      log.info({ from: cursor.wormholeRelayed, delta }, 'New Wormhole messages to relay');
      let done = 0;
      for (let i = 0; i < delta; i++) {
        const sequence = cursor.wormholeRelayed + i;
        try {
          await maybeQueueWormholeRelayJob(chain, sequence, log);
          done++;
        } catch (e) {
          log.error(
            { sequence, err: sanitizeErr(e) },
            'Wormhole relay job failed — stopping batch, will retry next tick'
          );
          break;
        }
      }
      if (done > 0) {
        cursor.wormholeRelayed += done;
        changed = true;
      }
    }
  }

  // ── 6 & 7. CCTP relay — payments + payable updates ────────────────────────
  if (chain.hasCctp) {
    const cctpStats = await client.readContract({
      address: chain.gettersAddress,
      abi: gettersAbi,
      functionName: 'getCctpStats',
    });

    // ── 6. CCTP payment relay ───────────────────────────────────────────────
    const onChainCctpPayments = Number(cctpStats.emittedCctpPaymentMessagesCount);
    if (onChainCctpPayments > cursor.cctpPaymentsRelayed) {
      log.info({ from: cursor.cctpPaymentsRelayed, onChain: onChainCctpPayments }, 'New CCTP payments to relay');
      const paymentLogs = await getLogsChunked(client, {
        address: chain.contractAddress,
        event: USER_PAID_EVENT,
        fromBlock: chain.deploymentBlock,
      });
      for (const plog of paymentLogs) {
        const { paymentId, payableChainId } = (plog as any).args as {
          paymentId: `0x${string}`;
          payableChainId: `0x${string}`;
        };
        if (payableChainId === chain.cbChainId) continue;
        const destChain = chainByCbChainId.get(payableChainId);
        if (!destChain) continue;
        const txHash = plog.transactionHash!;
        const alreadyQueued = await jobExistsForTx(txHash, destChain.name);
        if (alreadyQueued) continue;
        const jobType =
          chain.hasWormhole && destChain.hasWormhole ? 'PAYMENT_VIA_CCTP_WORMHOLE' : 'PAYMENT_VIA_CCTP_ONLY';
        await createJob({
          type: jobType,
          sourceChain: chain.name,
          destChain: destChain.name,
          txHash,
          blockNumber: plog.blockNumber !== undefined ? Number(plog.blockNumber) : 0,
          eventData: { paymentId, payableChainId },
        });
        log.info({ paymentId, destChain: destChain.name, txHash, jobType }, 'Queued cross-chain payment relay job');
      }
      cursor.cctpPaymentsRelayed = onChainCctpPayments;
      changed = true;
    }

    // ── 7. CCTP payable update relay ────────────────────────────────────────
    const onChainCctpUpdates = Number(cctpStats.emittedCctpPayableUpdateMessagesCount);
    if (onChainCctpUpdates > cursor.cctpPayableUpdatesRelayed) {
      log.info(
        { from: cursor.cctpPayableUpdatesRelayed, onChain: onChainCctpUpdates },
        'New CCTP payable updates to relay'
      );
      const updateLogs = await getLogsChunked(client, {
        address: chain.contractAddress,
        event: PAYABLE_UPDATE_BROADCASTED_EVENT,
        fromBlock: chain.deploymentBlock,
      });
      for (const ulog of updateLogs) {
        const { payableId } = (ulog as any).args as { payableId: `0x${string}` };
        const txHash = ulog.transactionHash!;
        await maybeQueueCctpPayableUpdateJobs(chain, txHash, payableId, log);
      }
      cursor.cctpPayableUpdatesRelayed = onChainCctpUpdates;
      changed = true;
    }
  }

  // Persist only when something actually changed — avoids write amplification.
  if (changed) {
    await saveCursor(chain.name, cursor);
  }
}

// ── Wormhole payable update relay ─────────────────────────────────────────────

async function maybeQueueWormholeRelayJob(
  chain: ChainConfig,
  sequence: number,
  log: ReturnType<typeof chainLogger>
): Promise<void> {
  // Use a synthetic txHash so the dedup check works without a real transaction hash.
  const syntheticKey = `wormhole-seq-${chain.name}-${sequence}`;

  for (const destChain of ALL_CHAINS) {
    if (destChain.name === chain.name) continue;
    if (!destChain.hasWormhole) continue; // CCTP path handles non-Wormhole dest chains

    const alreadyQueued = await jobExistsForTx(syntheticKey, destChain.name);
    if (alreadyQueued) continue;

    await createJob({
      type: 'PAYABLE_UPDATE_VIA_WORMHOLE',
      sourceChain: chain.name,
      destChain: destChain.name,
      txHash: syntheticKey,
      blockNumber: 0,
      eventData: { sequence: String(sequence) },
    });
    log.info({ sequence, destChain: destChain.name }, 'Queued PAYABLE_UPDATE_VIA_WORMHOLE job');
  }
}

// ── CCTP payable update relay ─────────────────────────────────────────────────

async function maybeQueueCctpPayableUpdateJobs(
  chain: ChainConfig,
  txHash: string,
  payableId: string,
  log: ReturnType<typeof chainLogger>
): Promise<void> {
  for (const destChain of ALL_CHAINS) {
    if (destChain.name === chain.name) continue;
    if (!destChain.hasCctp) continue; // dest needs CCTP to receive payable updates via Circle

    const alreadyQueued = await jobExistsForTx(txHash, destChain.name);
    if (alreadyQueued) continue;

    await createJob({
      type: 'PAYABLE_UPDATE_VIA_CCTP',
      sourceChain: chain.name,
      destChain: destChain.name,
      txHash,
      blockNumber: 0,
      eventData: { payableId },
    });
    log.info({ payableId, destChain: destChain.name, txHash }, 'Queued PAYABLE_UPDATE_VIA_CCTP job');
  }
}

// ── Utilities ─────────────────────────────────────────────────────────────────

function sleep(ms: number): Promise<void> {
  return new Promise((r) => setTimeout(r, ms));
}

/**
 * Chunked getLogs — splits [fromBlock, latest] into 9,000-block pages so that
 * RPCs with a 10,000-block cap (e.g. Arc Testnet) don't reject the request.
 * Returns all matching logs across all chunks.
 */
async function getLogsChunked(
  client: PublicClient,
  params: Parameters<PublicClient['getLogs']>[0] & { fromBlock: bigint }
): Promise<Awaited<ReturnType<PublicClient['getLogs']>>> {
  const CHUNK = 9_000n;
  const latestBlock = await client.getBlockNumber();
  const results: Awaited<ReturnType<PublicClient['getLogs']>> = [];
  for (let from = params.fromBlock; from <= latestBlock; from += CHUNK) {
    const to = from + CHUNK - 1n < latestBlock ? from + CHUNK - 1n : latestBlock;
    const chunk = await client.getLogs({ ...params, fromBlock: from, toBlock: to });
    results.push(...chunk);
  }
  return results;
}

/**
 * Recursively strip `abi` from viem errors before logging.
 * Viem attaches the full ABI to thrown errors and their nested `cause` chain,
 * which floods log output with thousands of lines.
 */
function sanitizeErr(e: unknown): unknown {
  if (!e || typeof e !== 'object') return e;
  const seen = new WeakSet<object>();
  const strip = (obj: object): Record<string, unknown> => {
    if (seen.has(obj)) return { '[Circular]': true };
    seen.add(obj);
    const out: Record<string, unknown> = {};
    for (const key of Object.getOwnPropertyNames(obj)) {
      if (key === 'abi') continue;
      const val = (obj as Record<string, unknown>)[key];
      if (val && typeof val === 'object' && !Array.isArray(val)) {
        out[key] = strip(val as object);
      } else {
        out[key] = val;
      }
    }
    return out;
  };
  return strip(e as object);
}
