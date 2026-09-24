// ──────────────────────────────────────────────────────────────────────────────
// Chainbills Backend — Token registry tests
//
// Covers resolveToken's found/not-found paths and its case-insensitive
// address matching (EVM addresses can arrive in either case from a log).
// ──────────────────────────────────────────────────────────────────────────────

import { resolveToken, TOKENS } from './tokens';

describe('resolveToken', () => {
  it('resolves a known token by its exact-case address', () => {
    expect(resolveToken('0x1c7D4B196Cb0C7B01d743Fbc6116a902379C7238', 'sepolia')).toEqual({
      name: 'USDC',
      decimals: 6,
    });
  });

  it('resolves a known token address regardless of case', () => {
    expect(resolveToken('0x1c7d4b196cb0c7b01d743fbc6116a902379c7238', 'sepolia')).toEqual({
      name: 'USDC',
      decimals: 6,
    });
    expect(resolveToken('0x1C7D4B196CB0C7B01D743FBC6116A902379C7238', 'sepolia')).toEqual({
      name: 'USDC',
      decimals: 6,
    });
  });

  it('resolves a Solana mint address on solanadevnet', () => {
    expect(resolveToken('4zMMC9srt5Ri5X14GAgXhaHii3GnPAEERYPJgZJDncDU', 'solanadevnet')).toEqual({
      name: 'USDC',
      decimals: 6,
    });
  });

  it('returns the raw address with 0 decimals for an unregistered token', () => {
    expect(resolveToken('0xdeadbeef', 'sepolia')).toEqual({ name: '0xdeadbeef', decimals: 0 });
  });

  it('returns the raw address when the token exists but not on this chain', () => {
    // USDC has no entry for megaeth.
    const usdcSepoliaAddress = TOKENS[0].details.sepolia!.address;
    expect(resolveToken(usdcSepoliaAddress, 'megaeth')).toEqual({ name: usdcSepoliaAddress, decimals: 0 });
  });

  it('never throws for an unregistered token', () => {
    expect(() => resolveToken('not-an-address', 'arctestnet')).not.toThrow();
  });
});
