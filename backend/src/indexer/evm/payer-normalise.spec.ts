// ──────────────────────────────────────────────────────────────────────────────
// Chainbills Backend — Payer normalisation tests
//
// Covers EVM bytes32 -> hex address and Solana bytes32 -> base58 address paths.
// ──────────────────────────────────────────────────────────────────────────────

import { normalisePayerBytes32, payerWalletKey } from './payer-normalise';
import type { ChainConfig } from '../../chains/types';

const EVM_CHAIN = { isEvm: true, isSolana: false } as ChainConfig;
const SOLANA_CHAIN = { isEvm: false, isSolana: true } as ChainConfig;

describe('normalisePayerBytes32', () => {
  it('extracts the last 20 bytes as a lowercase EVM address', () => {
    // 12 zero bytes + a 20-byte address
    const addr = 'deadbeefcafe1234567890abcdef1234567890ab';
    const bytes32 = '0x' + '00'.repeat(12) + addr;
    const result = normalisePayerBytes32(bytes32, EVM_CHAIN);
    expect(result).toBe(`0x${addr}`);
  });

  it('returns the EVM address in lowercase regardless of input casing', () => {
    const addrUpper = 'DEADBEEFCAFE1234567890ABCDEF1234567890AB';
    const bytes32 = '0x' + '00'.repeat(12) + addrUpper.toLowerCase();
    const result = normalisePayerBytes32(bytes32, EVM_CHAIN);
    expect(result).toBe(`0x${addrUpper.toLowerCase()}`);
  });

  it('encodes all 32 bytes as base58 for a Solana chain', () => {
    // Well-known Solana public key bytes (32-byte all-zeros public key in base58 is "11111111111111111111111111111111")
    const systemProgramHex = '0000000000000000000000000000000000000000000000000000000000000000';
    const result = normalisePayerBytes32(`0x${systemProgramHex}`, SOLANA_CHAIN);
    // bs58 of 32 zero bytes
    expect(result).toBe('11111111111111111111111111111111');
  });

  it('returns raw hex fallback when the chain is unknown', () => {
    const bytes32 = '0x' + 'ab'.repeat(32);
    const result = normalisePayerBytes32(bytes32, undefined);
    expect(result).toBe(`0x${'ab'.repeat(32)}`);
  });

  it('accepts bytes32 without 0x prefix', () => {
    const addr = 'deadbeefcafe1234567890abcdef1234567890ab';
    const bytes32 = '00'.repeat(12) + addr;
    const result = normalisePayerBytes32(bytes32, EVM_CHAIN);
    expect(result).toBe(`0x${addr}`);
  });
});

describe('payerWalletKey', () => {
  it('prefixes evm: for EVM chains', () => {
    const key = payerWalletKey('0xdeadbeef', EVM_CHAIN);
    expect(key).toBe('evm:0xdeadbeef');
  });

  it('prefixes solana: for Solana chains', () => {
    const key = payerWalletKey('So11111111111111111111111111111111', SOLANA_CHAIN);
    expect(key).toBe('solana:So11111111111111111111111111111111');
  });

  it('returns the address as-is for unknown chain', () => {
    const key = payerWalletKey('0xfoo', undefined);
    expect(key).toBe('0xfoo');
  });
});
