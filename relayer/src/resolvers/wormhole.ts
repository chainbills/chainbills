// ──────────────────────────────────────────────────────────────────────────────
// Chainbills Relayer — Wormhole VAA Resolver
//
// Uses @wormhole-foundation/sdk (v1.x, the modern replacement for the
// deprecated relayer-engine) to fetch signed VAAs from the Wormhole Guardian
// network for a given source transaction.
//
// A single Wormhole SDK instance is created per unique network type
// (Testnet / Mainnet) so the relayer can handle both concurrently.
// ──────────────────────────────────────────────────────────────────────────────

import { serialize, wormhole, type Network } from '@wormhole-foundation/sdk';
import evm from '@wormhole-foundation/sdk/evm';
import type { ChainConfig } from '../chains/index.js';
import { logger } from '../utils/logger.js';

// ── SDK instances (one per Wormhole network environment) ─────────────────────
// Lazy-initialized on first use. We store them in a map keyed by network.
const sdkInstances = new Map<Network, Awaited<ReturnType<typeof wormhole>>>();

async function getSdk(network: Network) {
  if (!sdkInstances.has(network)) {
    const wh = await wormhole(network, [evm]);
    sdkInstances.set(network, wh);
  }
  return sdkInstances.get(network)!;
}

/**
 * Fetches the signed VAA for a Wormhole message published in a given tx.
 *
 * @param chain     The source chain config (must have hasWormhole=true).
 * @param txHash    The transaction hash on the source chain.
 * @param timeoutMs Maximum time to wait for Guardians to sign (default 3 min).
 * @returns         The signed VAA as a Uint8Array, or null if timeout.
 *
 * Note: Wormhole VAAs do not expire, so even if this call fails the job
 * will be retried and the VAA will still be fetchable.
 */
export async function getVaa(chain: ChainConfig, txHash: string, timeoutMs = 180_000): Promise<Uint8Array | null> {
  if (!chain.hasWormhole) {
    logger.warn({ chain: chain.name }, 'getVaa called on chain without Wormhole support');
    return null;
  }

  try {
    const wh = await getSdk(chain.wormholeNetwork);
    const vaa = await wh.getVaa(txHash as any, 'Uint8Array', timeoutMs);
    if (!vaa) return null;
    logger.info({ chain: chain.name, txHash }, 'Fetched Wormhole VAA');
    return serialize(vaa);
  } catch (err) {
    logger.error({ chain: chain.name, txHash, err }, 'Failed to fetch Wormhole VAA');
    return null;
  }
}
