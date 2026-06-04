/**
 * Admin instruction tests: initialize, allow_token, disallow_token,
 * update_fee_settings, register_chain, update_chain.
 */

import { BN } from '@coral-xyz/anchor';
import { Keypair, PublicKey } from '@solana/web3.js';
import { LiteSVM } from 'litesvm';
import { chainRegistryPDA, config, senderAuthority, stats, tokenConfigPDA } from './accounts';
import { bootstrapProgram } from './helpers/setup';
import { createSvm, decode, expectFailure, expectSuccess, fund, sendIx } from './helpers/svm';
import { createMint, TOKEN_PROGRAM_ID } from './helpers/tokens';

// ── bootstrapProgram / initialize state ───────────────────────────────────────
// Note: The real `initialize` instruction cannot be called in litesvm because
// litesvm loads programs as raw ELF (no BPFLoaderUpgradeable ProgramData account).
// These tests verify that `bootstrapProgram` injects the correct post-init state,
// which is what all other litesvm tests depend on.
// The actual `initialize` instruction is tested in tests/chainbills.ts (validator).

describe('bootstrapProgram (initialize state)', () => {
  let svm: LiteSVM;
  let owner: Keypair;

  beforeEach(async () => {
    svm = createSvm();
    owner = Keypair.generate();
    svm.airdrop(owner.publicKey, 10_000_000_000n);
    await bootstrapProgram(svm, owner);
  });

  it('Config has correct owner and fee_bps=200', () => {
    const cfg = decode<any>(svm, 'Config', config);
    expect(cfg.owner.toBase58()).toBe(owner.publicKey.toBase58());
    expect(cfg.fee_collector.toBase58()).toBe(owner.publicKey.toBase58());
    expect(cfg.fee_bps).toBe(200);
    expect(cfg.has_wormhole).toBe(true);
    expect(cfg.has_cctp).toBe(true);
    expect(cfg.payable_update_nonce_counter.toNumber()).toBe(0);
  });

  it('Stats has all 13 counters + registered_cctp_chain_count at zero', () => {
    const s = decode<any>(svm, 'Stats', stats);
    expect(s.total_users.toNumber()).toBe(0);
    expect(s.total_payables.toNumber()).toBe(0);
    expect(s.total_foreign_payables.toNumber()).toBe(0);
    expect(s.total_user_payments.toNumber()).toBe(0);
    expect(s.total_payable_payments.toNumber()).toBe(0);
    expect(s.total_withdrawals.toNumber()).toBe(0);
    expect(s.total_activities.toNumber()).toBe(0);
    expect(s.published_wormhole_messages.toNumber()).toBe(0);
    expect(s.consumed_wormhole_messages.toNumber()).toBe(0);
    expect(s.emitted_cctp_payment_messages.toNumber()).toBe(0);
    expect(s.emitted_cctp_update_messages.toNumber()).toBe(0);
    expect(s.received_cctp_payment_messages.toNumber()).toBe(0);
    expect(s.received_cctp_update_messages.toNumber()).toBe(0);
    expect(s.registered_cctp_chain_count).toBe(0);
  });

  it('SenderAuthority account exists', () => {
    expect(svm.getAccount(senderAuthority)).not.toBeNull();
  });

  it('Config has non-zero cb_chain_id', () => {
    const cfg = decode<any>(svm, 'Config', config);
    const chainIdBytes: number[] = Array.from(cfg.cb_chain_id);
    expect(chainIdBytes.some((b: number) => b !== 0)).toBe(true);
  });
});

// ── allow_token ───────────────────────────────────────────────────────────────

