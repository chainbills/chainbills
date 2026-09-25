// ──────────────────────────────────────────────────────────────────────────────
// Chainbills Backend — Chain registry tests
//
// Covers the static registry's derived maps/filters, the throwing lookup
// helper, enabledChains(), and sameNetwork() — all pure data plus lookups
// with no external deps.
// ──────────────────────────────────────────────────────────────────────────────

import {
  anvil,
  arcmainnet,
  CHAIN_BY_CB_CHAIN_ID,
  CHAIN_BY_SLUG,
  CHAINS,
  enabledChains,
  EVM_CHAINS,
  requireChainByCbChainId,
  sameNetwork,
  SOLANA_CHAINS,
  solanaDevnet,
} from './registry';

describe('CHAINS', () => {
  it('contains exactly the three registry chains', () => {
    expect(CHAINS).toEqual([arcmainnet, anvil, solanaDevnet]);
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
    expect(EVM_CHAINS).toEqual([arcmainnet, anvil]);
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
    expect(requireChainByCbChainId(solanaDevnet.cbChainId)).toBe(solanaDevnet);
  });

  it('throws for an unknown cbChainId', () => {
    expect(() => requireChainByCbChainId('0xnotreal')).toThrow(/unknown cbChainId/);
  });
});

describe('enabledChains', () => {
  it('throws for an unknown slug', () => {
    expect(() => enabledChains(['unknownchain'])).toThrow(/unknown chain slugs/);
  });

  it('throws for a chain with null diamondAddress', () => {
    expect(() => enabledChains(['arcmainnet'])).toThrow(/no deployed diamond address/);
  });

  it('throws for a mix of unknown slugs and null-address chains', () => {
    expect(() => enabledChains(['badslug', 'arcmainnet'])).toThrow();
  });

  it('reports all problems at once (does not stop at first failure)', () => {
    let error: Error | null = null;
    try {
      enabledChains(['badslug1', 'badslug2', 'arcmainnet']);
    } catch (e) {
      error = e as Error;
    }
    expect(error).not.toBeNull();
    // Both unknown slugs should appear in the same error message.
    expect(error!.message).toContain('badslug1');
    expect(error!.message).toContain('badslug2');
  });

  it('returns the solanadevnet entry when that slug is provided', () => {
    const result = enabledChains(['solanadevnet']);
    expect(result).toEqual([solanaDevnet]);
  });
});

describe('sameNetwork', () => {
  it('returns true for two chains with the same network', () => {
    // arcmainnet and anvil are both in the registry but different networks.
    // solanadevnet is testnet. Let's verify two chains match themselves.
    expect(sameNetwork(arcmainnet, arcmainnet)).toBe(true);
    expect(sameNetwork(solanaDevnet, solanaDevnet)).toBe(true);
  });

  it('returns false for chains in different networks', () => {
    expect(sameNetwork(arcmainnet, solanaDevnet)).toBe(false);
    expect(sameNetwork(arcmainnet, anvil)).toBe(false);
    expect(sameNetwork(anvil, solanaDevnet)).toBe(false);
  });
});

describe('registry shape', () => {
  it('arcmainnet has the correct cbChainId and caip2', () => {
    expect(arcmainnet.caip2).toBe('eip155:5042');
    expect(arcmainnet.cbChainId).toBe('0xb8aed675f862d651b4a8c85f23a045faa0faaa1d162e6eb15d732231df3dc250');
    expect(arcmainnet.network).toBe('mainnet');
    expect(arcmainnet.diamondAddress).toBeNull();
  });

  it('anvil has the correct cbChainId, caip2 and null diamondAddress', () => {
    expect(anvil.caip2).toBe('eip155:31337');
    expect(anvil.cbChainId).toBe('0x318e51c37247d03bad135571413b06a083591bcc680967d80bf587ac928cf369');
    expect(anvil.network).toBe('local');
    expect(anvil.diamondAddress).toBeNull();
  });

  it('solanadevnet has relayEnabled: false', () => {
    expect(solanaDevnet.relayEnabled).toBe(false);
    expect(solanaDevnet.network).toBe('testnet');
  });
});
