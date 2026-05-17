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
import { getContract } from 'viem';
import type { ChainConfig } from './chains.js';
import { chainByCbChainId } from './chains.js';
import { gettersAbi } from './utils/abis.js';
import { makePublicClient } from './utils/clients.js';
import { denormalizeBytes, stripPrefix } from './utils/encoding.js';
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
 * Returns a typed viem contract instance bound to the CbGetters ABI and the
 * given chain's getters address. All `.read` methods are fully typed by viem's
 * ABI inference — no `any` casts needed at call sites.
 */
function makeGettersContract(chain: ChainConfig) {
  return getContract({
    address: chain.gettersAddress,
    abi: gettersAbi,
    client: makePublicClient(chain),
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
  try {
    const contract = makeGettersContract(chain);
    const { host, chainCount, hostCount, createdAt } = await contract.read.getPayable([payableId]);

    const data = {
      id: payableId,
      chainName: chain.name,
      chainNetworkType: chain.wormholeNetwork === 'Mainnet' ? 'mainnet' : 'testnet',
      host,
      chainCount: Number(chainCount),
      hostCount: Number(hostCount),
      createdAt: Timestamp.fromMillis(Number(createdAt) * 1000),
      indexedAt: Timestamp.now(),
    };
    await writeToDb(`payables/${payableId}`, `chains/${chain.name}/payables/${payableId}`, data);

    logger.info({ chain: chain.name, payableId: payableId }, 'Indexed payable');
  } catch (err) {
    logger.error({ chain: chain.name, payableId: payableId, err }, 'Failed to index payable');
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
  try {
    const contract = makeGettersContract(chain);
    const { payer, payerCount, payableId, payableChainId, chainCount, token, amount, timestamp } =
      await contract.read.getUserPayment([paymentId]);

    // Resolve CAIP-2 payableChainId → chain name for the Firestore record.
    const payableChain = chainByCbChainId.get(payableChainId);
    const payableChainName = payableChain?.name ?? payableChainId;
    const { name: tokenName, decimals } = resolveToken(token, chain.name);

    const data = {
      id: paymentId,
      chainName: chain.name,
      chainNetworkType: chain.wormholeNetwork === 'Mainnet' ? 'mainnet' : 'testnet',
      payer,
      payerCount: Number(payerCount),
      payableId,
      payableChainName,
      chainCount: Number(chainCount),
      token: tokenName,
      amount: Number(amount) / 10 ** decimals,
      timestamp: Timestamp.fromMillis(Number(timestamp) * 1000),
      indexedAt: Timestamp.now(),
    };

    await writeToDb(`userPayments/${paymentId}`, `chains/${chain.name}/userPayments/${paymentId}`, data);

    logger.info({ chain: chain.name, paymentId }, 'Indexed userPayment');
  } catch (err) {
    logger.error({ chain: chain.name, paymentId, err }, 'Failed to index userPayment');
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
  try {
    const contract = makeGettersContract(chain);
    const {
      amount,
      payer: payerRaw,
      payerChainId,
      payableId,
      payableCount,
      localChainCount,
      chainCount,
      token,
      timestamp,
    } = await contract.read.getPayablePayment([paymentId]);

    // Resolve payer's chain
    const payerChain = chainByCbChainId.get(payerChainId);
    if (!payerChain) throw new Error(`Unknown cbChainId: ${payerChainId}`);
    const { name: tokenName, decimals } = resolveToken(token, chain.name);

    // Denormalize payer: strip leading zeros from Wormhole-padded bytes32 in EVM, convert for others.
    const strippedPayer = stripPrefix('0x', payerRaw);
    const payer = payerChain.isEvm
      ? '0x' + strippedPayer.replace(/^0+/, '')
      : denormalizeBytes(Uint8Array.from(Buffer.from(strippedPayer, chain.isEvm ? 'hex' : undefined)), payerChain);

    const data = {
      id: paymentId,
      chainName: chain.name,
      chainNetworkType: chain.wormholeNetwork === 'Mainnet' ? 'mainnet' : 'testnet',
      payableId,
      payer,
      payerChainName: payerChain.name,
      payableCount: Number(payableCount),
      localChainCount: Number(localChainCount),
      chainCount: Number(chainCount),
      token: tokenName,
      amount: Number(amount) / 10 ** decimals,
      timestamp: Timestamp.fromMillis(Number(timestamp) * 1000),
      indexedAt: Timestamp.now(),
    };

    await writeToDb(`payablePayments/${paymentId}`, `chains/${chain.name}/payablePayments/${paymentId}`, data);

    logger.info({ chain: chain.name, paymentId }, 'Indexed payablePayment');
  } catch (err) {
    logger.error({ chain: chain.name, paymentId, err }, 'Failed to index payablePayment');
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
  const id = withdrawalId;
  try {
    const contract = makeGettersContract(chain);
    const raw = await contract.read.getWithdrawal([withdrawalId]);

    const { name: tokenName, decimals } = resolveToken(raw.token, chain.name);

    const data = {
      id,
      chainName: chain.name,
      chainNetworkType: chain.wormholeNetwork === 'Mainnet' ? 'mainnet' : 'testnet',
      payableId: raw.payableId,
      host: raw.host,
      chainCount: Number(raw.chainCount),
      hostCount: Number(raw.hostCount),
      payableCount: Number(raw.payableCount),
      token: tokenName,
      amount: Number(raw.amount) / 10 ** decimals,
      timestamp: Timestamp.fromMillis(Number(raw.timestamp) * 1000),
      indexedAt: Timestamp.now(),
    };

    await writeToDb(`withdrawals/${withdrawalId}`, `chains/${chain.name}/withdrawals/${withdrawalId}`, data);

    logger.info({ chain: chain.name, withdrawalId }, 'Indexed withdrawal');
  } catch (err) {
    logger.error({ chain: chain.name, withdrawalId, err }, 'Failed to index withdrawal');
    throw err;
  }
}
