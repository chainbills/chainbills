// ──────────────────────────────────────────────────────────────────────────────
// Chainbills Backend — ChainsService tests
//
// Covers the RPC-url map built once at construction from AppConfigService,
// every registry getter, and getRpcUrl's success and throwing paths.
// enabledChains() is tested separately in registry.spec.ts.
// ──────────────────────────────────────────────────────────────────────────────

import type { AppConfigService } from '../config/app-config.service';
import { ChainsService } from './chains.service';
import { anvil, arcmainnet, CHAINS, EVM_CHAINS, SOLANA_CHAINS, solanaDevnet } from './registry';
import type { ChainConfig } from './types';

const RPC_BY_SLUG = {
  solanadevnet: 'https://solana-devnet.example.com',
};

function makeConfig(rpcBySlug: Record<string, string> = RPC_BY_SLUG): AppConfigService {
  return {
    env: {
      enabledChainSlugs: Object.keys(rpcBySlug),
      rpcBySlug,
    },
  } as unknown as AppConfigService;
}

describe('ChainsService', () => {
  it('exposes every chain via .chains', () => {
    const service = new ChainsService(makeConfig());
    expect(service.chains).toEqual(CHAINS);
  });

  it('exposes only EVM chains via .evmChains', () => {
    const service = new ChainsService(makeConfig());
    expect(service.evmChains).toEqual(EVM_CHAINS);
  });

  it('exposes only Solana chains via .solanaChains', () => {
    const service = new ChainsService(makeConfig());
    expect(service.solanaChains).toEqual(SOLANA_CHAINS);
  });

  it('looks up a chain by cbChainId', () => {
    const service = new ChainsService(makeConfig());
    expect(service.byCbChainId(solanaDevnet.cbChainId)).toBe(solanaDevnet);
  });

  it('returns undefined for an unknown cbChainId', () => {
    const service = new ChainsService(makeConfig());
    expect(service.byCbChainId('0xnotreal')).toBeUndefined();
  });

  it('looks up a chain by slug', () => {
    const service = new ChainsService(makeConfig());
    expect(service.bySlug('solanadevnet')).toBe(solanaDevnet);
    expect(service.bySlug('arcmainnet')).toBe(arcmainnet);
    expect(service.bySlug('anvil')).toBe(anvil);
  });

  it('returns the configured RPC URL for each enabled chain', () => {
    const service = new ChainsService(makeConfig());
    expect(service.getRpcUrl(solanaDevnet)).toBe(RPC_BY_SLUG.solanadevnet);
  });

  it('sets enabled to the chains from enabledChainSlugs', () => {
    const service = new ChainsService(makeConfig());
    expect(service.enabled).toEqual([solanaDevnet]);
  });

  it('throws when a chain has no configured RPC URL', () => {
    const service = new ChainsService(makeConfig());
    const bogusChain = { ...solanaDevnet, slug: 'bogus' } as unknown as ChainConfig;
    expect(() => service.getRpcUrl(bogusChain)).toThrow(/no RPC URL configured for chain: bogus/);
  });
});
