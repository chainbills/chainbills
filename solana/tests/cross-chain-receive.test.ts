/**
 * Cross-chain payment receive tests:
 *   recv_payment_via_cctp_wormhole — EVM → Solana via Wormhole VAA + CCTP
 *   recv_payment_via_cctp_only     — EVM → Solana via CCTP only (no Wormhole)
 *
 * CCTP burn/data CPIs are stubbed (msg!) so these tests verify state recording,
 * replay protection, and validation logic without a live Circle attestation service.
 */

import { BN } from '@coral-xyz/anchor';
import { Keypair, PublicKey, SystemProgram } from '@solana/web3.js';
import { LiteSVM } from 'litesvm';
import {
  activityRecordPDA,
  cctpTokenBurnNoncePDA,
  chainRegistryPDA,
  consumedVaaPDA,
  foreignPayablePDA,
  payableActivityPointerPDA,
  payablePaymentPDA,
  paymentNoncePDA,
  stats,
  vaultAuthorityPDA,
} from './accounts';
import {
  buildCctpMessage,
  buildPostedVaaData,
  CCTP_DEVNET,
  cctpDataNoncePDA,
  encodePaymentPayload,
  injectPostedVaa,
  WORMHOLE_DEVNET,
} from './helpers/mock-vaa';
import { bootstrapProgram, SOLANA_DEVNET_CB_CHAIN_ID } from './helpers/setup';
import {
  createSvm,
  decode,
  encodeAccount,
  expectFailure,
  expectSuccess,
  fund,
  injectAccount,
  sendIx,
  sendLargeVersionedIx,
} from './helpers/svm';
import { ASSOCIATED_TOKEN_PROGRAM_ID, createMint, getAta, TOKEN_PROGRAM_ID } from './helpers/tokens';

// ── Shared constants ──────────────────────────────────────────────────────────

// keccak256("eip155:11155111") — Ethereum Sepolia
const SEPOLIA_CB_CHAIN_ID = Buffer.from('afa9c74bd89ea79b5c1da22f7ea1c29de3a3c70e6f84f769e68c51e5f4c1bb1b', 'hex');
const SEPOLIA_WORMHOLE_CHAIN_ID = 10002;
const SEPOLIA_CIRCLE_DOMAIN = 0;
const EVM_CONTRACT = new Uint8Array(32).fill(0xaa);
const PAYABLE_ID = Buffer.alloc(32, 0x05);
const PAYER_BYTES = Buffer.alloc(32, 0x33);
const AMOUNT = 1_000_000n; // 1 USDC

// Inject a ForeignPayable owned by PROGRAM_ID at the canonical PDA address.
async function injectForeignPayable(
  svm: LiteSVM,
  payableId: Buffer,
  opts: { isClosed?: boolean; paymentsCount?: number } = {}
): Promise<PublicKey> {
  const data = await encodeAccount('ForeignPayable', {
    payable_id: Array.from(payableId),
    cb_chain_id: Array.from(SEPOLIA_CB_CHAIN_ID),
    is_closed: opts.isClosed ?? false,
    is_auto_withdraw: false,
    payable_update_nonce: new BN(1),
    payments_count: new BN(opts.paymentsCount ?? 0),
    created_at: new BN(0),
    allowed_tokens_and_amounts: [],
  });
  const addr = foreignPayablePDA(payableId);
  injectAccount(svm, addr, data);
  return addr;
}

// Inject a ChainRegistry at the canonical PDA address.
async function injectChainReg(
  svm: LiteSVM,
  opts: {
    cbChainId: Buffer;
    hasWormhole?: boolean;
    wormholeChainId?: number;
    hasCctp?: boolean;
    circleDomain?: number;
  }
): Promise<PublicKey> {
  const { cbChainId, hasWormhole = false, wormholeChainId = 0, hasCctp = false, circleDomain = 0 } = opts;
  const data = await encodeAccount('ChainRegistry', {
    cb_chain_id: Array.from(cbChainId),
    has_wormhole: hasWormhole,
    wormhole_chain_id: wormholeChainId,
    has_cctp: hasCctp,
    circle_domain: circleDomain,
    registered_contract: Array.from(EVM_CONTRACT),
  });
  const addr = chainRegistryPDA(cbChainId);
  injectAccount(svm, addr, data);
  return addr;
}

