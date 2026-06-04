// ──────────────────────────────────────────────────────────────────────────────
// Chainbills Relayer — Solana Indexer
//
// Polls the Solana Chainbills program using count-based cursors on the Stats PDA.
//
// Strategy:
//   1. Read Stats PDA each tick → compare counters to cursor.
//   2. For each new ActivityRecord (globally indexed), fetch the account and
//      index the referenced entity into Firestore.
//   3. For new outbound CCTP/Wormhole messages, scan recent transaction
//      signatures to find the txHash/sequence needed to create relay jobs.
//
// Firestore writes use { merge: true } — same invariant as EVM indexer.
// ──────────────────────────────────────────────────────────────────────────────

import { Connection, PublicKey } from '@solana/web3.js';
import { Timestamp } from 'firebase-admin/firestore';
import type { SolanaChainConfig } from '../chains.js';
import { createJob, jobExistsForTx } from '../jobs/store.js';
import { chainByCbChainId } from '../chains.js';
import { db } from '../utils/firebase.js';
import { chainLogger } from '../utils/logger.js';
import { b58 } from '../utils/encoding.js';
import { activityRecordPDA, statsPDA } from './accounts.js';
import { decodeAccount, makeCoder, makeConnection } from './client.js';

// ── Cursor ────────────────────────────────────────────────────────────────────

export interface SolanaCursor {
  activitiesIndexed: number;
  /** Stats.published_wormhole_messages high-watermark (outbound Wormhole). */
  wormholeRelayed: number;
  /** Stats.emitted_cctp_payment_messages high-watermark. */
  cctpPaymentsRelayed: number;
  /** Stats.emitted_cctp_update_messages high-watermark. */
  cctpUpdatesRelayed: number;
}

export const ZERO_SOLANA_CURSOR: SolanaCursor = {
  activitiesIndexed: 0,
  wormholeRelayed: 0,
  cctpPaymentsRelayed: 0,
  cctpUpdatesRelayed: 0,
};

export async function loadSolanaCursor(chainName: string): Promise<SolanaCursor> {
  const snap = await db.doc(`relayerCursors/${chainName}`).get();
  if (!snap.exists) return { ...ZERO_SOLANA_CURSOR };
  const d = snap.data()!;
  return {
    activitiesIndexed: d.activitiesIndexed ?? 0,
    wormholeRelayed: d.wormholeRelayed ?? 0,
    cctpPaymentsRelayed: d.cctpPaymentsRelayed ?? 0,
    cctpUpdatesRelayed: d.cctpUpdatesRelayed ?? 0,
  };
}

export async function saveSolanaCursor(chainName: string, cursor: SolanaCursor): Promise<void> {
  await db.doc(`relayerCursors/${chainName}`).set(
    {
      activitiesIndexed: cursor.activitiesIndexed,
      wormholeRelayed: cursor.wormholeRelayed,
      cctpPaymentsRelayed: cursor.cctpPaymentsRelayed,
      cctpUpdatesRelayed: cursor.cctpUpdatesRelayed,
      updatedAt: new Date().toISOString(),
    },
    { merge: true }
  );
}

// ── Activity type constants (mirrors Rust ActivityType enum order) ─────────────
// These must match the discriminant values in the Rust ActivityType enum.
const ACTIVITY_USER_INITIALIZED = 0;
const ACTIVITY_CREATED_PAYABLE = 1;
const ACTIVITY_CLOSED_PAYABLE = 2;
const ACTIVITY_REOPENED_PAYABLE = 3;
const ACTIVITY_UPDATED_PAYABLE_ATAA = 4;
const ACTIVITY_UPDATED_AUTO_WITHDRAW = 5;
const ACTIVITY_USER_PAID = 6;
const ACTIVITY_PAYABLE_RECEIVED = 7;
const ACTIVITY_WITHDREW = 8;
const ACTIVITY_FOREIGN_PAYMENT_RECEIVED = 9;

// ── Main poll function ────────────────────────────────────────────────────────