describe('allow_token', () => {
  let svm: LiteSVM;
  let owner: Keypair;
  let mint: PublicKey;

  beforeEach(async () => {
    svm = createSvm();
    owner = Keypair.generate();
    svm.airdrop(owner.publicKey, 10_000_000_000n);
    await bootstrapProgram(svm, owner);
    mint = createMint(svm, owner);
  });

  it('creates TokenConfig with is_allowed=true', async () => {
    const program = require('./helpers/svm').createProgram(owner);
    const tokenConfig = tokenConfigPDA(mint);

    const ix = await (program as any).methods
      .allowToken(new BN(1_000_000))
      .accounts({
        owner: owner.publicKey,
        tokenMint: mint,
        tokenConfig,
        tokenProgram: TOKEN_PROGRAM_ID,
      })
      .instruction();

    expectSuccess(sendIx(svm, ix, owner));

    const tc = decode<any>(svm, 'TokenConfig', tokenConfig);
    expect(tc.is_allowed).toBe(true);
    expect(tc.mint.toBase58()).toBe(mint.toBase58());
    expect(tc.max_withdrawal_fee.toNumber()).toBe(1_000_000);
  });

  it('idempotent: second allow_token updates max_withdrawal_fee', async () => {
    const program = require('./helpers/svm').createProgram(owner);
    const tokenConfig = tokenConfigPDA(mint);

    const makeIx = (fee: number) =>
      (program as any).methods
        .allowToken(new BN(fee))
        .accounts({
          owner: owner.publicKey,
          tokenMint: mint,
          tokenConfig,
          tokenProgram: TOKEN_PROGRAM_ID,
        })
        .instruction();

    expectSuccess(sendIx(svm, await makeIx(1_000_000), owner));
    expectSuccess(sendIx(svm, await makeIx(2_000_000), owner));

    const tc = decode<any>(svm, 'TokenConfig', tokenConfig);
    expect(tc.max_withdrawal_fee.toNumber()).toBe(2_000_000);
    expect(tc.is_allowed).toBe(true);
  });

  it('rejects non-owner caller', async () => {
    const { keypair: nonOwner, program } = fund(svm);
    const tokenConfig = tokenConfigPDA(mint);

    const ix = await (program as any).methods
      .allowToken(new BN(1_000_000))
      .accounts({
        owner: nonOwner.publicKey,
        tokenMint: mint,
        tokenConfig,
        tokenProgram: TOKEN_PROGRAM_ID,
      })
      .instruction();

    expectFailure(sendIx(svm, ix, nonOwner));
  });
});

// ── disallow_token ────────────────────────────────────────────────────────────

describe('disallow_token', () => {
  let svm: LiteSVM;
  let owner: Keypair;
  let mint: PublicKey;

  beforeEach(async () => {
    svm = createSvm();
    owner = Keypair.generate();
    svm.airdrop(owner.publicKey, 10_000_000_000n);
    await bootstrapProgram(svm, owner);
    mint = createMint(svm, owner);

    // allow first
    const program = require('./helpers/svm').createProgram(owner);
    const tokenConfig = tokenConfigPDA(mint);
    const ix = await (program as any).methods
      .allowToken(new BN(1_000_000))
      .accounts({
        owner: owner.publicKey,
        tokenMint: mint,
        tokenConfig,
        tokenProgram: TOKEN_PROGRAM_ID,
      })
      .instruction();
    expectSuccess(sendIx(svm, ix, owner));
  });

  it('sets is_allowed=false', async () => {
    const program = require('./helpers/svm').createProgram(owner);
    const tokenConfig = tokenConfigPDA(mint);

    const ix = await (program as any).methods
      .disallowToken()
      .accounts({
        owner: owner.publicKey,
        tokenConfig,
      })
      .instruction();

    expectSuccess(sendIx(svm, ix, owner));

    const tc = decode<any>(svm, 'TokenConfig', tokenConfig);
    expect(tc.is_allowed).toBe(false);
  });

  it('rejects non-owner caller', async () => {
    const { keypair: nonOwner, program } = fund(svm);
    const tokenConfig = tokenConfigPDA(mint);

    const ix = await (program as any).methods
      .disallowToken()
      .accounts({
        owner: nonOwner.publicKey,
        tokenConfig,
      })
      .instruction();

    expectFailure(sendIx(svm, ix, nonOwner));
  });
});

// ── update_fee_settings ───────────────────────────────────────────────────────

