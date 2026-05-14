// ──────────────────────────────────────────────────────────────────────────────
// Chainbills Relayer — Chain Event Watcher
//
// Polls a single EVM chain for new contract events using viem getLogs().
//
// Design: polling over WebSocket subscriptions
// ─────────────────────────────────────────────
// We deliberately use getLogs() polling rather than watchContractEvent() with
// WebSockets because:
//   1. WebSocket connections from RPC providers drop silently after ~1 hour.
//   2. getLogs() with a block-cursor stored in Firestore is crash-safe:
//      on restart the relayer resumes exactly where it left off, with zero
//      missed events.
//   3. The polling interval is tuned per-chain (2s for fast chains, 12s for
//      Sepolia) so we still have near-real-time latency.
//
// Cursor persistence (/relayerCursors/{chainName}):
//   { lastIndexedBlock: number }
//   Initialized to chain.deploymentBlock (0n by default) on first run.
//   Updated atomically after every successful batch of logs is processed.
//
// Events watched per chain:
//   CreatedPayable          → index payable + queue payable update jobs
//   UserPaid                → index userPayment + (if cross-chain) queue payment job
//   PayableReceived         → index payablePayment + notify host
//   Withdrew                → index withdrawal
//   PayableUpdateBroadcasted → queue payable update relay jobs
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

// ── Event ABI fragments used in getLogs ──────────────────────────────────────
const CREATED_PAYABLE_EVENT = parseAbiItem(
  'event CreatedPayable(bytes32 indexed payableId, address indexed hostWallet, uint256 chainCount, uint256 hostCount)'
);
const USER_PAID_EVENT = parseAbiItem(
  'event UserPaid(bytes32 indexed payableId, address indexed payerWallet, bytes32 indexed paymentId, bytes32 payableChainId, uint256 chainCount, uint256 payerCount)'
);
const PAYABLE_RECEIVED_EVENT = parseAbiItem(
  'event PayableReceived(bytes32 indexed payableId, bytes32 indexed payerWallet, bytes32 indexed paymentId, bytes32 payerChainId, uint256 chainCount, uint256 payableCount)'
);
const WITHDREW_EVENT = parseAbiItem(
  'event Withdrew(bytes32 indexed payableId, address indexed hostWallet, bytes32 indexed withdrawalId, uint256 chainCount, uint256 hostCount, uint256 payableCount)'
);
const PAYABLE_UPDATE_BROADCASTED_EVENT = parseAbiItem(
  'event PayableUpdateBroadcasted(bytes32 indexed payableId, uint64 nonce, uint8 actionType)'
);

// ── Cursor helpers ────────────────────────────────────────────────────────────

async function getLastIndexedBlock(chainName: string): Promise<bigint | null> {
  const snap = await db.doc(`relayerCursors/${chainName}`).get();
  if (!snap.exists) return null;
  const { lastIndexedBlock } = snap.data()!;
  return lastIndexedBlock != null ? BigInt(lastIndexedBlock) : null;
}

async function saveLastIndexedBlock(chainName: string, block: bigint): Promise<void> {
  await db.doc(`relayerCursors/${chainName}`).set(
    {
      lastIndexedBlock: block.toString(),
      updatedAt: new Date().toISOString(),
    },
    { merge: true }
  );
}

// ── Main watcher function ─────────────────────────────────────────────────────

/**
 * Starts a polling loop for one chain. Runs indefinitely; errors are logged
 * but do not crash the process — the next tick retries automatically.
 */
export async function startChainWatcher(chain: ChainConfig): Promise<void> {
  const log = chainLogger(chain.name);
  const client = makePublicClient(chain) as PublicClient;

  // On first run, start from deploymentBlock (0n if not set).
  let fromBlock = (await getLastIndexedBlock(chain.name)) ?? chain.deploymentBlock;
  const pollMs = chain.pollIntervalMs ?? 12_000;

  log.info({ fromBlock: fromBlock.toString() }, `Starting watcher (poll every ${pollMs}ms)`);

  while (true) {
    try {
      const latestBlock = await client.getBlockNumber();

      // Nothing new since last poll.
      if (latestBlock <= fromBlock) {
        await sleep(pollMs);
        continue;
      }

      // Process at most 500 blocks per tick to avoid getLogs size limits.
      const toBlock = latestBlock < fromBlock + 500n ? latestBlock : fromBlock + 500n;

      log.debug({ fromBlock: fromBlock.toString(), toBlock: toBlock.toString() }, 'Fetching logs');

      await processBlockRange(chain, client, fromBlock + 1n, toBlock, log);

      fromBlock = toBlock;
      await saveLastIndexedBlock(chain.name, fromBlock);
    } catch (err) {
      log.error({ err }, 'Watcher tick error, will retry next poll');
    }

    await sleep(pollMs);
  }
}

// ── Log processing ────────────────────────────────────────────────────────────

