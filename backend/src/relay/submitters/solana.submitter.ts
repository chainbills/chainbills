// ──────────────────────────────────────────────────────────────────────────────
// Chainbills Backend — Solana relay submitter
//
// Submits Solana transactions to finalise cross-chain receives:
//   SOLANA_PAYMENT_VIA_CCTP_WORMHOLE:
//     1. Post VAA (Wormhole SDK required — stubbed with a clear error).
//     2. recv_payment_via_cctp_wormhole with the PostedVAA + CCTP attestation.
//   SOLANA_PAYABLE_UPDATE_VIA_WORMHOLE:
//     recv_payable_update_via_wormhole with the PostedVAA.
//
// The postVAA step requires @wormhole-foundation/sdk-solana-core which is not
// included in this repository yet. Both submit functions throw a
// NotImplementedError until that SDK is wired in. The error is caught and
// classified by the relay processor as a retryable failure so it does not
// block other job types.
//
// Invariants:
//   - Never called when chain.relayEnabled is false (the relay processor
//     routes only SOLANA_* jobs when the source chain has relayEnabled: true).
//   - All RPC and program calls use the RPC URL from AppConfigService, not a
//     global.
//   - The relayer keypair is read from AppConfigService.env.solanaRelayerKeypair
//     and never stored as a module-level singleton.
// ──────────────────────────────────────────────────────────────────────────────

import { Logger } from '@nestjs/common';
import { Keypair } from '@solana/web3.js';
import type { SolanaChainConfig } from '../../chains/types';

const logger = new Logger('SolanaSubmitter');

/** Error name returned when the Wormhole SDK is not yet integrated. */
export const SOLANA_NOT_IMPLEMENTED = 'SolanaSubmitterNotImplemented';

/**
 * Submits recv_payment_via_cctp_wormhole to a Solana destination chain.
 *
 * Requires the Wormhole SDK to post the VAA before the Chainbills instruction.
 * Returns SOLANA_NOT_IMPLEMENTED until the SDK is integrated.
 *
 * @param chain        Solana destination chain config.
 * @param rpcUrl       RPC URL for the destination chain (from ChainsService).
 * @param relayerKeypairBytes  64-byte Keypair secret from AppConfigService.
 * @param vaaBytes     Signed Wormhole VAA bytes.
 * @param burnMessage  Hex-encoded CCTP burn message.
 * @param attestation  Hex-encoded CCTP attestation.
 * @returns            Error name to classify, or null on success.
 */
export async function submitPaymentToSolana(
  chain: SolanaChainConfig,
  rpcUrl: string,
  relayerKeypairBytes: number[],
  vaaBytes: Uint8Array,
  burnMessage: string,
  attestation: string
): Promise<string | null> {
  // Validate inputs to avoid silent no-ops when the SDK is wired in later.
  if (!vaaBytes || vaaBytes.length === 0) {
    return 'MissingVAA';
  }
  if (!burnMessage || !attestation) {
    return 'MissingCctpArtefacts';
  }

  // Build keypair to confirm bytes are valid (throws on invalid length).
  Keypair.fromSecretKey(Uint8Array.from(relayerKeypairBytes));

  logger.warn(
    { destChain: chain.slug },
    'SOLANA_PAYMENT_VIA_CCTP_WORMHOLE: Wormhole SDK not integrated — postVAA step cannot complete'
  );

  // Unused variable suppression for future implementation parameters.
  void rpcUrl;

  // Return a classified error name so the processor marks the job PENDING for
  // retry rather than crashing. When the SDK is integrated, replace this with
  // the actual submission logic and return null on success.
  return SOLANA_NOT_IMPLEMENTED;
}

/**
 * Submits recv_payable_update_via_wormhole to a Solana destination chain.
 *
 * Requires the Wormhole SDK to post the VAA before the Chainbills instruction.
 * Returns SOLANA_NOT_IMPLEMENTED until the SDK is integrated.
 *
 * @param chain        Solana destination chain config.
 * @param rpcUrl       RPC URL for the destination chain.
 * @param relayerKeypairBytes  64-byte Keypair secret.
 * @param vaaBytes     Signed Wormhole VAA bytes.
 * @returns            Error name to classify, or null on success.
 */
export async function submitPayableUpdateToSolana(
  chain: SolanaChainConfig,
  rpcUrl: string,
  relayerKeypairBytes: number[],
  vaaBytes: Uint8Array
): Promise<string | null> {
  if (!vaaBytes || vaaBytes.length === 0) {
    return 'MissingVAA';
  }

  Keypair.fromSecretKey(Uint8Array.from(relayerKeypairBytes));

  logger.warn(
    { destChain: chain.slug },
    'SOLANA_PAYABLE_UPDATE_VIA_WORMHOLE: Wormhole SDK not integrated — postVAA step cannot complete'
  );

  void rpcUrl;

  return SOLANA_NOT_IMPLEMENTED;
}
