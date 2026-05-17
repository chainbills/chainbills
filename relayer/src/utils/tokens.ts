// ──────────────────────────────────────────────────────────────────────────────
// Chainbills Relayer — Token helpers
//
// Mirrors the token registry in server/schemas/tokens-and-amounts.ts.
// The relayer uses this to resolve EVM token addresses to human-readable
// names and decimal counts for Firestore records.
// ──────────────────────────────────────────────────────────────────────────────

import type { ChainName } from '../chains.js';

export interface TokenChainDetails {
  address: string;
  decimals: number;
}

export interface Token {
  name: string;
  details: Partial<Record<ChainName, TokenChainDetails>>;
}

/**
 * Registry of all tokens supported in Chainbills contracts.
 */
export const TOKENS: Token[] = [
  {
    name: 'USDC',
    details: {
      arctestnet: { address: '0x3600000000000000000000000000000000000000', decimals: 6 },
      sepolia: { address: '0x1c7D4B196Cb0C7B01d743Fbc6116a902379C7238', decimals: 6 },
    },
  },
  {
    name: 'ETH',
    details: {
      sepolia: {
        address: '0x875D3FBf298CF2E7537BbBb3213aB990C35655e8',
        decimals: 18,
      },
      megaeth: { address: '0x92e67bfe49466b18ccdf2a3a28b234ab68374c60', decimals: 18 },
    },
  },
];

/**
 * Resolves an on-chain EVM token address (lowercase hex) to its human-readable
 * name and decimal count.
 * Falls back to the raw address if the token is not in the registry.
 */
export function resolveToken(tokenAddress: string, chainName: ChainName): { name: string; decimals: number } {
  const addr = tokenAddress;
  const found = TOKENS.find((t) => t.details[chainName]?.address === addr);
  if (found) {
    return { name: found.name, decimals: found.details[chainName]!.decimals };
  }
  return { name: addr, decimals: 0 };
}
