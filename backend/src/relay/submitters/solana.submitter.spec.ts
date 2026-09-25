// ──────────────────────────────────────────────────────────────────────────────
// Chainbills Backend — Solana submitter tests
//
// Covers: both submit functions return SOLANA_NOT_IMPLEMENTED when the Wormhole
// SDK is not integrated; missing/empty VAA -> returns an error name early.
// ──────────────────────────────────────────────────────────────────────────────

import { submitPaymentToSolana, submitPayableUpdateToSolana, SOLANA_NOT_IMPLEMENTED } from './solana.submitter';
import type { SolanaChainConfig } from '../../chains/types';

const CHAIN: SolanaChainConfig = {
  slug: 'solanadevnet',
  cbChainId: '0xsolanachain',
  displayName: 'Solana Devnet',
  caip2: 'solana:devnet',
  network: 'testnet',
  isEvm: false,
  isSolana: true,
  wormholeChainId: 1,
  circleDomain: 5,
  pollIntervalMs: 5000,
  minGasBalance: 50_000_000n,
  relayEnabled: true,
  programId: 'DWhfdyzTiD2Jpkh3FhS2PreTSraqh3jWGfiTAoFG5wNk',
  usdcMint: '4zMMC9srt5Ri5X14GAgXhaHii3GnPAEERYPJgZJDncDU',
  wormholeProgramId: '3u8hJUVTA4jH1wYAyUur7FFZVQ8H635K3tSHHF4ssjQ5',
  cctpProgramId: 'CCTPmbSD7gX1bxKPAmg77w8oFzNFpaQiQUWD43TKaecd',
  wormholeShimProgramId: 'EtZMZM22ViKMo4r5y4Anovs3wKQ2owUmDpjygnMMcdEX',
};

// A valid 64-byte Solana keypair (Keypair.generate() produces this layout).
// We use Keypair.generate to get a real one for the test so fromSecretKey does not throw.
import { Keypair } from '@solana/web3.js';
const FAKE_KEYPAIR = Keypair.generate();
const FAKE_KEYPAIR_BYTES = Array.from(FAKE_KEYPAIR.secretKey) as number[];

const FAKE_VAA = new Uint8Array([0x01, 0x02, 0x03, 0x04]);
const FAKE_BURN_MSG = '0xdeadbeef';
const FAKE_ATTESTATION = '0xcafebabe';

describe('submitPaymentToSolana', () => {
  it('returns SOLANA_NOT_IMPLEMENTED (Wormhole SDK stub) with valid inputs', async () => {
    const result = await submitPaymentToSolana(
      CHAIN,
      'http://localhost:8899',
      FAKE_KEYPAIR_BYTES,
      FAKE_VAA,
      FAKE_BURN_MSG,
      FAKE_ATTESTATION
    );
    expect(result).toBe(SOLANA_NOT_IMPLEMENTED);
  });

  it('returns MissingVAA when vaaBytes is empty', async () => {
    const result = await submitPaymentToSolana(
      CHAIN,
      'http://localhost:8899',
      FAKE_KEYPAIR_BYTES,
      new Uint8Array(0),
      FAKE_BURN_MSG,
      FAKE_ATTESTATION
    );
    expect(result).toBe('MissingVAA');
  });

  it('returns MissingCctpArtefacts when burnMessage is empty', async () => {
    const result = await submitPaymentToSolana(
      CHAIN,
      'http://localhost:8899',
      FAKE_KEYPAIR_BYTES,
      FAKE_VAA,
      '',
      FAKE_ATTESTATION
    );
    expect(result).toBe('MissingCctpArtefacts');
  });
});

describe('submitPayableUpdateToSolana', () => {
  it('returns SOLANA_NOT_IMPLEMENTED (Wormhole SDK stub) with valid inputs', async () => {
    const result = await submitPayableUpdateToSolana(CHAIN, 'http://localhost:8899', FAKE_KEYPAIR_BYTES, FAKE_VAA);
    expect(result).toBe(SOLANA_NOT_IMPLEMENTED);
  });

  it('returns MissingVAA when vaaBytes is empty', async () => {
    const result = await submitPayableUpdateToSolana(
      CHAIN,
      'http://localhost:8899',
      FAKE_KEYPAIR_BYTES,
      new Uint8Array(0)
    );
    expect(result).toBe('MissingVAA');
  });
});
