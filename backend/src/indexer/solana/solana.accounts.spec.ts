// ──────────────────────────────────────────────────────────────────────────────
// Chainbills Backend — Solana PDA derivation tests
//
// Covers: every exported PDA helper returns a valid PublicKey; seed inputs
// produce deterministic outputs (same inputs -> same output); public key type
// is preserved throughout.
// ──────────────────────────────────────────────────────────────────────────────

import { PublicKey } from '@solana/web3.js';
import {
  configPDA,
  statsPDA,
  senderAuthorityPDA,
  chainRegistryPDA,
  foreignPayablePDA,
  vaultAuthorityPDA,
  consumedVaaPDA,
  paymentNoncePDA,
  cctpTokenBurnNoncePDA,
  cctpDataNoncePDA,
  payablePaymentPDA,
  activityRecordPDA,
  postedVaaPDA,
} from './solana.accounts';

const PROGRAM_ID = 'DWhfdyzTiD2Jpkh3FhS2PreTSraqh3jWGfiTAoFG5wNk';
const WORMHOLE_PROGRAM_ID = '3u8hJUVTA4jH1wYAyUur7FFZVQ8H635K3tSHHF4ssjQ5';
const FAKE_PAYABLE = new PublicKey('4zMMC9srt5Ri5X14GAgXhaHii3GnPAEERYPJgZJDncDU');

describe('Solana PDA derivation helpers', () => {
  it('configPDA returns a PublicKey', () => {
    const result = configPDA(PROGRAM_ID);
    expect(result).toBeInstanceOf(PublicKey);
  });

  it('statsPDA returns a PublicKey', () => {
    const result = statsPDA(PROGRAM_ID);
    expect(result).toBeInstanceOf(PublicKey);
  });

  it('senderAuthorityPDA returns a PublicKey', () => {
    const result = senderAuthorityPDA(PROGRAM_ID);
    expect(result).toBeInstanceOf(PublicKey);
  });

  it('chainRegistryPDA returns a PublicKey', () => {
    const cbChainId = Buffer.alloc(32, 0xab);
    const result = chainRegistryPDA(cbChainId, PROGRAM_ID);
    expect(result).toBeInstanceOf(PublicKey);
  });

  it('foreignPayablePDA returns a PublicKey', () => {
    const payableId = Buffer.alloc(32, 0x01);
    const result = foreignPayablePDA(payableId, PROGRAM_ID);
    expect(result).toBeInstanceOf(PublicKey);
  });

  it('vaultAuthorityPDA returns a PublicKey', () => {
    const result = vaultAuthorityPDA(FAKE_PAYABLE, PROGRAM_ID);
    expect(result).toBeInstanceOf(PublicKey);
  });

  it('consumedVaaPDA returns a PublicKey', () => {
    const vaaHash = Buffer.alloc(32, 0x02);
    const result = consumedVaaPDA(vaaHash, PROGRAM_ID);
    expect(result).toBeInstanceOf(PublicKey);
  });

  it('paymentNoncePDA returns a PublicKey', () => {
    const payerChainId = Buffer.alloc(32, 0x03);
    const payer = Buffer.alloc(32, 0x04);
    const nonce = 42n;
    const result = paymentNoncePDA(payerChainId, payer, nonce, PROGRAM_ID);
    expect(result).toBeInstanceOf(PublicKey);
  });

  it('cctpTokenBurnNoncePDA returns a PublicKey', () => {
    const nonce = Buffer.alloc(32, 0x05);
    const result = cctpTokenBurnNoncePDA(0, nonce, PROGRAM_ID);
    expect(result).toBeInstanceOf(PublicKey);
  });

  it('cctpDataNoncePDA returns a PublicKey', () => {
    const nonce = Buffer.alloc(32, 0x06);
    const result = cctpDataNoncePDA(0, nonce, PROGRAM_ID);
    expect(result).toBeInstanceOf(PublicKey);
  });

  it('payablePaymentPDA returns a PublicKey', () => {
    const result = payablePaymentPDA(FAKE_PAYABLE, 0n, PROGRAM_ID);
    expect(result).toBeInstanceOf(PublicKey);
  });

  it('activityRecordPDA returns a PublicKey', () => {
    const result = activityRecordPDA(0n, PROGRAM_ID);
    expect(result).toBeInstanceOf(PublicKey);
  });

  it('postedVaaPDA returns a PublicKey', () => {
    const vaaHash = Buffer.alloc(32, 0x07);
    const result = postedVaaPDA(vaaHash, WORMHOLE_PROGRAM_ID);
    expect(result).toBeInstanceOf(PublicKey);
  });

  it('all PDAs are deterministic: same inputs produce the same output', () => {
    expect(statsPDA(PROGRAM_ID).toBase58()).toBe(statsPDA(PROGRAM_ID).toBase58());
    expect(configPDA(PROGRAM_ID).toBase58()).toBe(configPDA(PROGRAM_ID).toBase58());
    expect(activityRecordPDA(0n, PROGRAM_ID).toBase58()).toBe(activityRecordPDA(0n, PROGRAM_ID).toBase58());
  });

  it('different global indices produce different activityRecordPDAs', () => {
    const pda0 = activityRecordPDA(0n, PROGRAM_ID);
    const pda1 = activityRecordPDA(1n, PROGRAM_ID);
    expect(pda0.toBase58()).not.toBe(pda1.toBase58());
  });
});
