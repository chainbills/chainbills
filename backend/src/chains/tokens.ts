// ──────────────────────────────────────────────────────────────────────────────
// Chainbills Backend — Token registry and resolver
//
// Static registry of known tokens per chain. The native token is represented
// by the chain's diamond address (SPEC.md §6.3). A token missing from the
// static registry is resolved on demand via ERC-20 symbol()/decimals() and
// cached in memory; failure logs an error and returns { symbol: 'UNKNOWN',
// decimals: 0 } so unknown tokens never break indexing.
// ──────────────────────────────────────────────────────────────────────────────

import { Injectable, Logger } from '@nestjs/common';
import { readContract } from 'viem/actions';
import type { PublicClient } from 'viem';
import type { ChainSlug } from './types';

export interface TokenChainDetails {
  /** Token address (EVM, lowercase hex) or mint (Solana, base58). */
  address: string;
  /** Display symbol for logs and API output. */
  symbol: string;
  decimals: number;
}

export interface Token {
  name: string;
  details: Partial<Record<ChainSlug, TokenChainDetails>>;
}

/** Minimal ERC-20 ABI fragments needed for on-chain symbol/decimals resolution. */
const ERC20_SYMBOL_DECIMALS_ABI = [
  { type: 'function', name: 'symbol', inputs: [], outputs: [{ name: '', type: 'string' }], stateMutability: 'view' },
  {
    type: 'function',
    name: 'decimals',
    inputs: [],
    outputs: [{ name: '', type: 'uint8' }],
    stateMutability: 'view',
  },
] as const;

/**
 * Registry of every token Chainbills contracts support, across all chains.
 * Native token entries use the chain's diamond address (null = not yet deployed).
 */
export const TOKENS: readonly Token[] = [
  {
    name: 'USDC',
    details: {
      // TODO(owner): fill in the Arc mainnet USDC address from evm/DEPLOYED.md once confirmed
      arcmainnet: { address: '', symbol: 'USDC', decimals: 6 },
      // TODO(owner): fill in the anvil mock USDC address after running evm/script/DeployLocalStack.s.sol
      anvil: { address: '', symbol: 'USDC', decimals: 6 },
      solanadevnet: { address: '4zMMC9srt5Ri5X14GAgXhaHii3GnPAEERYPJgZJDncDU', symbol: 'USDC', decimals: 6 },
    },
  },
];

/**
 * Resolves an on-chain token address/mint to its human-readable name and
 * decimal count from the static registry. Returns `undefined` when the token
 * is not in the static registry, so the caller knows to try on-chain lookup.
 */
export function resolveTokenFromRegistry(
  tokenAddress: string,
  chainSlug: ChainSlug
): { name: string; symbol: string; decimals: number } | undefined {
  const found = TOKENS.find(
    (t) => t.details[chainSlug]?.address && t.details[chainSlug].address.toLowerCase() === tokenAddress.toLowerCase()
  );
  if (!found) return undefined;
  const detail = found.details[chainSlug]!;
  return { name: found.name, symbol: detail.symbol, decimals: detail.decimals };
}

/**
 * Resolves an on-chain token address/mint to its human-readable name and
 * decimal count. Returns the raw address (with 0 decimals) and never throws
 * for an unregistered token, so a temporarily-unknown token never breaks
 * indexing.
 *
 * @deprecated Use `TokenResolverService` for new code — it falls back to
 * on-chain ERC-20 calls and caches results.
 */
export function resolveToken(tokenAddress: string, chainSlug: ChainSlug): { name: string; decimals: number } {
  const found = resolveTokenFromRegistry(tokenAddress, chainSlug);
  if (found) {
    return { name: found.name, decimals: found.decimals };
  }
  return { name: tokenAddress, decimals: 0 };
}

/** Result of resolving a token's symbol and decimals. */
export interface ResolvedToken {
  symbol: string;
  decimals: number;
}

/**
 * Injectable token resolver. Checks the static registry first; if not found,
 * calls ERC-20 `symbol()` and `decimals()` on the chain's public client and
 * caches the result in memory for the lifetime of this service. On any failure
 * logs an error and returns `{ symbol: 'UNKNOWN', decimals: 0 }` so callers
 * never see an exception from a missing token.
 */
@Injectable()
export class TokenResolverService {
  private readonly logger = new Logger(TokenResolverService.name);

  /** In-memory cache: "chainSlug:0xtokenAddress" -> resolved token. */
  private readonly cache = new Map<string, ResolvedToken>();

  /**
   * Resolves a token's symbol and decimals. Checks the static registry first,
   * then falls back to on-chain ERC-20 calls via the supplied viem public
   * client. Returns `{ symbol: 'UNKNOWN', decimals: 0 }` on any failure.
   */
  async resolve(tokenAddress: string, chainSlug: ChainSlug, client: PublicClient): Promise<ResolvedToken> {
    const cacheKey = `${chainSlug}:${tokenAddress.toLowerCase()}`;

    // Static registry lookup (fast path — no async needed).
    const fromRegistry = resolveTokenFromRegistry(tokenAddress, chainSlug);
    if (fromRegistry) {
      return { symbol: fromRegistry.symbol, decimals: fromRegistry.decimals };
    }

    // In-memory cache hit.
    const cached = this.cache.get(cacheKey);
    if (cached) return cached;

    // On-chain ERC-20 fallback.
    try {
      const [symbol, decimals] = await Promise.all([
        readContract(client, {
          address: tokenAddress as `0x${string}`,
          abi: ERC20_SYMBOL_DECIMALS_ABI,
          functionName: 'symbol',
        }),
        readContract(client, {
          address: tokenAddress as `0x${string}`,
          abi: ERC20_SYMBOL_DECIMALS_ABI,
          functionName: 'decimals',
        }),
      ]);
      const resolved: ResolvedToken = { symbol: symbol as string, decimals: decimals as number };
      this.cache.set(cacheKey, resolved);
      return resolved;
    } catch (err) {
      this.logger.error({ tokenAddress, chainSlug, err }, 'failed to resolve token via ERC-20 calls; using UNKNOWN/0');
      const fallback: ResolvedToken = { symbol: 'UNKNOWN', decimals: 0 };
      this.cache.set(cacheKey, fallback);
      return fallback;
    }
  }
}
