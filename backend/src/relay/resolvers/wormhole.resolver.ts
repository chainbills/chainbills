// ──────────────────────────────────────────────────────────────────────────────
// Chainbills Backend — Wormhole VAA resolver
//
// Fetches signed VAAs from WormholeScan by (chain id, emitter, sequence).
// The emitter is the diamond address, left-padded to 32 bytes.
//
// API hosts (by network):
//   mainnet  https://api.wormholescan.io
//   testnet  https://api.testnet.wormholescan.io
//   local    https://api.testnet.wormholescan.io  (same sandbox)
//
// On 404 the VAA is not yet available — the caller retries the job later.
// Non-404 errors are logged as warnings and treated as retryable.
// ──────────────────────────────────────────────────────────────────────────────

import { Logger } from '@nestjs/common';
import type { Network } from '../../chains/types';

const logger = new Logger('WormholeResolver');

function baseUrl(network: Network): string {
  return network === 'mainnet' ? 'https://api.wormholescan.io' : 'https://api.testnet.wormholescan.io';
}

/**
 * Fetches one signed VAA from WormholeScan.
 *
 * @param network          Chain network (selects mainnet vs sandbox API).
 * @param wormholeChainId  Wormhole uint16 chain id of the source chain.
 * @param diamondAddress   EVM address of the diamond (0x-prefixed). Padded to 32 bytes as the emitter.
 * @param sequence         Wormhole sequence number of the message.
 * @returns                Raw VAA bytes, or null when the VAA is not yet available (caller should retry).
 */
export async function fetchVaa(
  network: Network,
  wormholeChainId: number,
  diamondAddress: string,
  sequence: bigint
): Promise<Uint8Array | null> {
  const emitter = diamondAddress.replace(/^0x/i, '').toLowerCase().padStart(64, '0');
  const url = `${baseUrl(network)}/api/v1/vaas/${wormholeChainId}/${emitter}/${sequence.toString()}`;

  try {
    const res = await fetch(url);

    if (res.status === 404) {
      // VAA not yet available; caller retries on the next processor tick.
      return null;
    }

    if (!res.ok) {
      logger.warn({ url, status: res.status }, 'WormholeScan API non-200 response');
      return null;
    }

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const body = (await res.json()) as any;
    const b64: string | undefined = body?.data?.vaa;

    if (!b64) {
      // Body was 200 but no VAA in the payload yet.
      return null;
    }

    const bytes = Buffer.from(b64, 'base64');
    logger.debug({ wormholeChainId, sequence: sequence.toString() }, 'fetched VAA');
    return new Uint8Array(bytes);
  } catch (err) {
    logger.warn({ url, err }, 'WormholeScan request failed');
    return null;
  }
}