// ── recv_payment_via_cctp_wormhole ────────────────────────────────────────────

describe('recv_payment_via_cctp_wormhole', () => {
  let svm: LiteSVM;
  let relayer: Keypair;
  let usdcMint: PublicKey;
  let chainRegAddr: PublicKey;
  let fpAddr: PublicKey;

  beforeEach(async () => {
    svm = createSvm();
    const owner = Keypair.generate();
    svm.airdrop(owner.publicKey, 10_000_000_000n);
    await bootstrapProgram(svm, owner);

    const { keypair } = fund(svm);
    relayer = keypair;

    usdcMint = createMint(svm, owner);

    chainRegAddr = await injectChainReg(svm, {
      cbChainId: SEPOLIA_CB_CHAIN_ID,
      hasWormhole: true,
      wormholeChainId: SEPOLIA_WORMHOLE_CHAIN_ID,
    });

    fpAddr = await injectForeignPayable(svm, PAYABLE_ID);
  });

  async function callRecvWormhole(
    opts: {
      vaaHash?: Buffer;
      payerChainId?: Buffer;
      payer?: Buffer;
      paymentNonce?: number;
      cctpBurnNonce?: Buffer;
      srcDomain?: number;
    } = {}
  ) {
    const vaaHash = opts.vaaHash ?? Buffer.alloc(32, 0x77);
    const payerChainId = opts.payerChainId ?? SEPOLIA_CB_CHAIN_ID;
    const payer = opts.payer ?? PAYER_BYTES;
    const paymentNonce = opts.paymentNonce ?? 0;
    const cctpBurnNonce = opts.cctpBurnNonce ?? Buffer.alloc(32, 0x88);
    const srcDomain = opts.srcDomain ?? SEPOLIA_CIRCLE_DOMAIN;

    const payload = encodePaymentPayload({
      payableId: PAYABLE_ID,
      nonce: BigInt(paymentNonce),
      amount: AMOUNT,
      payableChainId: SOLANA_DEVNET_CB_CHAIN_ID,
      payerChainId,
      payer,
    });

    const vaaData = buildPostedVaaData({
      emitterChain: SEPOLIA_WORMHOLE_CHAIN_ID,
      emitterAddress: EVM_CONTRACT,
      payload,
    });
    const postedVaaAddr = injectPostedVaa(svm, vaaHash, vaaData, WORMHOLE_DEVNET);

    const fpData = decode<any>(svm, 'ForeignPayable', fpAddr);
    const statsCur = decode<any>(svm, 'Stats', stats);
    const vaultAuth = vaultAuthorityPDA(fpAddr);

    // burn_message: just needs len > 148 and burn_nonce at [12..44]
    const burnMsg = Buffer.alloc(200, 0);
    burnMsg.set(cctpBurnNonce, 12);

    const prog = require('./helpers/svm').createProgram(relayer);
    const ix = await prog.methods
      .recvPaymentViaCctpWormhole(
        Array.from(vaaHash),
        Array.from(payerChainId),
        Array.from(payer),
        new BN(paymentNonce),
        Array.from(cctpBurnNonce),
        srcDomain,
        burnMsg,
        Buffer.alloc(0)
      )
      .accounts({
        relayer: relayer.publicKey,
        wormholeProgram: WORMHOLE_DEVNET,
        postedVaa: postedVaaAddr,
        chainRegistry: chainRegAddr,
        foreignPayable: fpAddr,
        vaultAuthority: vaultAuth,
        usdcMint,
        vaultUsdcAta: getAta(usdcMint, vaultAuth),
        payablePayment: payablePaymentPDA(fpAddr, fpData.payments_count),
        consumedVaa: consumedVaaPDA(vaaHash),
        paymentNoncePda: paymentNoncePDA(payerChainId, payer, new BN(paymentNonce)),
        cctpBurnNoncePda: cctpTokenBurnNoncePDA(srcDomain, cctpBurnNonce),
        stats,
        activityRecord: activityRecordPDA(statsCur.total_activities),
        payableActivityPointer: payableActivityPointerPDA(fpAddr, fpData.payments_count),
        tokenProgram: TOKEN_PROGRAM_ID,
        associatedTokenProgram: ASSOCIATED_TOKEN_PROGRAM_ID,
        systemProgram: SystemProgram.programId,
      })
      .instruction();

    return sendIx(svm, ix, relayer);
  }

  it('creates PayablePayment PDA with correct fields', async () => {
    expectSuccess(await callRecvWormhole());

    const pp = decode<any>(svm, 'PayablePayment', payablePaymentPDA(fpAddr, new BN(0)));
    expect(Array.from(pp.payer)).toEqual(Array.from(PAYER_BYTES));
    expect(pp.amount.toNumber()).toBe(Number(AMOUNT));
    expect(pp.payable.toBase58()).toBe(fpAddr.toBase58());
    expect(pp.token_mint.toBase58()).toBe(usdcMint.toBase58());
    expect(Array.from(pp.payer_chain_id)).toEqual(Array.from(SEPOLIA_CB_CHAIN_ID));
  });

  it('creates ConsumedVaa PDA', async () => {
    const vaaHash = Buffer.alloc(32, 0x77);
    expectSuccess(await callRecvWormhole({ vaaHash }));
    expect(svm.getAccount(consumedVaaPDA(vaaHash))).toBeTruthy();
  });

  it('creates PaymentNonce PDA', async () => {
    expectSuccess(await callRecvWormhole());
    expect(svm.getAccount(paymentNoncePDA(SEPOLIA_CB_CHAIN_ID, PAYER_BYTES, new BN(0)))).toBeTruthy();
  });

  it('increments stats.total_payable_payments and consumed_wormhole_messages', async () => {
    const before = decode<any>(svm, 'Stats', stats);
    expectSuccess(await callRecvWormhole());
    const after = decode<any>(svm, 'Stats', stats);
    expect(after.total_payable_payments.toNumber()).toBe(before.total_payable_payments.toNumber() + 1);
    expect(after.consumed_wormhole_messages.toNumber()).toBe(before.consumed_wormhole_messages.toNumber() + 1);
    expect(after.received_cctp_payment_messages.toNumber()).toBe(before.received_cctp_payment_messages.toNumber() + 1);
  });

  it('rejects replay (same vaaHash twice)', async () => {
    const vaaHash = Buffer.alloc(32, 0xcc);
    expectSuccess(await callRecvWormhole({ vaaHash }));
    expectFailure(
      await callRecvWormhole({
        vaaHash,
        paymentNonce: 1,
        cctpBurnNonce: Buffer.alloc(32, 0x99),
      })
    );
  });

  it('rejects replay (same payment_nonce twice)', async () => {
    expectSuccess(await callRecvWormhole({ vaaHash: Buffer.alloc(32, 0xdd) }));
    // different vaaHash + burn_nonce but same payer+paymentNonce
    expectFailure(
      await callRecvWormhole({
        vaaHash: Buffer.alloc(32, 0xde),
        cctpBurnNonce: Buffer.alloc(32, 0xab),
      })
    );
  });

  it('rejects closed ForeignPayable', async () => {
    await injectForeignPayable(svm, PAYABLE_ID, { isClosed: true });
    expectFailure(await callRecvWormhole());
  });
});

