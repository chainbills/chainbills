// ──────────────────────────────────────────────────────────────────────────────
// Chainbills Relayer — Global Configuration
//
// Loads + validates env vars, injects RPC URLs into chain configs.
// ──────────────────────────────────────────────────────────────────────────────

import 'dotenv/config';
import { Keypair } from '@solana/web3.js';
import { ALL_CHAINS, arcTestnet, megaeth, sepolia, solanaDevnet } from './chains.js';

function requireEnv(key: string): string {
  const val = process.env[key];
  if (!val) throw new Error(`Missing required environment variable: ${key}`);
  return val;
}

/** Relayer EVM wallet private key. Must hold gas + ADMIN_ROLE on all EVM chains. */
export const RELAYER_PRIVATE_KEY = requireEnv('RELAYER_PRIVATE_KEY') as `0x${string}`;

/**
 * Solana relayer keypair. Must hold SOL for transaction fees.
 * Set as a JSON array of 64 numbers (the raw secret key bytes), e.g.:
 *   SOLANA_RELAYER_KEYPAIR=[1,2,3,...,64]
 */
export function getSolanaRelayerKeypair(): Keypair {
  const raw = requireEnv('SOLANA_RELAYER_KEYPAIR');
  try {
    const bytes = JSON.parse(raw) as number[];
    return Keypair.fromSecretKey(Uint8Array.from(bytes));
  } catch {
    throw new Error('SOLANA_RELAYER_KEYPAIR must be a JSON array of 64 numbers');
  }
}

/** Default getLogs poll interval in ms (overridden per-chain). */
export const POLL_INTERVAL_MS = Number(process.env.POLL_INTERVAL_MS ?? 12_000);

// ── Inject RPC URLs into chain configs ────────────────────────────────────────
arcTestnet.rpcUrl = requireEnv('RPC_ARC_TESTNET');
sepolia.rpcUrl = requireEnv('RPC_SEPOLIA');
megaeth.rpcUrl = requireEnv('RPC_MEGAETH');
solanaDevnet.rpcUrl = requireEnv('SOLANA_RPC_URL');

for (const chain of ALL_CHAINS) {
  if (!chain.rpcUrl) throw new Error(`Missing RPC URL for chain: ${chain.name}`);
}

export { ALL_CHAINS };
