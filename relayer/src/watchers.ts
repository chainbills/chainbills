// ──────────────────────────────────────────────────────────────────────────────
// Chainbills Relayer — Count-Based Chain Poller
//
// Design: contract-stats polling over getLogs block scanning
// ──────────────────────────────────────────────────────────────────────────────
// Instead of scanning block ranges for events, each poll tick:
//   1. Calls getChainStats() on CbGetters — one RPC call for all counts.
//   2. Compares each count against the in-memory cursor.
//   3. Fetches only the new IDs via paginated getters and processes them.
//   4. Persists the updated cursor to Firestore after each productive tick.
//
// Cursor strategy:
//   • Loaded from Firestore ONCE at startup — no Firestore reads during polling.
//   • Written back to Firestore only when at least one count advanced.
//   • All cursors live in /relayerCursors/{chainName} alongside the old
//     lastPayableUpdateBlock field (still used for CCTP payable update relay).
//
// Cross-chain payment relay:
//   Detected via userPaymentsCount delta. When a new user payment is for a
//   foreign payable, a targeted getLogs call (paymentId is an indexed topic)
//   fetches the txHash cheaply, then the existing job queue handles the rest.
//
// Wormhole payable update relay:
//   Detected via publishedWormholeMessagesCount delta. VAAs are fetched by
//   sequence from WormholeScan (no txHash needed). PaymentPayload VAAs (type 2)
//   are skipped here — payments are relayed via the user payment path above.
//
// CCTP payable update relay:
//   Block-cursor approach kept for PayableUpdateBroadcasted events. This is the
//   only place getLogs block scanning is still used — it covers CCTP-only payable
//   update relay where no Wormhole sequence is available. Stored in the same
//   cursor doc under lastPayableUpdateBlock.
// ──────────────────────────────────────────────────────────────────────────────

import { type PublicClient, parseAbiItem } from 'viem';
import type { ChainConfig } from './chains.js';
import { ALL_CHAINS, chainByCbChainId } from './chains.js';
import { indexPayable, indexPayablePayment, indexUserPayment, indexWithdrawal } from './indexer.js';
import { createJob, jobExistsForTx } from './jobs/store.js';
import { notifyPaymentReceived } from './notify/host.js';
import { getVaaBySequence } from './resolvers/wormhole.js';
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
  /** Number of Wormhole messages processed (Wormhole chains only). */
  wormholeRelayed: number;
}