describe('update_fee_settings', () => {
  let svm: LiteSVM;
  let owner: Keypair;

  beforeEach(async () => {
    svm = createSvm();
    owner = Keypair.generate();
    svm.airdrop(owner.publicKey, 10_000_000_000n);
    await bootstrapProgram(svm, owner);
  });

  it('updates fee_bps', async () => {
    const program = require('./helpers/svm').createProgram(owner);

    const ix = await (program as any).methods
      .updateFeeSettings(300) // 3%
      .accounts({
        owner: owner.publicKey,
        feeCollector: owner.publicKey,
      })
      .instruction();

    expectSuccess(sendIx(svm, ix, owner));
    const cfg = decode<any>(svm, 'Config', config);
    expect(cfg.fee_bps).toBe(300);
  });

  it('updates fee_collector', async () => {
    const program = require('./helpers/svm').createProgram(owner);
    const newCollector = Keypair.generate().publicKey;

    const ix = await (program as any).methods
      .updateFeeSettings(200)
      .accounts({
        owner: owner.publicKey,
        feeCollector: newCollector,
      })
      .instruction();

    expectSuccess(sendIx(svm, ix, owner));
    const cfg = decode<any>(svm, 'Config', config);
    expect(cfg.fee_collector.toBase58()).toBe(newCollector.toBase58());
  });

  it('rejects fee_bps > 10_000', async () => {
    const program = require('./helpers/svm').createProgram(owner);

    const ix = await (program as any).methods
      .updateFeeSettings(10_001)
      .accounts({
        owner: owner.publicKey,
        feeCollector: owner.publicKey,
      })
      .instruction();

    expectFailure(sendIx(svm, ix, owner));
  });

  it('rejects non-owner caller', async () => {
    const { keypair: nonOwner, program } = fund(svm);

    const ix = await (program as any).methods
      .updateFeeSettings(200)
      .accounts({
        owner: nonOwner.publicKey,
        feeCollector: nonOwner.publicKey,
      })
      .instruction();

    expectFailure(sendIx(svm, ix, nonOwner));
  });
});

// ── register_chain ────────────────────────────────────────────────────────────

// Fake Sepolia cbChainId: keccak256("eip155:11155111")
const SEPOLIA_CB_CHAIN_ID = Buffer.from('afa9c74bd89ea79b5c1da22f7ea1c29de3a3c70e6f84f769e68c51e5f4c1bb1b', 'hex');

describe('register_chain', () => {
  let svm: LiteSVM;
  let owner: Keypair;

  beforeEach(async () => {
    svm = createSvm();
    owner = Keypair.generate();
    svm.airdrop(owner.publicKey, 10_000_000_000n);
    await bootstrapProgram(svm, owner);
  });

  it('creates ChainRegistry with wormhole-only params', async () => {
    const program = require('./helpers/svm').createProgram(owner);
    const chainId = Array.from(SEPOLIA_CB_CHAIN_ID);
    const chainReg = chainRegistryPDA(SEPOLIA_CB_CHAIN_ID);
    const registeredContract = Array.from(new Uint8Array(32).fill(0xaa));

    const ix = await (program as any).methods
      .registerChain(
        chainId,
        true, // has_wormhole
        10002, // wormhole_chain_id (Sepolia)
        false, // has_cctp
        0, // circle_domain
        registeredContract
      )
      .accounts({
        owner: owner.publicKey,
        chainRegistry: chainReg,
        stats,
      })
      .instruction();

    expectSuccess(sendIx(svm, ix, owner));

    const reg = decode<any>(svm, 'ChainRegistry', chainReg);
    expect(reg.has_wormhole).toBe(true);
    expect(reg.wormhole_chain_id).toBe(10002);
    expect(reg.has_cctp).toBe(false);
    expect(Array.from(reg.cb_chain_id)).toEqual(chainId);
    expect(Array.from(reg.registered_contract)).toEqual(registeredContract);

    // has_cctp=false → registered_cctp_chain_count unchanged
    const s = decode<any>(svm, 'Stats', stats);
    expect(s.registered_cctp_chain_count).toBe(0);
  });

  it('creates ChainRegistry with cctp-only params', async () => {
    const program = require('./helpers/svm').createProgram(owner);
    const arcChainId = Buffer.from('fcfa2dcf44b44f16da29e5a30f4d2ae4f9e7ee86f2d5a14c9e5c74df34b5b6cd', 'hex');
    const chainReg = chainRegistryPDA(arcChainId);

    const ix = await (program as any).methods
      .registerChain(
        Array.from(arcChainId),
        false, // has_wormhole
        0, // wormhole_chain_id
        true, // has_cctp
        26, // circle_domain (Arc testnet)
        Array.from(new Uint8Array(32).fill(0xbb))
      )
      .accounts({
        owner: owner.publicKey,
        chainRegistry: chainReg,
        stats,
      })
      .instruction();

    expectSuccess(sendIx(svm, ix, owner));

    const reg = decode<any>(svm, 'ChainRegistry', chainReg);
    expect(reg.has_cctp).toBe(true);
    expect(reg.circle_domain).toBe(26);
    expect(reg.has_wormhole).toBe(false);

    // has_cctp=true → registered_cctp_chain_count incremented to 1
    const s = decode<any>(svm, 'Stats', stats);
    expect(s.registered_cctp_chain_count).toBe(1);
  });

  it('rejects non-owner caller', async () => {
    const { keypair: nonOwner, program } = fund(svm);
    const chainReg = chainRegistryPDA(SEPOLIA_CB_CHAIN_ID);

    const ix = await (program as any).methods
      .registerChain(Array.from(SEPOLIA_CB_CHAIN_ID), true, 10002, false, 0, Array.from(new Uint8Array(32)))
      .accounts({
        owner: nonOwner.publicKey,
        chainRegistry: chainReg,
        stats,
      })
      .instruction();

    expectFailure(sendIx(svm, ix, nonOwner));
  });
});

