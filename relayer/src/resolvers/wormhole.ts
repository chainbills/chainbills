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

import { serialize, wormhole, type Network, type TxHash } from '@wormhole-foundation/sdk';
import evm from '@wormhole-foundation/sdk/evm';
import type { ChainConfig } from '../chains.js';
import { logger } from '../utils/logger.js';

// ── WormholeScan base URLs ─────────────────────────────────────────────────────
const SCAN_TESTNET = 'https://api.testnet.wormholescan.io';
const SCAN_MAINNET = 'https://api.wormholescan.io';

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
/**
 * Fetches a signed VAA from WormholeScan by Wormhole sequence number.
 *
 * Used by the count-based watcher when publishedWormholeMessagesCount increases.
 * The emitter is the Chainbills proxy address (left-padded to 32 bytes).
 *
 * @param chain     Source chain config (must have hasWormhole=true).
 * @param sequence  0-indexed Wormhole message sequence for this emitter.
 * @param maxAttempts  Number of polling rounds (3s apart). Default ≈ 1 min.
 */
export async function getVaaBySequence(
  chain: ChainConfig,
  sequence: number,
  maxAttempts = 20
): Promise<Uint8Array | null> {
  if (!chain.hasWormhole || chain.wormholeChainId === undefined) {
    logger.warn({ chain: chain.name }, 'getVaaBySequence called on chain without Wormhole');
    return null;
  }

  const baseUrl = chain.wormholeNetwork === 'Mainnet' ? SCAN_MAINNET : SCAN_TESTNET;
  // EVM emitter: contract address left-padded to 32 bytes (64 hex chars, no 0x prefix).
  const emitter = chain.contractAddress.replace(/^0x/i, '').padStart(64, '0');
  const url = `${baseUrl}/api/v1/vaas/${chain.wormholeChainId}/${emitter}/${sequence}`;

  for (let attempt = 0; attempt < maxAttempts; attempt++) {
    try {
      const res = await fetch(url);
      if (res.status === 404) {
        // Guardians haven't signed yet — retry.
        await sleep(3000);
        continue;
      }
      if (!res.ok) {
        logger.warn({ url, status: res.status, attempt }, 'WormholeScan API error');
        await sleep(3000);
        continue;
      }
      const body = (await res.json()) as any;
      const b64: string | undefined = body?.data?.vaa;
      if (!b64) {
        await sleep(3000);
        continue;
      }
      const bytes = Buffer.from(b64, 'base64');
      logger.info({ chain: chain.name, sequence, attempt: attempt + 1 }, 'Fetched VAA by sequence');
      return new Uint8Array(bytes);
    } catch (err) {
      logger.warn({ url, err, attempt }, 'WormholeScan request failed — retrying');
      await sleep(3000);
    }
  }

  logger.error({ chain: chain.name, sequence, maxAttempts }, 'VAA not available after max attempts');
  return null;
}

function sleep(ms: number): Promise<void> {
  return new Promise((r) => setTimeout(r, ms));
}

export async function getVaa(chain: ChainConfig, txHash: string, timeoutMs = 180_000): Promise<Uint8Array | null> {
  if (!chain.hasWormhole) {
    logger.warn({ chain: chain.name }, 'getVaa called on chain without Wormhole support');
    return null;
  }

  try {
    const wh = await getSdk(chain.wormholeNetwork);
    const vaa = await wh.getVaa(txHash as TxHash, 'Uint8Array', timeoutMs);
    if (!vaa) return null;
    logger.info({ chain: chain.name, txHash }, 'Fetched Wormhole VAA');
    return serialize(vaa);
  } catch (err) {
    logger.error({ chain: chain.name, txHash, err }, 'Failed to fetch Wormhole VAA');
    return null;
  }
}