async function processBlockRange(
  chain: ChainConfig,
  client: PublicClient,
  fromBlock: bigint,
  toBlock: bigint,
  log: ReturnType<typeof chainLogger>
): Promise<void> {
  const address = chain.contractAddress;

  // Fetch all watched events in parallel for efficiency.
  const [createdPayableLogs, userPaidLogs, payableReceivedLogs, withdrewLogs, broadcastedLogs] = await Promise.all([
    client.getLogs({
      address,
      event: CREATED_PAYABLE_EVENT,
      fromBlock,
      toBlock,
    }),
    client.getLogs({ address, event: USER_PAID_EVENT, fromBlock, toBlock }),
    client.getLogs({
      address,
      event: PAYABLE_RECEIVED_EVENT,
      fromBlock,
      toBlock,
    }),
    client.getLogs({ address, event: WITHDREW_EVENT, fromBlock, toBlock }),
    client.getLogs({
      address,
      event: PAYABLE_UPDATE_BROADCASTED_EVENT,
      fromBlock,
      toBlock,
    }),
  ]);

  // ── Index events ────────────────────────────────────────────────────────────
  for (const l of createdPayableLogs) {
    const { payableId } = l.args as any;
    log.info({ payableId }, 'CreatedPayable event');
    await indexPayable(chain, payableId).catch((e) => log.error({ payableId, err: e }, 'indexPayable failed'));
  }

  for (const l of userPaidLogs) {
    const { paymentId, payableChainId } = l.args as any;
    log.info({ paymentId }, 'UserPaid event');
    await indexUserPayment(chain, paymentId).catch((e) => log.error({ paymentId, err: e }, 'indexUserPayment failed'));

    // Cross-chain payment? Source chain emitted UserPaid but the payable
    // lives on a different chain → queue PAYMENT_VIA_CIRCLE job.
    if (payableChainId && payableChainId !== chain.cbChainId) {
      const destChain = chainByCbChainId.get(payableChainId);
      if (!destChain) {
        log.warn({ payableChainId }, 'Unknown payableChainId — cannot queue payment job');
        continue;
      }
      const alreadyQueued = await jobExistsForTx(l.transactionHash!, destChain.name);
      if (!alreadyQueued) {
        await createJob({
          type: 'PAYMENT_VIA_CIRCLE',
          sourceChain: chain.name,
          destChain: destChain.name,
          txHash: l.transactionHash!,
          blockNumber: Number(l.blockNumber),
          eventData: {
            paymentId,
            payableChainId,
          },
        });
        log.info({ paymentId, destChain: destChain.name }, 'Queued PAYMENT_VIA_CIRCLE job');
      }
    }
  }

  for (const l of payableReceivedLogs) {
    const { paymentId, payableId } = l.args as any;
    log.info({ paymentId }, 'PayableReceived event');
    try {
      await indexPayablePayment(chain, paymentId);
      // Fetch token name + amount for FCM notification.
      const pclient = makePublicClient(chain);
      const raw: any = await pclient.readContract({
        address: chain.gettersAddress,
        abi: gettersAbi,
        functionName: 'getPayablePayment',
        args: [paymentId],
      });
      const { name: tokenName, decimals } = resolveToken((raw.token as string).toLowerCase(), chain.name);
      const amount = Number(raw.amount) / 10 ** decimals;
      await notifyPaymentReceived(
        (payableId as string).toLowerCase(),
        (paymentId as string).toLowerCase(),
        tokenName,
        amount
      );
    } catch (e) {
      log.error({ paymentId, err: e }, 'PayableReceived processing failed');
    }
  }

  for (const l of withdrewLogs) {
    const { withdrawalId } = l.args as any;
    log.info({ withdrawalId }, 'Withdrew event');
    await indexWithdrawal(chain, withdrawalId).catch((e) =>
      log.error({ withdrawalId, err: e }, 'indexWithdrawal failed')
    );
  }

  // ── Queue relay jobs for PayableUpdateBroadcasted ───────────────────────────
  for (const l of broadcastedLogs) {
    const { payableId } = l.args as any;
    log.info({ payableId }, 'PayableUpdateBroadcasted event');

    // Fan-out: create one job per registered foreign chain.
    for (const destChain of ALL_CHAINS) {
      if (destChain.name === chain.name) continue;

      const alreadyQueued = await jobExistsForTx(l.transactionHash!, destChain.name);
      if (alreadyQueued) continue;

      // Determine protocol
      const bothWormhole = chain.hasWormhole && destChain.hasWormhole;
      const bothCctp = chain.hasCctp && destChain.hasCctp;

      if (bothWormhole) {
        await createJob({
          type: 'PAYABLE_UPDATE_VIA_WORMHOLE',
          sourceChain: chain.name,
          destChain: destChain.name,
          txHash: l.transactionHash!,
          blockNumber: Number(l.blockNumber),
          eventData: { payableId },
        });
        log.info({ payableId, destChain: destChain.name }, 'Queued PAYABLE_UPDATE_VIA_WORMHOLE');
      } else if (bothCctp) {
        await createJob({
          type: 'PAYABLE_UPDATE_VIA_CCTP',
          sourceChain: chain.name,
          destChain: destChain.name,
          txHash: l.transactionHash!,
          blockNumber: Number(l.blockNumber),
          eventData: { payableId },
        });
        log.info({ payableId, destChain: destChain.name }, 'Queued PAYABLE_UPDATE_VIA_CCTP');
      } else {
        log.warn(
          { payableId, sourceChain: chain.name, destChain: destChain.name },
          'No common protocol between source and dest chains — manual adminSyncForeignPayable required'
        );
      }
    }
  }
}

function sleep(ms: number): Promise<void> {
  return new Promise((r) => setTimeout(r, ms));
}