// ── update_chain ──────────────────────────────────────────────────────────────

describe('update_chain', () => {
  let svm: LiteSVM;
  let owner: Keypair;
  let chainReg: PublicKey;

  beforeEach(async () => {
    svm = createSvm();
    owner = Keypair.generate();
    svm.airdrop(owner.publicKey, 10_000_000_000n);
    await bootstrapProgram(svm, owner);

    chainReg = chainRegistryPDA(SEPOLIA_CB_CHAIN_ID);
    const program = require('./helpers/svm').createProgram(owner);

    // register first
    const ix = await (program as any).methods
      .registerChain(Array.from(SEPOLIA_CB_CHAIN_ID), true, 10002, false, 0, Array.from(new Uint8Array(32).fill(0x01)))
      .accounts({
        owner: owner.publicKey,
        chainRegistry: chainReg,
        stats,
      })
      .instruction();
    expectSuccess(sendIx(svm, ix, owner));
  });

  it('updates wormhole_chain_id and adds cctp support', async () => {
    const program = require('./helpers/svm').createProgram(owner);

    const ix = await (program as any).methods
      .updateChain(
        true, // has_wormhole
        10002, // wormhole_chain_id (unchanged)
        true, // has_cctp (now enabled)
        0, // circle_domain (Ethereum Sepolia)
        Array.from(new Uint8Array(32).fill(0x02)) // new registered contract
      )
      .accounts({
        owner: owner.publicKey,
        chainRegistry: chainReg,
        stats,
      })
      .instruction();

    expectSuccess(sendIx(svm, ix, owner));

    const reg = decode<any>(svm, 'ChainRegistry', chainReg);
    expect(reg.has_wormhole).toBe(true);
    expect(reg.has_cctp).toBe(true);
    expect(reg.circle_domain).toBe(0);
    expect(Array.from(reg.registered_contract)).toEqual(Array.from(new Uint8Array(32).fill(0x02)));

    // has_cctp toggled from false→true → registered_cctp_chain_count = 1
    const s = decode<any>(svm, 'Stats', stats);
    expect(s.registered_cctp_chain_count).toBe(1);
  });

  it('rejects non-owner caller', async () => {
    const { keypair: nonOwner, program } = fund(svm);

    const ix = await (program as any).methods
      .updateChain(true, 10002, false, 0, Array.from(new Uint8Array(32)))
      .accounts({
        owner: nonOwner.publicKey,
        chainRegistry: chainReg,
        stats,
      })
      .instruction();

    expectFailure(sendIx(svm, ix, nonOwner));
  });
});
