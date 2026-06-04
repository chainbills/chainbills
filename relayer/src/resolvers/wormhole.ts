// ──────────────────────────────────────────────────────────────────────────────
// Chainbills Relayer — Wormhole VAA Resolver
//
// Fetches signed VAAs from WormholeScan using direct HTTP — no SDK required.
// Two entry points:
//   getVaaBySequence — used by the count-based watcher (sequence known upfront)
//   getVaaByTxHash  — used by the job processor for legacy/payment jobs
// ──────────────────────────────────────────────────────────────────────────────

import type { ChainConfig } from '../chains.js';
import { logger } from '../utils/logger.js';

const SCAN_TESTNET = 'https://api.testnet.wormholescan.io';
const SCAN_MAINNET = 'https://api.wormholescan.io';

const getBaseUrl = (chainType: 'mainnet' | 'testnet') =>
  `https://api.${chainType === 'testnet' ? 'testnet.' : ''}wormholescan.io`;

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

  const contractAddress = (chain as any).contractAddress as string | undefined;
  const emitter = (contractAddress ?? '').replace(/^0x/i, '').padStart(64, '0');
  const url = `${getBaseUrl(chain.network)}/api/v1/vaas/${chain.wormholeChainId}/${emitter}/${sequence}`;
  for (let attempt = 0; attempt < maxAttempts; attempt++) {
    try {
      const res = await fetch(url);
      if (res.status === 404) {
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

/**
 * Fetches a signed VAA from WormholeScan by source-chain transaction hash.
 *
 * Used by the job processor for legacy PAYABLE_UPDATE jobs and PAYMENT_VIA_CCTP_WORMHOLE jobs.
 * Returns the first VAA emitted by this chain in that transaction.
 *
 * @param chain        Source chain config (must have hasWormhole=true).
 * @param txHash       Transaction hash on the source chain.
 * @param maxAttempts  Number of polling rounds (3s apart). Default ≈ 2 min.
 */
export async function getVaaByTxHash(chain: ChainConfig, txHash: string, maxAttempts = 40): Promise<Uint8Array | null> {
  if (!chain.hasWormhole || chain.wormholeChainId === undefined) {
    logger.warn({ chain: chain.name }, 'getVaaByTxHash called on chain without Wormhole');
    return null;
  }

  const url = `${getBaseUrl(chain.network)}/api/v1/vaas?txHash=${txHash}`;
  for (let attempt = 0; attempt < maxAttempts; attempt++) {
    try {
      const res = await fetch(url);
      if (res.status === 404) {
        await sleep(3000);
        continue;
      }
      if (!res.ok) {
        logger.warn({ url, status: res.status, attempt }, 'WormholeScan API error');
        await sleep(3000);
        continue;
      }
      const body = (await res.json()) as any;
      const entries: any[] = Array.isArray(body?.data) ? body.data : [];
      const entry = entries.find((e: any) => e.emitterChain === chain.wormholeChainId) ?? entries[0];
      const b64: string | undefined = entry?.vaa;
      if (!b64) {
        await sleep(3000);
        continue;
      }
      const bytes = Buffer.from(b64, 'base64');
      logger.info({ chain: chain.name, txHash, attempt: attempt + 1 }, 'Fetched VAA by txHash');
      return new Uint8Array(bytes);
    } catch (err) {
      logger.warn({ url, err, attempt }, 'WormholeScan request failed — retrying');
      await sleep(3000);
    }
  }

  logger.error({ chain: chain.name, txHash, maxAttempts }, 'VAA not available after max attempts');
  return null;
}

function sleep(ms: number): Promise<void> {
  return new Promise((r) => setTimeout(r, ms));
}
