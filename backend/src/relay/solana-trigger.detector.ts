// ──────────────────────────────────────────────────────────────────────────────
// Chainbills Backend — Solana relay trigger detector
//
// Scans recent Solana program transaction signatures to detect outbound
// Wormhole and CCTP messages, creating SOLANA_PAYABLE_UPDATE_VIA_WORMHOLE and
// SOLANA_PAYMENT_VIA_CCTP_WORMHOLE relay jobs when the chain's relayEnabled
// flag is true.
//
// Strategy (mirrors relayer/src/solana/indexer.ts relay sections):
//   1. Read Stats PDA counters (passed in from the indexer tick to avoid
//      a second RPC call).
//   2. For Wormhole: compare published_wormhole_messages to cursor.wormholeRelayed.
//      Each new sequence gets one SOLANA_PAYABLE_UPDATE_VIA_WORMHOLE job per
//      eligible dest chain (same network, Wormhole-capable).
//   3. For CCTP payments: compare emitted_cctp_payment_messages to
//      cursor.cctpPaymentsRelayed. Scan recent signatures for cross-chain pay
//      transactions and create SOLANA_PAYMENT_VIA_CCTP_WORMHOLE jobs.
//   4. For CCTP payable updates: emitted_cctp_update_messages vs
//      cursor.cctpPayableUpdatesRelayed. Scan signatures for broadcast calls.
//
// Invariants:
//   - Called only when chain.relayEnabled === true. The indexer's tick method
//     gates this call.
//   - Destination must be on the same network (sameNetwork check).
//   - createJob uses skipDuplicates so re-scanning the same signatures is safe.
//   - Cursor counters advance only when all new messages for that counter have
//     been queued.
// ──────────────────────────────────────────────────────────────────────────────

import { Logger } from '@nestjs/common';
import { Connection } from '@solana/web3.js';
import type { ChainsService } from '../chains/chains.service';
import type { SolanaChainConfig } from '../chains/types';
import type { PrismaService } from '../prisma/prisma.service';
import { sameNetwork } from '../chains/registry';
import { createJob } from './job.store';
import type { BorshAccountsCoder } from '@coral-xyz/anchor';

const logger = new Logger('SolanaTriggerDetector');

/**
 * Scans Solana outbound messages and creates relay jobs for each new message.
 * Called by SolanaIndexer.tick only when chain.relayEnabled is true.
 *
 * @param chain       The Solana source chain config.
 * @param chains      ChainsService for enabled destination lookup.
 * @param prisma      PrismaService for cursor reads and job writes.
 * @param connection  A Solana Connection for the source chain.
 * @param coder       BorshAccountsCoder (unused here but kept for signature symmetry).
 * @param stats       Decoded Stats PDA object (already read by the indexer tick).
 */
