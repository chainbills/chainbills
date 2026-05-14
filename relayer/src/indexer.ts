// ──────────────────────────────────────────────────────────────────────────────
// Chainbills Relayer — Firestore Indexer
//
// Writes indexed entities to Firestore after observing on-chain events.
//
// Write strategy — ALL writes use { merge: true }:
//   • The relayer writes immutable on-chain data (host, chainCount, amounts, …).
//   • The server's POST /payable writes the host-provided description field.
//   • Whichever lands first, the merge ensures neither overwrites the other.
//
// Firestore paths:
//   Top-level:              /payables/{id}        (includes chainName field)
//   Chain subcollection:    /chains/{chainName}/payables/{id}
//
//   Top-level:              /userPayments/{id}
//   Chain subcollection:    /chains/{chainName}/userPayments/{id}
//
//   Top-level:              /payablePayments/{id}
//   Chain subcollection:    /chains/{chainName}/payablePayments/{id}
//
//   Top-level:              /withdrawals/{id}
//   Chain subcollection:    /chains/{chainName}/withdrawals/{id}
//
// Writes are made to BOTH paths simultaneously (Promise.all) so that
// queries can be made either globally or scoped to a chain.
// ──────────────────────────────────────────────────────────────────────────────

import { Timestamp } from 'firebase-admin/firestore';
import type { ChainConfig } from './chains.js';
import { chainByCbChainId } from './chains.js';
import { gettersAbi } from './utils/abis.js';
import { makePublicClient } from './utils/clients.js';
import { db } from './utils/firebase.js';
import { logger } from './utils/logger.js';
import { resolveToken } from './utils/tokens.js';

// ── Internal helpers ──────────────────────────────────────────────────────────

/**
 * Writes `data` to both the top-level collection and the chain subcollection
 * using { merge: true } on both.
 */
async function writeToDb(topPath: string, chainPath: string, data: Record<string, unknown>): Promise<void> {
  const topRef = db.doc(topPath);
  const chainRef = db.doc(chainPath);
  await Promise.all([topRef.set(data, { merge: true }), chainRef.set(data, { merge: true })]);
}

/**
 * Reads on-chain data for a given entity via the CbGetters contract.
 * This is the same pattern as server/utils/evm.ts evmFetch().
 */
async function fetchOnChain(chain: ChainConfig, functionName: string, id: `0x${string}`): Promise<unknown> {
  const client = makePublicClient(chain);
  return await client.readContract({
    address: chain.gettersAddress,
    abi: gettersAbi,
    functionName: functionName as any,
    args: [id],
  });
}

// ── Public indexer functions ──────────────────────────────────────────────────

/**
 * Indexes a newly created payable.
 * Called when CreatedPayable event is detected on a chain.
 *
 * Fetches full data from CbGetters and writes to:
 *   /payables/{payableId}                     (top-level, includes chainName)
 *   /chains/{chainName}/payables/{payableId}  (chain subcollection)
 */
export async function indexPayable(chain: ChainConfig, payableId: `0x${string}`): Promise<void> {
  const id = payableId.toLowerCase();
  try {
    const raw: any = await fetchOnChain(chain, 'getPayable', payableId);

    const data = {
      id,
      chainName: chain.name,
      chainNetworkType: chain.wormholeNetwork === 'Mainnet' ? 'mainnet' : 'testnet',
      host: (raw.host as string).toLowerCase(),
      chainCount: Number(raw.chainCount),
      hostCount: Number(raw.hostCount),
      createdAt: Timestamp.fromMillis(Number(raw.createdAt) * 1000),
      indexedAt: Timestamp.now(),
    };

    await writeToDb(`payables/${id}`, `chains/${chain.name}/payables/${id}`, data);

    logger.info({ chain: chain.name, payableId: id }, 'Indexed payable');
  } catch (err) {
    logger.error({ chain: chain.name, payableId: id, err }, 'Failed to index payable');
    throw err;
  }
}

/**
 * Indexes a user payment (the payer's receipt).
 * Called when UserPaid event is detected on a chain.
 *
 * Fetches full data from CbGetters and writes to:
 *   /userPayments/{paymentId}
 *   /chains/{chainName}/userPayments/{paymentId}
 */
