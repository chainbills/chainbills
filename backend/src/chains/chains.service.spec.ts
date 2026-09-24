// ──────────────────────────────────────────────────────────────────────────────
// Chainbills Backend — ChainsService tests
//
// Covers the RPC-url map built once at construction from AppConfigService,
// every registry getter, and getRpcUrl's success and throwing paths.
// ──────────────────────────────────────────────────────────────────────────────

import type { AppConfigService } from '../config/app-config.service';
import { ChainsService } from './chains.service';
import { arcTestnet, CHAINS, EVM_CHAINS, megaeth, sepolia, SOLANA_CHAINS, solanaDevnet } from './registry';
import type { ChainConfig } from './types';

const RPC = {
  arcTestnet: 'https://arc.example.com',
  sepolia: 'https://sepolia.example.com',
  megaeth: 'https://megaeth.example.com',
  solanaDevnet: 'https://solana-devnet.example.com',
};

function makeConfig(rpc: typeof RPC = RPC): AppConfigService {
  return { env: { rpc } } as unknown as AppConfigService;
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
    expect(service.byCbChainId(sepolia.cbChainId)).toBe(sepolia);
  });

  it('returns undefined for an unknown cbChainId', () => {
    const service = new ChainsService(makeConfig());
    expect(service.byCbChainId('0xnotreal')).toBeUndefined();
  });

  it('looks up a chain by slug', () => {
    const service = new ChainsService(makeConfig());
    expect(service.bySlug('megaeth')).toBe(megaeth);
  });

  it('returns the configured RPC URL for each chain', () => {
    const service = new ChainsService(makeConfig());
    expect(service.getRpcUrl(arcTestnet)).toBe(RPC.arcTestnet);
    expect(service.getRpcUrl(sepolia)).toBe(RPC.sepolia);
    expect(service.getRpcUrl(megaeth)).toBe(RPC.megaeth);
    expect(service.getRpcUrl(solanaDevnet)).toBe(RPC.solanaDevnet);
  });

  it('throws when a chain has no configured RPC URL', () => {
    const service = new ChainsService(makeConfig());
    const bogusChain = { ...arcTestnet, slug: 'bogus' } as unknown as ChainConfig;
    expect(() => service.getRpcUrl(bogusChain)).toThrow(/no RPC URL configured for chain: bogus/);
  });
});
