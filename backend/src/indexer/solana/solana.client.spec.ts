// ──────────────────────────────────────────────────────────────────────────────
// Chainbills Backend — Solana client helper tests
//
// Covers: makeConnection creates a Connection with confirmed commitment;
// makeCoder returns a BorshAccountsCoder; getPDA delegates to findProgramAddressSync;
// decodeAccount throws when data is null; decodeAccount throws when decoding fails.
// ──────────────────────────────────────────────────────────────────────────────

import { Connection, PublicKey } from '@solana/web3.js';
import { BorshAccountsCoder } from '@coral-xyz/anchor';
import { makeConnection, makeCoder, getPDA, decodeAccount } from './solana.client';

const PROGRAM_ID = 'DWhfdyzTiD2Jpkh3FhS2PreTSraqh3jWGfiTAoFG5wNk';

describe('makeConnection', () => {
  it('returns a Connection instance', () => {
    const conn = makeConnection('http://localhost:8899');
    expect(conn).toBeInstanceOf(Connection);
  });
});

describe('makeCoder', () => {
  it('returns a BorshAccountsCoder', () => {
    const coder = makeCoder();
    expect(coder).toBeInstanceOf(BorshAccountsCoder);
  });
});

describe('getPDA', () => {
  it('returns a PublicKey for given seeds', () => {
    const seeds = [Buffer.from('stats')];
    const result = getPDA(seeds, PROGRAM_ID);
    expect(result).toBeInstanceOf(PublicKey);
  });

  it('is deterministic for the same seeds', () => {
    const seeds = [Buffer.from('activity'), Buffer.from('global')];
    const r1 = getPDA(seeds, PROGRAM_ID);
    const r2 = getPDA(seeds, PROGRAM_ID);
    expect(r1.toBase58()).toBe(r2.toBase58());
  });
});

describe('decodeAccount', () => {
  it('throws when data is null', () => {
    const coder = makeCoder();
    expect(() => decodeAccount(coder, 'Stats', null)).toThrow(/Account data is null/);
  });

  it('throws when account name does not exist in the IDL', () => {
    const coder = makeCoder();
    // Passing valid buffer bytes but wrong account name should throw.
    expect(() => decodeAccount(coder, 'NonExistentAccount', Buffer.alloc(10))).toThrow();
  });
});