export async function pollSolana(
  chain: SolanaChainConfig,
  cursor: SolanaCursor,
  log: ReturnType<typeof chainLogger>
): Promise<boolean> {
  const connection = makeConnection(chain);
  const coder = makeCoder();
  let changed = false;

  // ── Read Stats PDA ─────────────────────────────────────────────────────────
  const statsAddr = statsPDA(chain.programId);
  const statsInfo = await connection.getAccountInfo(statsAddr);
  if (!statsInfo) {
    log.warn('Stats PDA not found — program not initialized yet');
    return false;
  }

  let stats: Record<string, any>;
  try {
    stats = decodeAccount<Record<string, any>>(coder, 'Stats', statsInfo.data);
  } catch (e) {
    log.error({ err: e }, 'Failed to decode Stats PDA');
    return false;
  }

  const totalActivities = Number(stats.total_activities);
  const publishedWormhole = Number(stats.published_wormhole_messages);
  const emittedCctpPayments = Number(stats.emitted_cctp_payment_messages);
  const emittedCctpUpdates = Number(stats.emitted_cctp_update_messages);

  // ── 1. Index new activity records ─────────────────────────────────────────
  if (totalActivities > cursor.activitiesIndexed) {
    const delta = totalActivities - cursor.activitiesIndexed;
    log.info({ from: cursor.activitiesIndexed, delta }, 'New Solana activities to index');

    let done = 0;
    for (let i = cursor.activitiesIndexed; i < totalActivities; i++) {
      try {
        await indexActivity(chain, connection, coder, BigInt(i), log);
        done++;
      } catch (e) {
        log.error({ activityIndex: i, err: e }, 'indexActivity failed — stopping batch');
        break;
      }
    }
    if (done > 0) {
      cursor.activitiesIndexed += done;
      changed = true;
    }
  }

  // ── 2. Outbound Wormhole messages → payable update relay jobs ─────────────
  if (chain.hasWormhole && publishedWormhole > cursor.wormholeRelayed) {
    const delta = publishedWormhole - cursor.wormholeRelayed;
    log.info({ from: cursor.wormholeRelayed, delta }, 'New Solana Wormhole messages to relay');
    let done = 0;
    for (let i = 0; i < delta; i++) {
      const sequence = cursor.wormholeRelayed + i;
      try {
        await maybeQueueSolanaWormholeJob(chain, sequence, log);
        done++;
      } catch (e) {
        log.error({ sequence, err: e }, 'Wormhole relay job failed');
        break;
      }
    }
    if (done > 0) {
      cursor.wormholeRelayed += done;
      changed = true;
    }
  }

  // ── 3. Outbound CCTP payments → relay jobs for dest EVM chains ────────────
  if (chain.hasCctp && emittedCctpPayments > cursor.cctpPaymentsRelayed) {
    log.info({ from: cursor.cctpPaymentsRelayed, onChain: emittedCctpPayments }, 'New Solana CCTP payments to relay');
    // Scan recent transactions on the program to find cross-chain UserPaid events.
    // We use the transaction signatures as txHash for CCTP attestation polling.
    const found = await scanAndQueueCctpPaymentJobs(chain, connection, coder, log);
    if (found >= emittedCctpPayments) {
      cursor.cctpPaymentsRelayed = emittedCctpPayments;
      changed = true;
    } else {
      log.warn({ found, onChain: emittedCctpPayments }, 'CCTP payment scan incomplete — will retry');
    }
  }

  // ── 4. Outbound CCTP update messages → payable update relay jobs ──────────
  if (chain.hasCctp && emittedCctpUpdates > cursor.cctpUpdatesRelayed) {
    log.info(
      { from: cursor.cctpUpdatesRelayed, onChain: emittedCctpUpdates },
      'New Solana CCTP payable updates to relay'
    );
    const found = await scanAndQueueCctpUpdateJobs(chain, connection, coder, log);
    if (found >= emittedCctpUpdates) {
      cursor.cctpUpdatesRelayed = emittedCctpUpdates;
      changed = true;
    } else {
      log.warn({ found, onChain: emittedCctpUpdates }, 'CCTP update scan incomplete — will retry');
    }
  }

  return changed;
}

// ── Activity indexing ─────────────────────────────────────────────────────────

