// ──────────────────────────────────────────────────────────────────────────────
// Chainbills Relayer — Token helpers
//
// Mirrors the token registry in server/schemas/tokens-and-amounts.ts.
// The relayer uses this to resolve EVM token addresses to human-readable
// names and decimal counts for Firestore records.
// ──────────────────────────────────────────────────────────────────────────────

import type { ChainName } from '../chains.js';
import { logger } from './logger.js';

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
        address: '0x676FfD548E993E64018Ee23Ba039BBDB15f84699',
        decimals: 18,
      },
      megaeth: { address: '0x92e67bFE49466b18ccDf2A3A28b234AB68374c60', decimals: 18 },
    },
  },
];

/**
 * Resolves an on-chain EVM token address (lowercase hex) to its human-readable
 * name and decimal count.
 */
export function resolveToken(tokenAddress: string, chainName: ChainName): { name: string; decimals: number } {
  const addr = tokenAddress;
  const found = TOKENS.find((t) => t.details[chainName]?.address.toLowerCase() === addr.toLowerCase());
  if (found) {
    return { name: found.name, decimals: found.details[chainName]!.decimals };
  }
  logger.error({ tokenAddress, chainName }, 'Unknown token — add to TOKENS registry');
  return { name: addr, decimals: 0 };
}