const ZERO_CURSOR: ChainCursor = {
  payablesIndexed: 0,
  userPaymentsIndexed: 0,
  payablePaymentsIndexed: 0,
  withdrawalsIndexed: 0,
  wormholeRelayed: 0,
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
  const stats: any = await client.readContract({
    address: chain.gettersAddress,
    abi: gettersAbi,
    functionName: 'getChainStats',
  });

  let changed = false;

  // ── 1. Payables ─────────────────────────────────────────────────────────────
  const onChainPayables = Number(stats.payablesCount);
  if (onChainPayables > cursor.payablesIndexed) {
    const delta = onChainPayables - cursor.payablesIndexed;
    log.info({ from: cursor.payablesIndexed, delta }, 'New payables detected');
    const ids: readonly `0x${string}`[] = (await client.readContract({
      address: chain.gettersAddress,
      abi: gettersAbi,
      functionName: 'chainPayableIdsPaginated',
      args: [BigInt(cursor.payablesIndexed), BigInt(delta)],
    })) as `0x${string}`[];
    let done = 0;
    for (const id of ids) {
      try {
        await indexPayable(chain, id);
        if (chain.hasCctp) {
          // Targeted getLogs by indexed payableId — returns exactly the creation log.
          const bcastLogs = await client.getLogs({
            address: chain.contractAddress,
            event: PAYABLE_UPDATE_BROADCASTED_EVENT,
            args: { payableId: id } as any,
            fromBlock: chain.deploymentBlock,
          });
          if (bcastLogs.length > 0) {
            await maybeQueueCctpPayableUpdateJobs(chain, bcastLogs[0].transactionHash!, id, log);
          }
        }
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

  // ── 2. User payments — index + cross-chain relay ───────────────────────────
  const onChainUserPayments = Number(stats.userPaymentsCount);
  if (onChainUserPayments > cursor.userPaymentsIndexed) {
    const delta = onChainUserPayments - cursor.userPaymentsIndexed;
    log.info({ from: cursor.userPaymentsIndexed, delta }, 'New user payments detected');
    const ids: readonly `0x${string}`[] = (await client.readContract({
      address: chain.gettersAddress,
      abi: gettersAbi,
      functionName: 'chainUserPaymentIdsPaginated',
      args: [BigInt(cursor.userPaymentsIndexed), BigInt(delta)],
    })) as `0x${string}`[];
    let done = 0;
    for (const id of ids) {
      try {
        await indexUserPayment(chain, id);
        await maybeQueuePaymentRelayJob(chain, client, id, log);
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
  const onChainPayablePayments = Number(stats.payablePaymentsCount);
  if (onChainPayablePayments > cursor.payablePaymentsIndexed) {
    const delta = onChainPayablePayments - cursor.payablePaymentsIndexed;
    log.info({ from: cursor.payablePaymentsIndexed, delta }, 'New payable payments detected');
    const ids: readonly `0x${string}`[] = (await client.readContract({
      address: chain.gettersAddress,
      abi: gettersAbi,
      functionName: 'chainPayablePaymentIdsPaginated',
      args: [BigInt(cursor.payablePaymentsIndexed), BigInt(delta)],
    })) as `0x${string}`[];
    let done = 0;
    for (const id of ids) {
      try {
        await indexPayablePayment(chain, id);
        const raw: any = await client.readContract({
          address: chain.gettersAddress,
          abi: gettersAbi,
          functionName: 'getPayablePayment',
          args: [id],
        });
        const { name: tokenName, decimals } = resolveToken((raw.token as string).toLowerCase(), chain.name);
        await notifyPaymentReceived(
          (raw.payableId as string).toLowerCase(),
          id.toLowerCase(),
          tokenName,
          Number(raw.amount) / 10 ** decimals
        );
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
  const onChainWithdrawals = Number(stats.withdrawalsCount);
  if (onChainWithdrawals > cursor.withdrawalsIndexed) {
    const delta = onChainWithdrawals - cursor.withdrawalsIndexed;
    log.info({ from: cursor.withdrawalsIndexed, delta }, 'New withdrawals detected');
    const ids: readonly `0x${string}`[] = (await client.readContract({
      address: chain.gettersAddress,
      abi: gettersAbi,
      functionName: 'chainWithdrawalIdsPaginated',
      args: [BigInt(cursor.withdrawalsIndexed), BigInt(delta)],
    })) as `0x${string}`[];
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
    const onChainWormhole = Number(stats.publishedWormholeMessagesCount);
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

  // Persist only when something actually changed — avoids write amplification.
  if (changed) {
    await saveCursor(chain.name, cursor);
  }
}

// ── Cross-chain payment relay ─────────────────────────────────────────────────

async function maybeQueuePaymentRelayJob(
  chain: ChainConfig,
  client: PublicClient,
  paymentId: `0x${string}`,
  log: ReturnType<typeof chainLogger>
): Promise<void> {
  const raw: any = await client.readContract({
    address: chain.gettersAddress,
    abi: gettersAbi,
    functionName: 'getUserPayment',
    args: [paymentId],
  });

  const payableChainId: string = raw.payableChainId;

  // Local payment — payable lives on this chain, no relay needed.
  if (payableChainId === chain.cbChainId) return;

  const destChain = chainByCbChainId.get(payableChainId);
  if (!destChain) {
    log.warn({ paymentId, payableChainId }, 'Unknown payableChainId — cannot queue payment relay job');
    return;
  }
  if (!chain.hasCctp) {
    log.warn({ paymentId }, 'Source chain lacks CCTP — cross-chain payment cannot be relayed');
    return;
  }

  // Fetch the txHash via targeted getLogs — paymentId is an indexed topic so
  // each chunk returns at most one log. Paginate in 9,000-block chunks to
  // satisfy RPCs that cap eth_getLogs ranges (e.g. Arc Testnet: 10,000 blocks).
  const latestBlock = await client.getBlockNumber();
  const CHUNK = 9_000n;
  let txHash: `0x${string}` | undefined;
  let blockNumber: number | undefined;
  for (let from = chain.deploymentBlock; from <= latestBlock; from += CHUNK) {
    const to = from + CHUNK - 1n < latestBlock ? from + CHUNK - 1n : latestBlock;
    const chunk = await client.getLogs({
      address: chain.contractAddress,
      event: USER_PAID_EVENT,
      args: { paymentId } as any,
      fromBlock: from,
      toBlock: to,
    });
    if (chunk.length > 0) {
      txHash = chunk[0].transactionHash!;
      blockNumber = Number(chunk[0].blockNumber);
      break;
    }
  }
  if (!txHash) {
    log.warn({ paymentId }, 'UserPaid log not found — cannot queue payment relay job');
    return;
  }

  const alreadyQueued = await jobExistsForTx(txHash, destChain.name);
  if (alreadyQueued) return;

  const jobType = chain.hasWormhole ? 'PAYMENT_VIA_CIRCLE' : 'PAYMENT_VIA_CCTP_ONLY';
  await createJob({
    type: jobType,
    sourceChain: chain.name,
    destChain: destChain.name,
    txHash,
    blockNumber: blockNumber ?? 0,
    eventData: { paymentId, payableChainId },
  });
  log.info({ paymentId, destChain: destChain.name, txHash, jobType }, 'Queued cross-chain payment relay job');
}

// ── Wormhole payable update relay ─────────────────────────────────────────────

async function maybeQueueWormholeRelayJob(
  chain: ChainConfig,
  sequence: number,
  log: ReturnType<typeof chainLogger>
): Promise<void> {
  const vaaBytes = await getVaaBySequence(chain, sequence);
  if (!vaaBytes) {
    // VAA not ready (Guardians haven't signed yet). The wormholeRelayed cursor
    // will still advance, so this sequence won't be retried automatically.
    // The job processor handles retries for already-created jobs; for missed
    // sequences, use the backfill script.
    log.warn({ sequence }, 'VAA not ready for sequence — sequence will not be auto-retried');
    return;
  }

  // Inspect the payload type byte to skip Payment VAAs (type 2).
  // Payment relays are handled separately via the user payment path.
  const payloadOffset = wormholePayloadOffset(vaaBytes);
  if (payloadOffset === null || vaaBytes[payloadOffset] !== 1) {
    log.debug(
      { sequence, payloadType: payloadOffset !== null ? vaaBytes[payloadOffset] : '?' },
      'Skipping non-payable-update VAA'
    );
    return;
  }

  const vaaHex = Buffer.from(vaaBytes).toString('hex');
  // Use a synthetic txHash so the dedup check works without a real transaction hash.
  const syntheticKey = `wormhole-seq-${chain.name}-${sequence}`;

  // Extract payableId from VAA payload for admin-sync jobs (non-Wormhole dest chains).
  // PayablePayload layout after payload offset: payloadType(1) | version(1) | actionType(1) | payableId(32) | ...
  const payableId = ('0x' +
    Buffer.from(vaaBytes.slice(payloadOffset + 3, payloadOffset + 35)).toString('hex')) as `0x${string}`;

  for (const destChain of ALL_CHAINS) {
    if (destChain.name === chain.name) continue;

    const alreadyQueued = await jobExistsForTx(syntheticKey, destChain.name);
    if (alreadyQueued) continue;

    if (destChain.hasWormhole) {
      await createJob({
        type: 'PAYABLE_UPDATE_VIA_WORMHOLE',
        sourceChain: chain.name,
        destChain: destChain.name,
        txHash: syntheticKey,
        blockNumber: 0,
        eventData: { sequence: String(sequence) },
        vaa: vaaHex,
      });
      log.info({ sequence, destChain: destChain.name }, 'Queued PAYABLE_UPDATE_VIA_WORMHOLE job');
    } else {
      // Dest chain has no Wormhole — apply update via adminSyncForeignPayable.
      await createJob({
        type: 'ADMIN_SYNC',
        sourceChain: chain.name,
        destChain: destChain.name,
        txHash: syntheticKey,
        blockNumber: 0,
        eventData: { payableId, sequence: String(sequence) },
        vaa: vaaHex,
      });
      log.info({ sequence, payableId, destChain: destChain.name }, 'Queued ADMIN_SYNC job');
    }
  }
}

/**
 * Returns the byte offset of the payload within a serialized signed VAA.
 *
 * VAA wire layout:
 *   version(1) | guardianSetIndex(4) | numSignatures(1)
 *   | signatures(66 × numSignatures)
 *   | timestamp(4) | nonce(4) | emitterChain(2) | emitterAddress(32)
 *   | sequence(8) | consistencyLevel(1)
 *   | payload(...)
 *
 * Header before payload = 6 + 66×numSigs + 51 bytes.
 */
function wormholePayloadOffset(vaa: Uint8Array): number | null {
  try {
    const numSigs = vaa[5];
    return 6 + 66 * numSigs + 51;
  } catch {
    return null;
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

    const bothWormhole = chain.hasWormhole && destChain.hasWormhole;
    const bothCctp = chain.hasCctp && destChain.hasCctp;

    // Wormhole pairs are handled by the sequence-based Wormhole relay above.
    if (bothWormhole) continue;
    if (!bothCctp) continue;

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
