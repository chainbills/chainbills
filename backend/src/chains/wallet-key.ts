// ──────────────────────────────────────────────────────────────────────────────
// Chainbills Backend — Wallet key helper
//
// The "wallet key" (SPEC.md §7) is the universal identifier for a signer
// across every module: `"evm:0x<lowercase>"` or `"solana:<base58>"`. One EVM
// address is the same wallet on every EVM chain, so EVM wallet keys are
// chain-agnostic; Solana addresses are namespaced separately since the two
// address spaces can collide in theory (both are just byte strings).
// ──────────────────────────────────────────────────────────────────────────────

import { isAddress } from 'viem';
import { PublicKey } from '@solana/web3.js';

export type WalletNamespace = 'evm' | 'solana';

/** A parsed wallet key: its namespace and address, in the chain's native format. */
export interface ParsedWalletKey {
  namespace: WalletNamespace;
  /** EVM: lowercase 0x-hex. Solana: base58, case preserved. */
  address: string;
}

/**
 * Builds a wallet key from a namespace and address. EVM addresses are
 * lowercased (address case carries no meaning on EVM — checksum casing is a
 * display-only convention); Solana addresses keep their exact base58 casing,
 * since base58 is itself case-sensitive.
 *
 * Throws on a malformed address so a bad wallet key can never silently enter
 * the database — every caller must handle a clearly-invalid signer up front.
 */
export function walletKey(namespace: WalletNamespace, address: string): string {
  if (namespace === 'evm') {
    // strict: false — checksum casing carries no meaning once we lowercase
    // below, and callers may pass an address in any casing (e.g. as decoded
    // raw from an event log, which is never checksummed).
    if (!isAddress(address, { strict: false })) {
      throw new Error(`invalid EVM address: ${address}`);
    }
    return `evm:${address.toLowerCase()}`;
  }
  assertValidSolanaAddress(address);
  return `solana:${address}`;
}

/**
 * Parses a wallet key produced by {@link walletKey} back into its namespace
 * and address. Throws on any input that is not a well-formed wallet key, so
 * a corrupt or forged key in a request/DB row is caught immediately rather
 * than silently misrouting to the wrong chain namespace.
 */
export function parseWalletKey(key: string): ParsedWalletKey {
  const separatorIndex = key.indexOf(':');
  if (separatorIndex === -1) {
    throw new Error(`malformed wallet key: ${key}`);
  }
  const namespace = key.slice(0, separatorIndex);
  const address = key.slice(separatorIndex + 1);

  if (namespace === 'evm') {
    if (!isAddress(address, { strict: false })) {
      throw new Error(`malformed wallet key: ${key}`);
    }
    if (address !== address.toLowerCase()) {
      throw new Error(`malformed wallet key (EVM address must be lowercase): ${key}`);
    }
    return { namespace: 'evm', address };
  }
  if (namespace === 'solana') {
    assertValidSolanaAddress(address);
    return { namespace: 'solana', address };
  }
  throw new Error(`malformed wallet key (unknown namespace): ${key}`);
}

/** Validates a Solana address: base58, decoding to exactly 32 bytes. */
function assertValidSolanaAddress(address: string): void {
  let publicKey: PublicKey;
  try {
    publicKey = new PublicKey(address);
  } catch {
    throw new Error(`invalid Solana address: ${address}`);
  }
  // PublicKey accepts some inputs (e.g. very short numeric strings) that are
  // valid base58 but do not encode 32 bytes; guard explicitly.
  if (publicKey.toBytes().length !== 32) {
    throw new Error(`invalid Solana address: ${address}`);
  }
}
