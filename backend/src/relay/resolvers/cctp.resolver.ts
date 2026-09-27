// ──────────────────────────────────────────────────────────────────────────────
// Chainbills Backend — Circle CCTP V2 attestation resolver
//
// Circle's Iris v2 API accepts message lookups by `transactionHash` or `nonce`
// only — sender-address and message-body-hash filters are rejected outright.
// The relay processor therefore needs a source tx hash before calling here,
// which it obtains either from a frontend nudge (RelayTxHint) or from a
// timestamp-narrowed getLogs fallback.
//
// API hosts (by network):
//   mainnet  https://iris-api.circle.com
//   testnet  https://iris-api-sandbox.circle.com
//   local    https://iris-api-sandbox.circle.com  (same sandbox)
//
// On a non-complete status the caller retries the job later.
// ──────────────────────────────────────────────────────────────────────────────

import { Logger } from '@nestjs/common';
import type { Network } from '../../chains/types';

const logger = new Logger('CctpResolver');

function baseUrl(network: Network): string {
  return network === 'mainnet' ? 'https://iris-api.circle.com' : 'https://iris-api-sandbox.circle.com';
}

/** A resolved CCTP V2 message + attestation pair. */
export interface CctpAttestation {
  /** Hex-encoded CCTP V2 message bytes. */
  message: string;
  /** Hex-encoded CCTP V2 attestation. */
  attestation: string;
}

/**
 * Fetches the CCTP V2 message and attestation for a source-chain transaction.
 * Filters messages by `destinationDomain` so each per-destination job gets
 * only the message that belongs to it.
 *
 * @param network            Chain network (selects mainnet vs sandbox API).
 * @param sourceDomain       Circle uint32 domain of the source chain.
 * @param txHash             Source transaction hash.
 * @param destinationDomain  Circle uint32 domain of the destination chain.
 * @returns                  The matching (message, attestation) pair, or null
 *                           when not yet complete (caller should retry later).
 */
export async function fetchCctpAttestation(
  network: Network,
  sourceDomain: number,
  txHash: string,
  destinationDomain: number
): Promise<CctpAttestation | null> {
  const url = `${baseUrl(network)}/v2/messages/${sourceDomain}?transactionHash=${txHash}`;

  logger.log({ sourceDomain, txHash, destinationDomain, network }, 'fetching CCTP attestation');
  try {
    const res = await fetch(url);

    if (!res.ok) {
      logger.warn({ sourceDomain, txHash, status: res.status }, 'Iris API non-200 response');
      return null;
    }

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const body = (await res.json()) as any;
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const messages: any[] = body?.messages ?? [];

    // Iris v2 nests `destinationDomain` under `decodedMessage` and encodes it
    // as a string, not the top-level number we naively compared to before.
    // Match on both fields (string + numeric) so a future response shape
    // change on Circle's side doesn't silently break the resolver again.
    const wantDomain = String(destinationDomain);
    const match = messages.find(
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      (m: any) =>
        (m?.decodedMessage?.destinationDomain === wantDomain ||
          Number(m?.decodedMessage?.destinationDomain) === destinationDomain) &&
        m?.status === 'complete' &&
        m.message &&
        m.attestation
    );

    if (!match) {
      logger.log({ sourceDomain, txHash, destinationDomain }, 'CCTP attestation not ready yet');
      return null;
    }

    logger.log({ sourceDomain, txHash, destinationDomain }, 'CCTP attestation ready');
    return { message: match.message as string, attestation: match.attestation as string };
  } catch (err) {
    logger.warn({ sourceDomain, txHash, err }, 'Iris API request failed');
    return null;
  }
}
