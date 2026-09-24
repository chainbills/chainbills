// ──────────────────────────────────────────────────────────────────────────────
// Chainbills Backend — Payer bytes32 normalisation
//
// PayablePayment.payer is stored on-chain as a bytes32. The encoding depends on
// the payer's chain:
//   EVM chain:    last 20 bytes are the EVM address; the first 12 bytes are zero
//   Solana chain: all 32 bytes are the raw public key in base58 encoding
//
// The payer's chain (payerChainId) decides which path to take. If the chain is
// not in the registry the field is returned as a 0x-hex fallback so indexing
// never fails.
// ──────────────────────────────────────────────────────────────────────────────

import bs58 from 'bs58';
import type { ChainConfig } from '../../chains/types';

/**
 * Converts a bytes32 payer field to a human-readable address string.
 *
 * @param bytes32Hex  The bytes32 value as a 0x-prefixed 66-char hex string.
 * @param payerChain  The chain registry entry for the payer's chain, or undefined.
 * @returns           EVM lowercase hex address, Solana base58 address, or raw hex fallback.
 */
export function normalisePayerBytes32(bytes32Hex: string, payerChain: ChainConfig | undefined): string {
  const raw = bytes32Hex.startsWith('0x') ? bytes32Hex.slice(2) : bytes32Hex;

  if (!payerChain) {
    // Unknown chain — return raw hex so indexing continues.
    return `0x${raw}`;
  }

  if (payerChain.isEvm) {
    // EVM: last 20 bytes (40 hex chars) is the address.
    const addr = raw.slice(raw.length - 40);
    return `0x${addr}`.toLowerCase();
  }

  if (payerChain.isSolana) {
    // Solana: all 32 bytes are the public key; base58-encode the raw bytes.
    const buf = Buffer.from(raw, 'hex');
    return bs58.encode(buf);
  }

  return `0x${raw}`;
}

/**
 * Builds the wallet key for a payer given their chain and normalised address.
 *
 * @param normalised  Result of normalisePayerBytes32.
 * @param payerChain  The payer's chain registry entry.
 */
export function payerWalletKey(normalised: string, payerChain: ChainConfig | undefined): string {
  if (!payerChain) return normalised;
  if (payerChain.isEvm) return `evm:${normalised}`;
  if (payerChain.isSolana) return `solana:${normalised}`;
  return normalised;
}
