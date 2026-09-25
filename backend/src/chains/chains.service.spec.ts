// ──────────────────────────────────────────────────────────────────────────────
// Chainbills Backend — ChainsService tests
//
// Covers every registry getter and getRpcUrl's success and throwing paths.
// enabledChains() is tested separately in registry.spec.ts.
// ──────────────────────────────────────────────────────────────────────────────

import { ChainsService } from './chains.service';
import { anvil, arcmainnet, CHAINS, EVM_CHAINS, SOLANA_CHAINS, solanaDevnet } from './registry';
import type { ChainConfig } from './types';

describe('ChainsService', () => {
  it('exposes every chain via .chains', () => {
    const service = new ChainsService();
    expect(service.chains).toEqual(CHAINS);
  });

  it('exposes only EVM chains via .evmChains', () => {
    const service = new ChainsService();
    expect(service.evmChains).toEqual(EVM_CHAINS);
  });

  it('exposes only Solana chains via .solanaChains', () => {
    const service = new ChainsService();
    expect(service.solanaChains).toEqual(SOLANA_CHAINS);
  });

  it('looks up a chain by cbChainId', () => {
    const service = new ChainsService();
    expect(service.byCbChainId(solanaDevnet.cbChainId)).toBe(solanaDevnet);
  });

  it('returns undefined for an unknown cbChainId', () => {
    const service = new ChainsService();
    expect(service.byCbChainId('0xnotreal')).toBeUndefined();
  });

  it('looks up a chain by slug', () => {
    const service = new ChainsService();
    expect(service.bySlug('solanadevnet')).toBe(solanaDevnet);
    expect(service.bySlug('arcmainnet')).toBe(arcmainnet);
    expect(service.bySlug('anvil')).toBe(anvil);
  });

  it('returns the rpcUrl from the chain config', () => {
    const service = new ChainsService();
    expect(service.getRpcUrl(solanaDevnet)).toBe(solanaDevnet.rpcUrl);
  });

  it('throws when a chain has no configured RPC URL', () => {
    const service = new ChainsService();
    const bogusChain = { ...solanaDevnet, rpcUrl: undefined, isEvm: false } as unknown as ChainConfig;
    expect(() => service.getRpcUrl(bogusChain)).toThrow(/no RPC URL configured for chain/);
  });
});
