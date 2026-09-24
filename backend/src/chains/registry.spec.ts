// ──────────────────────────────────────────────────────────────────────────────
// Chainbills Backend — Chain registry tests
//
// Covers the static registry's derived maps/filters and the throwing lookup
// helper, since these are pure data plus lookups with no external deps.
// ──────────────────────────────────────────────────────────────────────────────

import {
  arcTestnet,
  CHAIN_BY_CB_CHAIN_ID,
  CHAIN_BY_SLUG,
  CHAINS,
  EVM_CHAINS,
  megaeth,
  requireChainByCbChainId,
  sepolia,
  SOLANA_CHAINS,
  solanaDevnet,
} from './registry';

describe('CHAINS', () => {
  it('contains exactly the four deployed chains', () => {
    expect(CHAINS).toEqual([arcTestnet, sepolia, megaeth, solanaDevnet]);
  });
});

describe('CHAIN_BY_CB_CHAIN_ID', () => {
  it('looks up every chain by its cbChainId', () => {
    for (const chain of CHAINS) {
      expect(CHAIN_BY_CB_CHAIN_ID.get(chain.cbChainId)).toBe(chain);
    }
  });

  it('returns undefined for an unknown cbChainId', () => {
    expect(CHAIN_BY_CB_CHAIN_ID.get('0xnotreal')).toBeUndefined();
  });
});

describe('CHAIN_BY_SLUG', () => {
  it('looks up every chain by its slug', () => {
    for (const chain of CHAINS) {
      expect(CHAIN_BY_SLUG.get(chain.slug)).toBe(chain);
    }
  });
});

describe('EVM_CHAINS', () => {
  it('contains only chains with isEvm true', () => {
    expect(EVM_CHAINS).toEqual([arcTestnet, sepolia, megaeth]);
    expect(EVM_CHAINS.every((c) => c.isEvm)).toBe(true);
  });
});

describe('SOLANA_CHAINS', () => {
  it('contains only chains with isSolana true', () => {
    expect(SOLANA_CHAINS).toEqual([solanaDevnet]);
    expect(SOLANA_CHAINS.every((c) => c.isSolana)).toBe(true);
  });
});

describe('requireChainByCbChainId', () => {
  it('returns the chain for a known cbChainId', () => {
    expect(requireChainByCbChainId(sepolia.cbChainId)).toBe(sepolia);
  });

  it('throws for an unknown cbChainId', () => {
    expect(() => requireChainByCbChainId('0xnotreal')).toThrow(/unknown cbChainId/);
  });
});
