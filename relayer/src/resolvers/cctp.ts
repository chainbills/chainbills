// ──────────────────────────────────────────────────────────────────────────────
// Chainbills Relayer — Circle CCTP Attestation Resolver
//
// Polls Circle's Iris API until the attestation for a given CCTP burn
// transaction is ready. The attestation is required to call receiveMessage()
// (or its Chainbills wrapper) on the destination chain.
//
// API reference:
//   Testnet: https://iris-api-sandbox.circle.com/v2/messages/{srcDomain}?transactionHash={hash}
//   Mainnet: https://iris-api.circle.com/v2/messages/{srcDomain}?transactionHash={hash}
//
// Attestation polling details:
//   - Circle typically finalizes within 30–90 seconds on testnet.
//   - The relayer polls every POLL_INTERVAL_MS (3 seconds default here).
//   - After maxAttempts (60 = ~3 minutes) the call throws and the job
//     is retried from its last PROCESSING state on the next processor run.
// ──────────────────────────────────────────────────────────────────────────────

import type { ChainConfig } from '../chains/index.js';
import { logger } from '../utils/logger.js';

export interface CctpAttestation {
  /** Hex-encoded CCTP message bytes. */
  message: string;
  /** Hex-encoded CCTP attestation (Guardian signatures). */
  attestation: string;
}

/**
 * Polls the Circle Iris API until the attestation for a given source-chain
 * transaction is complete, then returns the (message, attestation) pair.
 *
 * @param chain        Source chain config (must have hasCctp=true and circleDomain set).
 * @param txHash       Transaction hash of the depositForBurn / sendMessage tx.
 * @param maxAttempts  Max number of poll rounds (default 60 = ~3 min at 3s intervals).
 */
export async function waitForAttestation(
  chain: ChainConfig,
  txHash: string,
  maxAttempts = 60
): Promise<CctpAttestation> {
  const sourceDomain = chain.circleDomain;
  const baseUrl =
    chain.cctpNetwork === 'Mainnet' ? 'https://iris-api.circle.com' : 'https://iris-api-sandbox.circle.com';

  const url = `${baseUrl}/v2/messages/${sourceDomain}?transactionHash=${txHash}`;

  for (let i = 0; i < maxAttempts; i++) {
    try {
      const res = await fetch(url);
      if (!res.ok) {
        logger.warn({ sourceDomain, txHash, status: res.status }, 'Iris API non-200 response');
        await sleep(3000);
        continue;
      }

      const body = (await res.json()) as any;
      const msg = body?.messages?.[0];

      if (msg?.status === 'complete' && msg.attestation && msg.message) {
        logger.info({ sourceDomain, txHash, attempt: i + 1 }, 'CCTP attestation ready');
        return { message: msg.message, attestation: msg.attestation };
      }

      logger.debug(
        { sourceDomain, txHash, status: msg?.status ?? 'unknown', attempt: i + 1 },
        'Attestation not ready yet, waiting…'
      );
    } catch (err) {
      logger.warn({ sourceDomain, txHash, err }, 'Iris API request failed, retrying…');
    }

    await sleep(3000);
  }

  throw new Error(`CCTP attestation timeout after ${maxAttempts} attempts for txHash=${txHash} domain=${sourceDomain}`);
}

function sleep(ms: number): Promise<void> {
  return new Promise((r) => setTimeout(r, ms));
}