// ── recv_payment_via_cctp_only ────────────────────────────────────────────────
//
// recv_payment_via_cctp_only takes two Vec<u8> messages (399 + 149 bytes minimum)
// plus 17 accounts, making the transaction ~1462 bytes — over the 1232-byte Solana
// limit. Address Lookup Tables (ALTs) would compress the account keys to fit, but
// LiteSVM 0.5.x does not support ALT lookups in v0 transactions.
//
// Tests are FULLY IMPLEMENTED but skipped via it.skip. To enable:
//   1. Upgrade litesvm to >= 1.1.0 and migrate test helpers to @solana/kit API, OR
//   2. Run against devnet with a real validator.
//
// The recv_payment_via_cctp_wormhole tests above already cover the same state
// recording and replay-protection logic for the happy path.

describe('recv_payment_via_cctp_only', () => {
  let svm: LiteSVM;
  let relayer: Keypair;
  let usdcMint: PublicKey;
  let chainRegAddr: PublicKey;
  let fpAddr: PublicKey;

  beforeEach(async () => {
    svm = createSvm();
    const owner = Keypair.generate();
    svm.airdrop(owner.publicKey, 10_000_000_000n);
    await bootstrapProgram(svm, owner);

    const { keypair } = fund(svm);
    relayer = keypair;

    usdcMint = createMint(svm, owner);

    // CCTP-only chain: no Wormhole, has CCTP. Sepolia circle domain = 0.
    chainRegAddr = await injectChainReg(svm, {
      cbChainId: SEPOLIA_CB_CHAIN_ID,
      hasCctp: true,
      circleDomain: SEPOLIA_CIRCLE_DOMAIN,
    });

    fpAddr = await injectForeignPayable(svm, PAYABLE_ID);
  });

  // Build and send a recv_payment_via_cctp_only instruction.
  async function callRecvCctpOnly(
    opts: {
      srcDomain?: number;
      dataNonce?: Buffer;
      burnNonce?: Buffer;
      payerChainId?: Buffer;
      payer?: Buffer;
      paymentNonce?: number;
    } = {}
  ) {
    const srcDomain = opts.srcDomain ?? SEPOLIA_CIRCLE_DOMAIN;
    const dataNonce = opts.dataNonce ?? Buffer.alloc(32, 0xaa);
    const burnNonce = opts.burnNonce ?? Buffer.alloc(32, 0xbb);
    const payerChainId = opts.payerChainId ?? SEPOLIA_CB_CHAIN_ID;
    const payer = opts.payer ?? PAYER_BYTES;
    const paymentNonce = opts.paymentNonce ?? 0;

    // data_message: 148-byte CCTP header + 251-byte PaymentPayload body = 399 bytes.
    const payload = encodePaymentPayload({
      payableId: PAYABLE_ID,
      nonce: BigInt(paymentNonce),
      amount: AMOUNT,
      payableChainId: SOLANA_DEVNET_CB_CHAIN_ID,
      payerChainId,
      payer,
    });
    const dataMsg = buildCctpMessage({
      srcDomain,
      nonce: dataNonce,
      sender: Buffer.from(EVM_CONTRACT),
      payload,
    });

    // burn_message: 149-byte CCTP message (> 148 required by contract).
    // burn_nonce must be at bytes [12..44] for the contract to extract it.
    const burnMsg = Buffer.alloc(149, 0);
    burnMsg.writeUInt32BE(srcDomain, 4);
    burnMsg.set(burnNonce, 12);

    const fpData = decode<any>(svm, 'ForeignPayable', fpAddr);
    const statsCur = decode<any>(svm, 'Stats', stats);
    const vaultAuth = vaultAuthorityPDA(fpAddr);

    const prog = require('./helpers/svm').createProgram(relayer);
    const ix = await prog.methods
      .recvPaymentViaCctpOnly(
        srcDomain,
        Array.from(dataNonce),
        Array.from(burnNonce),
        Array.from(payerChainId),
        Array.from(payer),
        new BN(paymentNonce),
        dataMsg,
        Buffer.alloc(0), // data_attestation (CCTP CPI stubbed in contract)
        burnMsg,
        Buffer.alloc(0) // burn_attestation (CCTP CPI stubbed in contract)
      )
      .accounts({
        relayer: relayer.publicKey,
        cctpProgram: CCTP_DEVNET,
        chainRegistry: chainRegAddr,
        foreignPayable: fpAddr,
        vaultAuthority: vaultAuth,
        usdcMint,
        vaultUsdcAta: getAta(usdcMint, vaultAuth),
        payablePayment: payablePaymentPDA(fpAddr, fpData.payments_count),
        cctpDataNoncePda: cctpDataNoncePDA(srcDomain, dataNonce),
        cctpBurnNoncePda: cctpTokenBurnNoncePDA(srcDomain, burnNonce),
        paymentNoncePda: paymentNoncePDA(payerChainId, payer, new BN(paymentNonce)),
        stats,
        activityRecord: activityRecordPDA(statsCur.total_activities),
        payableActivityPointer: payableActivityPointerPDA(fpAddr, fpData.payments_count),
        tokenProgram: TOKEN_PROGRAM_ID,
        associatedTokenProgram: ASSOCIATED_TOKEN_PROGRAM_ID,
        systemProgram: SystemProgram.programId,
      })
      .instruction();

    // Transaction exceeds 1232 bytes (399+149 byte messages + 17 accounts).
    // sendLargeVersionedIx manually serializes the MessageV0 without
    // @solana/web3.js's PACKET_DATA_SIZE limit and patches the instance's
    // serialize() so LiteSVM receives the raw bytes directly.
    return sendLargeVersionedIx(svm, ix, relayer);
  }

  it('creates PayablePayment PDA with correct fields', async () => {
    expectSuccess(await callRecvCctpOnly());

    const pp = decode<any>(svm, 'PayablePayment', payablePaymentPDA(fpAddr, new BN(0)));
    expect(Array.from(pp.payer)).toEqual(Array.from(PAYER_BYTES));
    expect(pp.amount.toNumber()).toBe(Number(AMOUNT));
    expect(pp.payable.toBase58()).toBe(fpAddr.toBase58());
    expect(pp.token_mint.toBase58()).toBe(usdcMint.toBase58());
    expect(Array.from(pp.payer_chain_id)).toEqual(Array.from(SEPOLIA_CB_CHAIN_ID));
  });

  it('creates CctpDataNonce and CctpTokenBurnNonce PDAs', async () => {
    const dataNonce = Buffer.alloc(32, 0xcc);
    const burnNonce = Buffer.alloc(32, 0xdd);
    expectSuccess(await callRecvCctpOnly({ dataNonce, burnNonce }));
    expect(svm.getAccount(cctpDataNoncePDA(SEPOLIA_CIRCLE_DOMAIN, dataNonce))).toBeTruthy();
    expect(svm.getAccount(cctpTokenBurnNoncePDA(SEPOLIA_CIRCLE_DOMAIN, burnNonce))).toBeTruthy();
  });

  it('creates PaymentNonce PDA', async () => {
    expectSuccess(await callRecvCctpOnly());
    expect(svm.getAccount(paymentNoncePDA(SEPOLIA_CB_CHAIN_ID, PAYER_BYTES, new BN(0)))).toBeTruthy();
  });

  it('increments stats.total_payable_payments and received_cctp_payment_messages', async () => {
    const before = decode<any>(svm, 'Stats', stats);
    expectSuccess(await callRecvCctpOnly());
    const after = decode<any>(svm, 'Stats', stats);
    expect(after.total_payable_payments.toNumber()).toBe(before.total_payable_payments.toNumber() + 1);
    expect(after.received_cctp_payment_messages.toNumber()).toBe(before.received_cctp_payment_messages.toNumber() + 1);
  });

  it('rejects replay (same data_nonce twice)', async () => {
    const dataNonce = Buffer.alloc(32, 0xee);
    expectSuccess(await callRecvCctpOnly({ dataNonce }));
    // Same data_nonce → CctpDataNonce PDA already exists → init fails
    expectFailure(
      await callRecvCctpOnly({
        dataNonce, // same
        burnNonce: Buffer.alloc(32, 0xff),
        paymentNonce: 1,
      })
    );
  });

  it('rejects replay (same payment_nonce twice)', async () => {
    // First call succeeds (paymentNonce = 0, payer = PAYER_BYTES)
    expectSuccess(await callRecvCctpOnly({ dataNonce: Buffer.alloc(32, 0x11) }));
    // Second call has different data/burn nonces but same payer + paymentNonce = 0
    expectFailure(
      await callRecvCctpOnly({
        dataNonce: Buffer.alloc(32, 0x22),
        burnNonce: Buffer.alloc(32, 0x33),
      })
    );
  });

  it('rejects closed ForeignPayable', async () => {
    await injectForeignPayable(svm, PAYABLE_ID, { isClosed: true });
    expectFailure(await callRecvCctpOnly());
  });

  it('rejects wrong src_domain in data_message', async () => {
    // chain_registry expects SEPOLIA_CIRCLE_DOMAIN (0) but message has domain 99
    expectFailure(await callRecvCctpOnly({ srcDomain: 99 }));
  });
});
