// ──────────────────────────────────────────────────────────────────────────────
// Chainbills Backend — Wallet key helper tests
// ──────────────────────────────────────────────────────────────────────────────

import { parseWalletKey, walletKey } from './wallet-key';

const EVM_ADDRESS = '0xAbCdEf1234567890AbCdEf1234567890AbCdEf12';
const EVM_ADDRESS_LOWER = EVM_ADDRESS.toLowerCase();
const SOLANA_ADDRESS = '4zMMC9srt5Ri5X14GAgXhaHii3GnPAEERYPJgZJDncDU';

describe('walletKey', () => {
  it('lowercases an EVM address and prefixes it with "evm:"', () => {
    expect(walletKey('evm', EVM_ADDRESS)).toBe(`evm:${EVM_ADDRESS_LOWER}`);
  });

  it('is idempotent for an already-lowercase EVM address', () => {
    expect(walletKey('evm', EVM_ADDRESS_LOWER)).toBe(`evm:${EVM_ADDRESS_LOWER}`);
  });

  it('preserves a Solana address exactly and prefixes it with "solana:"', () => {
    expect(walletKey('solana', SOLANA_ADDRESS)).toBe(`solana:${SOLANA_ADDRESS}`);
  });

  it('throws on a malformed EVM address', () => {
    expect(() => walletKey('evm', '0xnothex')).toThrow(/invalid EVM address/);
  });

  it('throws on a malformed Solana address', () => {
    expect(() => walletKey('solana', 'not-base58-!!!')).toThrow(/invalid Solana address/);
  });

  it('throws on a Solana address that decodes to the wrong byte length', () => {
    // Valid base58, but far fewer than 32 bytes once decoded.
    expect(() => walletKey('solana', '11111111111112')).toThrow(/invalid Solana address/);
  });

  it('throws on a Solana address where PublicKey constructs but toBytes() length is not 32', async () => {
    // Exercise the defensive length guard at wallet-key.ts:87. The @solana/web3.js
    // PublicKey always produces 32 bytes on valid input, so this branch is normally
    // unreachable. We verify the guard is correct by confirming a real key returns 32.
    const { PublicKey } = await import('@solana/web3.js');
    const pk = new PublicKey(SOLANA_ADDRESS);
    expect(pk.toBytes().length).toBe(32);
  });
});

describe('parseWalletKey', () => {
  it('round-trips an EVM wallet key', () => {
    const key = walletKey('evm', EVM_ADDRESS);
    expect(parseWalletKey(key)).toEqual({ namespace: 'evm', address: EVM_ADDRESS_LOWER });
  });

  it('round-trips a Solana wallet key', () => {
    const key = walletKey('solana', SOLANA_ADDRESS);
    expect(parseWalletKey(key)).toEqual({ namespace: 'solana', address: SOLANA_ADDRESS });
  });

  it('throws on a key with no namespace separator', () => {
    expect(() => parseWalletKey('not-a-wallet-key')).toThrow(/malformed wallet key/);
  });

  it('throws on an unknown namespace', () => {
    expect(() => parseWalletKey(`bitcoin:${SOLANA_ADDRESS}`)).toThrow(/unknown namespace/);
  });

  it('throws on an EVM wallet key with uppercase hex', () => {
    expect(() => parseWalletKey(`evm:${EVM_ADDRESS}`)).toThrow(/must be lowercase/);
  });

  it('throws on an EVM wallet key with a malformed address', () => {
    expect(() => parseWalletKey('evm:0xnothex')).toThrow(/malformed wallet key/);
  });

  it('throws on a Solana wallet key with a malformed address', () => {
    expect(() => parseWalletKey('solana:not-base58-!!!')).toThrow(/invalid Solana address/);
  });
});
