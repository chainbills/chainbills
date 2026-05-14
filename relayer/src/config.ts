// ──────────────────────────────────────────────────────────────────────────────
// Chainbills Relayer — Global Configuration
//
// This module loads environment variables, validates required ones,
// and resolves the RPC URLs into the chain configs before any watcher starts.
// ──────────────────────────────────────────────────────────────────────────────

import 'dotenv/config';
import { ALL_CHAINS, arcTestnet, megaeth, sepolia } from './chains.js';

/**
 * Validates that a required environment variable is set and returns its value.
 * Throws at startup if missing — fast-fail is better than cryptic runtime errors.
 */
function requireEnv(key: string): string {
  const val = process.env[key];
  if (!val) throw new Error(`Missing required environment variable: ${key}`);
  return val;
}

/** Relayer wallet private key. Must hold gas + ADMIN_ROLE on all chains. */
export const RELAYER_PRIVATE_KEY = requireEnv('RELAYER_PRIVATE_KEY') as `0x${string}`;

/** Default getLogs poll interval in ms (overridden per-chain in chains/index.ts). */
export const POLL_INTERVAL_MS = Number(process.env.POLL_INTERVAL_MS ?? 12_000);

// ── Inject RPC URLs into chain configs ────────────────────────────────────────
// RPC URLs live in env vars (not hardcoded) so they can be rotated without
// a code deploy. We inject them into the chain config objects here before
// any chain client is created.
arcTestnet.rpcUrl = requireEnv('RPC_ARC_TESTNET');
sepolia.rpcUrl = requireEnv('RPC_SEPOLIA');
megaeth.rpcUrl = requireEnv('RPC_MEGAETH');

// Validate that every chain has its RPC URL after injection.
for (const chain of ALL_CHAINS) {
  if (!chain.rpcUrl) throw new Error(`Missing RPC URL for chain: ${chain.name}`);
}

export { ALL_CHAINS };