async function indexActivity(
  chain: SolanaChainConfig,
  connection: Connection,
  coder: ReturnType<typeof makeCoder>,
  globalIndex: bigint,
  log: ReturnType<typeof chainLogger>
): Promise<void> {
  const actAddr = activityRecordPDA(globalIndex, chain.programId);
  const actInfo = await connection.getAccountInfo(actAddr);
  if (!actInfo) throw new Error(`ActivityRecord not found at index ${globalIndex}`);

  const act = decodeAccount<Record<string, any>>(coder, 'ActivityRecord', actInfo.data);

  // ActivityType is an Anchor enum — decode the variant key.
  const activityTypeKey = Object.keys(act.activity_type)[0] as string;
  const entity = act.entity as PublicKey;

  switch (activityTypeKey) {
    case 'createdPayable':
    case 'closedPayable':
    case 'reopenedPayable':
    case 'updatedPayableAtaa':
    case 'updatedAutoWithdraw':
      await indexPayable(chain, connection, coder, entity, log);
      break;

    case 'userPaid':
    case 'paidForeignPayable':
      await indexUserPayment(chain, connection, coder, entity, log);
      break;

    case 'payableReceived':
    case 'foreignPaymentReceived':
      await indexPayablePayment(chain, connection, coder, entity, log);
      break;

    case 'withdrew':
      await indexWithdrawal(chain, connection, coder, entity, log);
      break;

    case 'userInitialized':
      // No separate Firestore record for user initialization.
      break;

    default:
      log.warn({ activityTypeKey, globalIndex: globalIndex.toString() }, 'Unknown activity type');
  }
}

// ── Entity indexers ───────────────────────────────────────────────────────────

async function indexPayable(
  chain: SolanaChainConfig,
  connection: Connection,
  coder: ReturnType<typeof makeCoder>,
  payableAddr: PublicKey,
  log: ReturnType<typeof chainLogger>
): Promise<void> {
  const info = await connection.getAccountInfo(payableAddr);
  if (!info) throw new Error(`Payable account not found: ${payableAddr.toBase58()}`);

  const payable = decodeAccount<Record<string, any>>(coder, 'Payable', info.data);
  const payableId = payableAddr.toBase58();

  const data = {
    id: payableId,
    chainName: chain.name,
    chainNetworkType: chain.network,
    host: (payable.host as PublicKey).toBase58(),
    chainCount: Number(payable.chain_count ?? 0),
    hostCount: Number(payable.host_count ?? 0),
    isClosed: payable.is_closed,
    isAutoWithdraw: payable.is_auto_withdraw,
    createdAt: Timestamp.fromMillis(Number(payable.created_at) * 1000),
    indexedAt: Timestamp.now(),
  };

  await db.doc(`payables/${payableId}`).set(data, { merge: true });
  log.info({ payableId }, 'Indexed Solana payable');
}

async function indexUserPayment(
  chain: SolanaChainConfig,
  connection: Connection,
  coder: ReturnType<typeof makeCoder>,
  paymentAddr: PublicKey,
  log: ReturnType<typeof chainLogger>
): Promise<void> {
  const info = await connection.getAccountInfo(paymentAddr);
  if (!info) throw new Error(`UserPayment not found: ${paymentAddr.toBase58()}`);

  const up = decodeAccount<Record<string, any>>(coder, 'UserPayment', info.data);
  const paymentId = paymentAddr.toBase58();

  // payableChainId is [u8;32] bytes — hex-encode for lookup.
  const payableChainIdHex = '0x' + Buffer.from(up.payable_chain_id as number[]).toString('hex');
  const destChain = chainByCbChainId.get(payableChainIdHex);
  const payableChainName = destChain?.name ?? payableChainIdHex;

  const data = {
    id: paymentId,
    chainName: chain.name,
    chainNetworkType: chain.network,
    payer: (up.payer as PublicKey).toBase58(),
    payerCount: Number(up.payer_count ?? 0),
    payableId: (up.payable as PublicKey).toBase58(),
    payableChainName,
    chainCount: Number(up.chain_count ?? 0),
    token: (up.token_mint as PublicKey).toBase58(),
    amount: Number(up.amount),
    timestamp: Timestamp.fromMillis(Number(up.created_at) * 1000),
    indexedAt: Timestamp.now(),
  };

  await db.doc(`userPayments/${paymentId}`).set(data, { merge: true });
  log.info({ paymentId }, 'Indexed Solana userPayment');
}

