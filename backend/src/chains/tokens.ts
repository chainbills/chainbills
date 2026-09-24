// ──────────────────────────────────────────────────────────────────────────────
// Chainbills Backend — Token registry
//
// Ported from relayer/src/utils/tokens.ts. Native token is represented by the
// chain's own Chainbills contract address (CLAUDE.md invariant #5), which is
// why ETH's "address" below equals each EVM chain's `contractAddress` in
// registry.ts. Solana devnet USDC is added per SPEC.md §6 / phase 1 task 5.
// ──────────────────────────────────────────────────────────────────────────────

import type { ChainSlug } from './types';

export interface TokenChainDetails {
  /** Token address (EVM, lowercase hex ok either case here) or mint (Solana, base58). */
  address: string;
  decimals: number;
}

export interface Token {
  name: string;
  details: Partial<Record<ChainSlug, TokenChainDetails>>;
}

/** Registry of every token Chainbills contracts support, across all chains. */
export const TOKENS: readonly Token[] = [
  {
    name: 'USDC',
    details: {
      arctestnet: { address: '0x3600000000000000000000000000000000000000', decimals: 6 },
      sepolia: { address: '0x1c7D4B196Cb0C7B01d743Fbc6116a902379C7238', decimals: 6 },
      solanadevnet: { address: '4zMMC9srt5Ri5X14GAgXhaHii3GnPAEERYPJgZJDncDU', decimals: 6 },
    },
  },
  {
    name: 'ETH',
    details: {
      // Native ETH, represented by the chain's own contract address.
      sepolia: { address: '0x48353Ab7662Bc8218811Fbbdf247cCc8602fba8A', decimals: 18 },
      megaeth: { address: '0xc38d1681d34DA821E46508C084D673477E455570', decimals: 18 },
    },
  },
];

/**
 * Resolves an on-chain token address/mint to its human-readable name and
 * decimal count. Returns the raw address (with 0 decimals) and never throws
 * for an unregistered token, so a temporarily-unknown token never breaks
 * indexing — callers that log this should flag it loudly (see resolveToken
 * usages in the indexer, added in a later phase).
 */
export function resolveToken(tokenAddress: string, chainSlug: ChainSlug): { name: string; decimals: number } {
  const found = TOKENS.find((t) => t.details[chainSlug]?.address.toLowerCase() === tokenAddress.toLowerCase());
  if (found) {
    return { name: found.name, decimals: found.details[chainSlug]!.decimals };
  }
  return { name: tokenAddress, decimals: 0 };
}
