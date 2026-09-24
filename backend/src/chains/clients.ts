// ──────────────────────────────────────────────────────────────────────────────
// Chainbills Backend — Chain client factories
//
// Ported from relayer/src/utils/clients.ts + relayer/src/solana/client.ts,
// reshaped so every factory takes its RPC URL as an explicit argument rather
// than reading it off a mutated registry object (see types.ts's header
// comment and SPEC.md §6). Callers source the URL from `AppConfigService`.
// ──────────────────────────────────────────────────────────────────────────────

import { createPublicClient, createWalletClient, http, type PublicClient, type WalletClient } from 'viem';
import { privateKeyToAccount, type PrivateKeyAccount } from 'viem/accounts';
import { Connection, Keypair, type Commitment } from '@solana/web3.js';
import type { EvmChainConfig } from './types';

/** Read-only viem client for one EVM chain, bound to `rpcUrl`. */
export function createEvmPublicClient(chain: EvmChainConfig, rpcUrl: string): PublicClient {
  return createPublicClient({ chain: chain.viemChain, transport: http(rpcUrl) });
}

/**
 * A viem account derived from an EVM private key. Callers hold the raw key
 * only long enough to build this account (worker-role config, never logged —
 * see env.schema.ts / WORKER_RULES.md §3).
 */
export function evmAccountFromPrivateKey(privateKey: `0x${string}`): PrivateKeyAccount {
  return privateKeyToAccount(privateKey);
}

/** Signing viem client for one EVM chain, bound to `rpcUrl` and `account`. */
export function createEvmWalletClient(chain: EvmChainConfig, rpcUrl: string, account: PrivateKeyAccount): WalletClient {
  return createWalletClient({ chain: chain.viemChain, transport: http(rpcUrl), account });
}

/** Read-only (or signing, once paired with a `Keypair`) Solana connection bound to `rpcUrl`. */
export function createSolanaConnection(rpcUrl: string, commitment: Commitment = 'confirmed'): Connection {
  return new Connection(rpcUrl, commitment);
}

/**
 * A Solana `Keypair` from the JSON-array secret key format used by
 * `SOLANA_RELAYER_KEYPAIR` (Solana CLI / wallet export format).
 */
export function solanaKeypairFromSecretKey(secretKey: number[]): Keypair {
  return Keypair.fromSecretKey(Uint8Array.from(secretKey));
}
