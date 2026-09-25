// ──────────────────────────────────────────────────────────────────────────────
// Chainbills Backend — Chain registry service
//
// Joins the static chain registry with the RPC URLs from AppConfigService,
// once, at module init — the "injected from config at module init, not
// mutated globals" rule from SPEC.md §6. Later phases (indexer, relay) build
// their per-chain clients from `getRpcUrl` instead of reading config again.
// ──────────────────────────────────────────────────────────────────────────────

import { Injectable } from '@nestjs/common';
import { AppConfigService } from '../config/app-config.service';
import { CHAIN_BY_CB_CHAIN_ID, CHAIN_BY_SLUG, CHAINS, enabledChains, EVM_CHAINS, SOLANA_CHAINS } from './registry';
import type { ChainConfig, ChainSlug } from './types';

/** Joins the static chain registry with per-chain RPC URLs from config; the single source of resolved chain state. */
@Injectable()
export class ChainsService {
  /** The chains enabled for this instance, resolved from ENABLED_CHAINS at construction. */
  readonly enabled: readonly ChainConfig[];

  /** slug -> RPC URL, assembled once from config at construction. */
  private readonly rpcUrlBySlug: ReadonlyMap<string, string>;

  constructor(config: AppConfigService) {
    this.enabled = enabledChains(config.env.enabledChainSlugs);
    this.rpcUrlBySlug = new Map(Object.entries(config.env.rpcBySlug));
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

  /** The configured RPC URL for `chain`, resolved once at construction. */
  getRpcUrl(chain: ChainConfig): string {
    const url = this.rpcUrlBySlug.get(chain.slug);
    if (!url) {
      // Unreachable given env.schema.ts requires every RPC_* var for every
      // enabled chain, but fail loudly rather than silently returning an empty URL.
      throw new Error(`no RPC URL configured for chain: ${chain.slug}`);
    }
    return url;
  }
}
