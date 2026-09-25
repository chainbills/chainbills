// ──────────────────────────────────────────────────────────────────────────────
// Chainbills Backend — Chain registry service
//
// Wraps the static chain registry and resolves per-chain RPC URLs from each
// chain's own `rpcUrl` field (or the viem chain default). Later phases
// (indexer, relay) build their per-chain clients from `getRpcUrl`.
// ──────────────────────────────────────────────────────────────────────────────

import { Injectable } from '@nestjs/common';
import { CHAIN_BY_CB_CHAIN_ID, CHAIN_BY_SLUG, CHAINS, ENABLED_CHAIN_SLUGS, enabledChains, EVM_CHAINS, SOLANA_CHAINS } from './registry';
import type { ChainConfig, ChainSlug } from './types';

/** Joins the static chain registry with per-chain RPC URLs from the registry; the single source of resolved chain state. */
@Injectable()
export class ChainsService {
  /** The chains enabled for this instance, resolved from ENABLED_CHAIN_SLUGS at construction. */
  readonly enabled: readonly ChainConfig[];

  constructor() {
    this.enabled = enabledChains([...ENABLED_CHAIN_SLUGS]);
  }

  /** Every chain in the registry. */
  get chains(): readonly ChainConfig[] {
    return CHAINS;
  }

  /** Every EVM chain in the registry. */
  get evmChains() {
    return EVM_CHAINS;
  }

  /** Every Solana chain in the registry. */
  get solanaChains() {
    return SOLANA_CHAINS;
  }

  /** Looks up a chain by its cbChainId (the cross-chain key — see types.ts). */
  byCbChainId(cbChainId: string): ChainConfig | undefined {
    return CHAIN_BY_CB_CHAIN_ID.get(cbChainId);
  }

  /** Looks up a chain by its human slug (logs / API output only). */
  bySlug(slug: ChainSlug): ChainConfig | undefined {
    return CHAIN_BY_SLUG.get(slug);
  }

  /** The RPC URL for `chain`, read from the chain's own `rpcUrl` field or the viem chain's built-in default. */
  getRpcUrl(chain: ChainConfig): string {
    if (chain.rpcUrl) return chain.rpcUrl;

    if (chain.isEvm) {
      const fallback = chain.viemChain.rpcUrls.default.http[0];
      if (fallback) return fallback;
    }

    throw new Error(`no RPC URL configured for chain: ${chain.slug}`);
  }
}