async function indexPayablePayment(
  chain: SolanaChainConfig,
  connection: Connection,
  coder: ReturnType<typeof makeCoder>,
  paymentAddr: PublicKey,
  log: ReturnType<typeof chainLogger>
): Promise<void> {
  const info = await connection.getAccountInfo(paymentAddr);
  if (!info) throw new Error(`PayablePayment not found: ${paymentAddr.toBase58()}`);

  const pp = decodeAccount<Record<string, any>>(coder, 'PayablePayment', info.data);
  const paymentId = paymentAddr.toBase58();

  const payerChainIdHex = '0x' + Buffer.from(pp.payer_chain_id as number[]).toString('hex');
  const payerChain = chainByCbChainId.get(payerChainIdHex);
  const payerChainName = payerChain?.name ?? payerChainIdHex;

  // payer is [u8;32] — base58 if Solana source, 0x-prefixed hex otherwise.
  const payerRaw = Buffer.from(pp.payer as number[]);
  const payer = payerChain?.isSolana ? b58.encode(payerRaw) : '0x' + payerRaw.toString('hex').replace(/^0+/, '');

  const data = {
    id: paymentId,
    chainName: chain.name,
    chainNetworkType: chain.network,
    payableId: (pp.payable as PublicKey).toBase58(),
    payer,
    payerChainName,
    payableCount: Number(pp.payable_count ?? 0),
    localChainCount: Number(pp.local_chain_count ?? 0),
    chainCount: Number(pp.chain_count ?? 0),
    token: (pp.token_mint as PublicKey).toBase58(),
    amount: Number(pp.amount),
    timestamp: Timestamp.fromMillis(Number(pp.created_at) * 1000),
    indexedAt: Timestamp.now(),
  };

  await db.doc(`payablePayments/${paymentId}`).set(data, { merge: true });

  // Notify host via FCM (same as EVM path).
  try {
    const { notifyPaymentReceived } = await import('../notify/host.js');
    await notifyPaymentReceived(
      (pp.payable as PublicKey).toBase58(),
      paymentId,
      (pp.token_mint as PublicKey).toBase58(),
      Number(pp.amount) / 1_000_000 // USDC has 6 decimals
    );
  } catch (e) {
    log.warn({ err: e }, 'FCM notify failed for Solana payablePayment');
  }

  log.info({ paymentId }, 'Indexed Solana payablePayment');
}

async function indexWithdrawal(
  chain: SolanaChainConfig,
  connection: Connection,
  coder: ReturnType<typeof makeCoder>,
  withdrawalAddr: PublicKey,
  log: ReturnType<typeof chainLogger>
): Promise<void> {
  const info = await connection.getAccountInfo(withdrawalAddr);
  if (!info) throw new Error(`Withdrawal not found: ${withdrawalAddr.toBase58()}`);

  const wdl = decodeAccount<Record<string, any>>(coder, 'Withdrawal', info.data);
  const withdrawalId = withdrawalAddr.toBase58();

  const data = {
    id: withdrawalId,
    chainName: chain.name,
    chainNetworkType: chain.network,
    payableId: (wdl.payable as PublicKey).toBase58(),
    host: (wdl.host as PublicKey).toBase58(),
    chainCount: Number(wdl.chain_count ?? 0),
    hostCount: Number(wdl.host_count ?? 0),
    payableCount: Number(wdl.payable_count ?? 0),
    token: (wdl.token_mint as PublicKey).toBase58(),
    amount: Number(wdl.amount),
    timestamp: Timestamp.fromMillis(Number(wdl.created_at) * 1000),
    indexedAt: Timestamp.now(),
  };

  await db.doc(`withdrawals/${withdrawalId}`).set(data, { merge: true });
  log.info({ withdrawalId }, 'Indexed Solana withdrawal');
}

// ── Relay job creation ────────────────────────────────────────────────────────

async function maybeQueueSolanaWormholeJob(
  chain: SolanaChainConfig,
  sequence: number,
  log: ReturnType<typeof chainLogger>
): Promise<void> {
  const syntheticKey = `wormhole-seq-${chain.name}-${sequence}`;
  let queued = 0;

  for (const destChain of (await import('../chains.js')).ALL_CHAINS) {
    if (destChain.name === chain.name) continue;
    if (destChain.network !== chain.network) continue;
    if (!destChain.hasWormhole) continue;

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
    log.info({ sequence, destChain: destChain.name }, 'Queued PAYABLE_UPDATE_VIA_WORMHOLE from Solana');
    queued++;
  }
  if (queued === 0) {
    log.info({ sequence }, 'Wormhole message — no eligible dest chains');
  }
}