export async function detectSolanaRelayTriggers(
  chain: SolanaChainConfig,
  chains: ChainsService,
  prisma: PrismaService,
  connection: Connection,

  _coder: BorshAccountsCoder,
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  stats: Record<string, any>
): Promise<void> {
  const cursor = await prisma.chainCursor.findUnique({ where: { chainId: chain.cbChainId } });

  const publishedWormhole = BigInt(stats.published_wormhole_messages?.toString() ?? '0');
  const emittedCctpPayments = BigInt(stats.emitted_cctp_payment_messages?.toString() ?? '0');
  const emittedCctpUpdates = BigInt(stats.emitted_cctp_update_messages?.toString() ?? '0');

  const wormholeRelayed = BigInt(cursor?.wormholeRelayed?.toString() ?? '0');
  const cctpPaymentsRelayed = BigInt(cursor?.cctpPaymentsRelayed?.toString() ?? '0');
  const cctpUpdatesRelayed = BigInt(cursor?.cctpPayableUpdatesRelayed?.toString() ?? '0');

  // 1. Outbound Wormhole messages -> SOLANA_PAYABLE_UPDATE_VIA_WORMHOLE jobs.
  if (chain.wormholeChainId !== undefined && publishedWormhole > wormholeRelayed) {
    const delta = publishedWormhole - wormholeRelayed;
    logger.debug({ chain: chain.slug, from: wormholeRelayed, delta }, 'new Solana Wormhole messages to relay');

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

  // 2. Outbound CCTP payment messages -> SOLANA_PAYMENT_VIA_CCTP_WORMHOLE jobs.
  if (chain.circleDomain !== undefined && emittedCctpPayments > cctpPaymentsRelayed) {
    logger.debug(
      { chain: chain.slug, from: cctpPaymentsRelayed, onChain: emittedCctpPayments },
      'new Solana CCTP payments to relay'
    );
    const found = await scanAndQueueCctpPaymentJobs(chain, chains, prisma, connection);
    if (BigInt(found) >= emittedCctpPayments) {
      await prisma.chainCursor.update({
        where: { chainId: chain.cbChainId },
        data: { cctpPaymentsRelayed: emittedCctpPayments },
      });
    } else {
      logger.warn(
        { chain: chain.slug, found, onChain: emittedCctpPayments.toString() },
        'CCTP payment scan incomplete — will retry'
      );
    }
  }

  // 3. Outbound CCTP payable update messages -> SOLANA_PAYABLE_UPDATE_VIA_WORMHOLE jobs.
  if (chain.circleDomain !== undefined && emittedCctpUpdates > cctpUpdatesRelayed) {
    logger.debug(
      { chain: chain.slug, from: cctpUpdatesRelayed, onChain: emittedCctpUpdates },
      'new Solana CCTP payable updates to relay'
    );
    const found = await scanAndQueueCctpUpdateJobs(chain, chains, prisma, connection);
    if (BigInt(found) >= emittedCctpUpdates) {
      await prisma.chainCursor.update({
        where: { chainId: chain.cbChainId },
        data: { cctpPayableUpdatesRelayed: emittedCctpUpdates },
      });
    } else {
      logger.warn(
        { chain: chain.slug, found, onChain: emittedCctpUpdates.toString() },
        'CCTP update scan incomplete — will retry'
      );
    }
  }
}

/**
 * Creates SOLANA_PAYABLE_UPDATE_VIA_WORMHOLE jobs for one Wormhole sequence.
 * One job per enabled, same-network, Wormhole-capable destination chain.
 */
async function queueWormholeJob(
  chain: SolanaChainConfig,
  chains: ChainsService,
  prisma: PrismaService,
  sequence: bigint
): Promise<void> {
  const syntheticKey = `wormhole-seq-${chain.slug}-${sequence.toString()}`;

  for (const dest of chains.enabled) {
    if (dest.cbChainId === chain.cbChainId) continue;
    if (!sameNetwork(chain, dest)) continue;
    if (!dest.wormholeChainId) continue;

    const created = await createJob(prisma, {
      type: 'SOLANA_PAYABLE_UPDATE_VIA_WORMHOLE',
      sourceChainId: chain.cbChainId,
      destChainId: dest.cbChainId,
      txHash: syntheticKey,
      eventData: { sequence: sequence.toString() },
    });

    if (created > 0) {
      logger.log(
        { chain: chain.slug, dest: dest.slug, sequence: sequence.toString() },
        'queued SOLANA_PAYABLE_UPDATE_VIA_WORMHOLE'
      );
    }
  }
}

/**
 * Scans up to 100 recent program signatures for cross-chain UserPaid
 * transactions and creates SOLANA_PAYMENT_VIA_CCTP_WORMHOLE jobs.
 * Returns the number of CCTP payment transactions found.
 */
async function scanAndQueueCctpPaymentJobs(
  chain: SolanaChainConfig,
  chains: ChainsService,
  prisma: PrismaService,
  connection: Connection
): Promise<number> {
  const { PublicKey } = await import('@solana/web3.js');
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

      const hasCctpPayment = tx.meta.logMessages.some(
        (l) => l.includes('UserPaid') || l.includes('pay_foreign_via_cctp')
      );
      if (!hasCctpPayment) continue;

      found++;
      const txHash = sigInfo.signature;

      for (const dest of chains.enabled) {
        if (dest.cbChainId === chain.cbChainId) continue;
        if (!sameNetwork(chain, dest)) continue;
        if (dest.circleDomain === undefined) continue;

        const created = await createJob(prisma, {
          type: 'SOLANA_PAYMENT_VIA_CCTP_WORMHOLE',
          sourceChainId: chain.cbChainId,
          destChainId: dest.cbChainId,
          txHash,
          eventData: { signature: txHash },
        });

        if (created > 0) {
          logger.log({ chain: chain.slug, dest: dest.slug, txHash }, 'queued SOLANA_PAYMENT_VIA_CCTP_WORMHOLE');
        }
      }
    }
  } catch (err) {
    logger.error({ chain: chain.slug, err }, 'scanAndQueueCctpPaymentJobs failed');
  }

  return found;
}

/**
 * Scans up to 100 recent program signatures for payable broadcast transactions
 * and creates SOLANA_PAYABLE_UPDATE_VIA_WORMHOLE jobs (CCTP path).
 * Returns the number of broadcast transactions found.
 */
async function scanAndQueueCctpUpdateJobs(
  chain: SolanaChainConfig,
  chains: ChainsService,
  prisma: PrismaService,
  connection: Connection
): Promise<number> {
  const { PublicKey } = await import('@solana/web3.js');
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

      for (const dest of chains.enabled) {
        if (dest.cbChainId === chain.cbChainId) continue;
        if (!sameNetwork(chain, dest)) continue;
        if (dest.circleDomain === undefined) continue;

        const created = await createJob(prisma, {
          type: 'SOLANA_PAYABLE_UPDATE_VIA_WORMHOLE',
          sourceChainId: chain.cbChainId,
          destChainId: dest.cbChainId,
          txHash,
          eventData: { signature: txHash },
        });

        if (created > 0) {
          logger.log(
            { chain: chain.slug, dest: dest.slug, txHash },
            'queued SOLANA_PAYABLE_UPDATE_VIA_WORMHOLE (CCTP path)'
          );
        }
      }
    }
  } catch (err) {
    logger.error({ chain: chain.slug, err }, 'scanAndQueueCctpUpdateJobs failed');
  }

  return found;
}
