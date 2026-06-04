// ──────────────────────────────────────────────────────────────────────────────
// Chainbills Relayer — Chain client helpers
//
// Creates viem PublicClient and WalletClient instances for each chain.
// The WalletClient is used by the submitters to sign relay transactions.
// ──────────────────────────────────────────────────────────────────────────────

import { createPublicClient, createWalletClient, http, type PublicClient, type WalletClient } from 'viem';
import { privateKeyToAccount } from 'viem/accounts';
import type { EvmChainConfig } from '../chains.js';
import { RELAYER_PRIVATE_KEY } from '../config.js';

/** Returns a read-only viem PublicClient for the given EVM chain. */
export function makePublicClient(chain: EvmChainConfig): PublicClient {
  return createPublicClient({
    chain: chain.viemChain,
    transport: http(chain.rpcUrl),
  }) as PublicClient;
}

/** Returns a viem WalletClient (signer) for the relayer EOA on the given EVM chain. */
export function makeWalletClient(chain: EvmChainConfig): WalletClient {
  const account = privateKeyToAccount(RELAYER_PRIVATE_KEY);
  return createWalletClient({
    account,
    chain: chain.viemChain,
    transport: http(chain.rpcUrl),
  });
}

/**
 * Returns the relayer's EOA address (same across all chains — single key design).
 * The relayer EOA must hold native gas on each destination chain.
 */
export function relayerAccount() {
  return privateKeyToAccount(RELAYER_PRIVATE_KEY);
}