/**
 * Scan recent program transactions to find cross-chain UserPaid events.
 * Returns the number of cross-chain payments found (for cursor advancement).
 *
 * Each transaction that triggered a CCTP payment burn has a unique signature
 * that can be used as txHash for Circle Iris attestation polling.
 */
async function scanAndQueueCctpPaymentJobs(
  chain: SolanaChainConfig,
  connection: Connection,
  coder: ReturnType<typeof makeCoder>,
  log: ReturnType<typeof chainLogger>
): Promise<number> {
  const programId = new PublicKey(chain.programId);
  let found = 0;

  try {
    // Fetch recent signatures — limit 100 to avoid RPC timeouts.
    const sigs = await connection.getSignaturesForAddress(programId, { limit: 100 });

    for (const sigInfo of sigs) {
      const tx = await connection.getParsedTransaction(sigInfo.signature, {
        commitment: 'confirmed',
        maxSupportedTransactionVersion: 0,
      });
      if (!tx?.meta?.logMessages) continue;

      // Look for UserPaid event in logs (emitted by emit!() as base64-encoded data).
      const hasCctpPayment = tx.meta.logMessages.some(
        (l) => l.includes('UserPaid') || l.includes('pay_foreign_via_cctp')
      );
      if (!hasCctpPayment) continue;

      found++;
      const txHash = sigInfo.signature;

      // Find the dest chain from the transaction (UserPaid has payable_chain_id).
      // For now, queue jobs for all CCTP-capable EVM chains on the same network.
      const allChains = (await import('../chains.js')).ALL_CHAINS;
      for (const destChain of allChains) {
        if (destChain.name === chain.name) continue;
        if (destChain.network !== chain.network) continue;
        if (!destChain.hasCctp) continue;

        const alreadyQueued = await jobExistsForTx(txHash, destChain.name);
        if (alreadyQueued) continue;

        const jobType =
          chain.hasWormhole && destChain.hasWormhole ? 'PAYMENT_VIA_CCTP_WORMHOLE' : 'PAYMENT_VIA_CCTP_ONLY';

        await createJob({
          type: jobType,
          sourceChain: chain.name,
          destChain: destChain.name,
          txHash,
          blockNumber: 0,
          eventData: { signature: txHash },
        });
        log.info({ txHash, destChain: destChain.name, jobType }, 'Queued Solana cross-chain payment job');
      }
    }
  } catch (e) {
    log.error({ err: e }, 'scanAndQueueCctpPaymentJobs failed');
  }

  return found;
}

async function scanAndQueueCctpUpdateJobs(
  chain: SolanaChainConfig,
  connection: Connection,
  coder: ReturnType<typeof makeCoder>,
  log: ReturnType<typeof chainLogger>
): Promise<number> {
  const programId = new PublicKey(chain.programId);
  let found = 0;

  try {
    const sigs = await connection.getSignaturesForAddress(programId, { limit: 100 });

    for (const sigInfo of sigs) {
      const tx = await connection.getParsedTransaction(sigInfo.signature, {
        commitment: 'confirmed',
        maxSupportedTransactionVersion: 0,
      });
      if (!tx?.meta?.logMessages) continue;

      const hasBroadcast = tx.meta.logMessages.some(
        (l) => l.includes('PayableUpdateBroadcasted') || l.includes('broadcast_payable_update')
      );
      if (!hasBroadcast) continue;

      found++;
      const txHash = sigInfo.signature;
      const allChains = (await import('../chains.js')).ALL_CHAINS;

      for (const destChain of allChains) {
        if (destChain.name === chain.name) continue;
        if (destChain.network !== chain.network) continue;
        if (!destChain.hasCctp) continue;

        const alreadyQueued = await jobExistsForTx(txHash, destChain.name);
        if (alreadyQueued) continue;

        await createJob({
          type: 'PAYABLE_UPDATE_VIA_CCTP',
          sourceChain: chain.name,
          destChain: destChain.name,
          txHash,
          blockNumber: 0,
          eventData: { signature: txHash },
        });
        log.info({ txHash, destChain: destChain.name }, 'Queued PAYABLE_UPDATE_VIA_CCTP from Solana');
      }
    }
  } catch (e) {
    log.error({ err: e }, 'scanAndQueueCctpUpdateJobs failed');
  }

  return found;
}