export async function indexUserPayment(chain: ChainConfig, paymentId: `0x${string}`): Promise<void> {
  const id = paymentId.toLowerCase();
  try {
    const raw: any = await fetchOnChain(chain, 'getUserPayment', paymentId);

    // Resolve CAIP-2 payableChainId → chain name for the Firestore record.
    const payableChain = chainByCbChainId.get(raw.payableChainId as string);
    const payableChainName = payableChain?.name ?? raw.payableChainId;

    const { name: tokenName, decimals } = resolveToken((raw.token as string).toLowerCase(), chain.name);

    const data = {
      id,
      chainName: chain.name,
      chainNetworkType: chain.wormholeNetwork === 'Mainnet' ? 'mainnet' : 'testnet',
      payer: (raw.payer as string).toLowerCase(),
      payerCount: Number(raw.payerCount),
      payableId: (raw.payableId as string).toLowerCase(),
      payableChainName,
      chainCount: Number(raw.chainCount),
      token: tokenName,
      amount: Number(raw.amount) / 10 ** decimals,
      timestamp: Timestamp.fromMillis(Number(raw.timestamp) * 1000),
      indexedAt: Timestamp.now(),
    };

    await writeToDb(`userPayments/${id}`, `chains/${chain.name}/userPayments/${id}`, data);

    logger.info({ chain: chain.name, paymentId: id }, 'Indexed userPayment');
  } catch (err) {
    logger.error({ chain: chain.name, paymentId: id, err }, 'Failed to index userPayment');
    throw err;
  }
}

/**
 * Indexes a payable payment (the payable's receipt).
 * Called when PayableReceived event is detected on a chain.
 *
 * Fetches full data from CbGetters and writes to:
 *   /payablePayments/{paymentId}
 *   /chains/{chainName}/payablePayments/{paymentId}
 */
export async function indexPayablePayment(chain: ChainConfig, paymentId: `0x${string}`): Promise<void> {
  const id = paymentId.toLowerCase();
  try {
    const raw: any = await fetchOnChain(chain, 'getPayablePayment', paymentId);

    // Resolve payer's chain
    const payerChain = chainByCbChainId.get(raw.payerChainId as string);
    const payerChainName = payerChain?.name ?? raw.payerChainId;

    const { name: tokenName, decimals } = resolveToken((raw.token as string).toLowerCase(), chain.name);

    // Denormalize payer: strip leading zeros from Wormhole-padded bytes32
    const payerRaw = raw.payer as string;
    const payerAddr =
      payerChain?.name === chain.name ? '0x' + payerRaw.replace(/^0x/, '').replace(/^0+/, '') : payerRaw; // keep raw bytes32 for cross-chain payers

    const data = {
      id,
      chainName: chain.name,
      chainNetworkType: chain.wormholeNetwork === 'Mainnet' ? 'mainnet' : 'testnet',
      payableId: (raw.payableId as string).toLowerCase(),
      payer: payerAddr.toLowerCase(),
      payerChainName,
      payableCount: Number(raw.payableCount),
      localChainCount: Number(raw.localChainCount),
      chainCount: Number(raw.chainCount),
      token: tokenName,
      amount: Number(raw.amount) / 10 ** decimals,
      timestamp: Timestamp.fromMillis(Number(raw.timestamp) * 1000),
      indexedAt: Timestamp.now(),
    };

    await writeToDb(`payablePayments/${id}`, `chains/${chain.name}/payablePayments/${id}`, data);

    logger.info({ chain: chain.name, paymentId: id }, 'Indexed payablePayment');
  } catch (err) {
    logger.error({ chain: chain.name, paymentId: id, err }, 'Failed to index payablePayment');
    throw err;
  }
}

/**
 * Indexes a withdrawal.
 * Called when Withdrew event is detected on a chain.
 *
 * Fetches full data from CbGetters and writes to:
 *   /withdrawals/{withdrawalId}
 *   /chains/{chainName}/withdrawals/{withdrawalId}
 */
export async function indexWithdrawal(chain: ChainConfig, withdrawalId: `0x${string}`): Promise<void> {
  const id = withdrawalId.toLowerCase();
  try {
    const raw: any = await fetchOnChain(chain, 'getWithdrawal', withdrawalId);

    const { name: tokenName, decimals } = resolveToken((raw.token as string).toLowerCase(), chain.name);

    const data = {
      id,
      chainName: chain.name,
      chainNetworkType: chain.wormholeNetwork === 'Mainnet' ? 'mainnet' : 'testnet',
      payableId: (raw.payableId as string).toLowerCase(),
      host: (raw.host as string).toLowerCase(),
      chainCount: Number(raw.chainCount),
      hostCount: Number(raw.hostCount),
      payableCount: Number(raw.payableCount),
      token: tokenName,
      amount: Number(raw.amount) / 10 ** decimals,
      timestamp: Timestamp.fromMillis(Number(raw.timestamp) * 1000),
      indexedAt: Timestamp.now(),
    };

    await writeToDb(`withdrawals/${id}`, `chains/${chain.name}/withdrawals/${id}`, data);

    logger.info({ chain: chain.name, withdrawalId: id }, 'Indexed withdrawal');
  } catch (err) {
    logger.error({ chain: chain.name, withdrawalId: id, err }, 'Failed to index withdrawal');
    throw err;
  }
}
