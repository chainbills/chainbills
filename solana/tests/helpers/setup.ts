/**
 * Test bootstrap helpers.
 *
 * Two strategies:
 *
 * 1. `bootstrapProgram(svm, owner)` — injects Config + Stats + SenderAuthority
 *    accounts directly via setAccount, bypassing the upgrade-authority check.
 *    Use this as `beforeEach` setup for every test except initialize itself.
 *
 * 2. `callInitialize(svm, owner, program)` — calls the real `initialize`
 *    instruction after patching the program data upgrade authority.
 *    Use only in admin.test.ts initialize describe block.
 */

import { LiteSVM } from 'litesvm';
import { Keypair, PublicKey, SystemProgram } from '@solana/web3.js';
import { BN } from '@coral-xyz/anchor';
import type { Program } from '@coral-xyz/anchor';
import {
  PROGRAM_ID,
  createSvm,
  decode,
  encodeAccount,
  fund,
  injectAccount,
  sendIx,
  setProgramUpgradeAuthority,
  expectSuccess,
} from './svm';
import { createMint } from './tokens';
import type { Chainbills } from '../../target/types/chainbills';
import { config, senderAuthority, stats, tokenConfigPDA, chainRegistryPDA } from '../accounts';

// ── Solana devnet cbChainId constant (matches constants.rs) ───────────────────
// keccak256("solana:EtWTRABZaYq6iMfeYKouRu166VU2xqa1")
export const SOLANA_DEVNET_CB_CHAIN_ID = Buffer.from([
  0x31, 0x8e, 0x88, 0x6b, 0x7d, 0x5a, 0x2e, 0x6f, 0x89, 0xc5, 0x0c, 0xd1, 0xcd, 0xc3, 0x61, 0x4e, 0x5f, 0x66, 0x53,
  0x2f, 0x67, 0x3b, 0x5f, 0x14, 0x44, 0x8b, 0x9b, 0x58, 0xc1, 0x2e, 0x0e, 0x6e,
]);

// ── Strategy 1: direct account injection ─────────────────────────────────────

/**
 * Inject a post-initialized Config, Stats, and SenderAuthority into `svm`
 * without running the actual `initialize` instruction.
 *
 * Use this in `beforeEach` for every test that needs the program initialized
 * but is not specifically testing the `initialize` instruction itself.
 */
export async function bootstrapProgram(svm: LiteSVM, owner: Keypair): Promise<void> {
  // Config
  const configData = await encodeAccount('Config', {
    owner: owner.publicKey,
    fee_collector: owner.publicKey,
    fee_bps: 200,
    cb_chain_id: Array.from(SOLANA_DEVNET_CB_CHAIN_ID),
    payable_update_nonce_counter: new BN(0),
    has_wormhole: true,
    has_cctp: true,
  });
  injectAccount(svm, config, configData);

  // Stats — all 13 u64 counters + registered_cctp_chain_count (u32) start at 0
  const statsData = await encodeAccount('Stats', {
    total_users: new BN(0),
    total_payables: new BN(0),
    total_foreign_payables: new BN(0),
    total_user_payments: new BN(0),
    total_payable_payments: new BN(0),
    total_withdrawals: new BN(0),
    total_activities: new BN(0),
    published_wormhole_messages: new BN(0),
    consumed_wormhole_messages: new BN(0),
    emitted_cctp_payment_messages: new BN(0),
    emitted_cctp_update_messages: new BN(0),
    received_cctp_payment_messages: new BN(0),
    received_cctp_update_messages: new BN(0),
    registered_cctp_chain_count: 0,
  });
  injectAccount(svm, stats, statsData);

  // SenderAuthority — no fields, just discriminator
  const saData = await encodeAccount('SenderAuthority', {});
  injectAccount(svm, senderAuthority, saData);
}

// ── Strategy 2: real initialize instruction ───────────────────────────────────

/**
 * Patch the program data account so `owner` is the upgrade authority,
 * then call the `initialize` instruction for real.
 * Only needed in tests that specifically test `initialize`.
 */
export async function callInitialize(svm: LiteSVM, owner: Keypair, program: Program<Chainbills>): Promise<void> {
  setProgramUpgradeAuthority(svm, owner.publicKey);

  // Derive programData address from program account bytes
  const programAccount = svm.getAccount(PROGRAM_ID)!;
  const programDataAddress = new PublicKey(Buffer.from(programAccount.data).slice(4, 36));

  const ix = await (program as any).methods
    .initialize()
    .accounts({
      authority: owner.publicKey,
      programData: programDataAddress,
    })
    .instruction();

  const result = sendIx(svm, ix, owner);
  expectSuccess(result);
}

// ── allow_token shortcut ──────────────────────────────────────────────────────

/**
 * Allow a token by calling `allow_token`. Returns the mint pubkey.
 * Requires bootstrapProgram or callInitialize to have run first.
 */
export async function allowToken(
  svm: LiteSVM,
  owner: Keypair,
  program: Program<Chainbills>,
  maxWithdrawalFee: bigint = 1_000_000n
): Promise<PublicKey> {
  const mint = createMint(svm, owner);
  const tokenConfig = tokenConfigPDA(mint);

  const ix = await (program as any).methods
    .allowToken(new BN(maxWithdrawalFee.toString()))
    .accounts({
      owner: owner.publicKey,
      tokenMint: mint,
      tokenConfig,
      tokenProgram: (await import('./tokens')).TOKEN_PROGRAM_ID,
    })
    .instruction();

  const result = sendIx(svm, ix, owner);
  expectSuccess(result);
  return mint;
}

// ── Full bootstrap with token ─────────────────────────────────────────────────

export interface BootstrapResult {
  svm: LiteSVM;
  owner: Keypair;
  mint: PublicKey;
}

/**
 * Full test environment: fresh SVM + initialized state + one allowed token.
 * Convenience wrapper used by payment and withdrawal tests.
 */
export async function bootstrap(program?: Program<Chainbills>): Promise<BootstrapResult> {
  const svm = createSvm();
  const owner = Keypair.generate();
  svm.airdrop(owner.publicKey, 10_000_000_000n);
  await bootstrapProgram(svm, owner);

  const ownerProgram = program ?? (await import('./svm')).createProgram(owner);
  const mint = await allowToken(svm, owner, ownerProgram as Program<Chainbills>);

  return { svm, owner, mint };
}
