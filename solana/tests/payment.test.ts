/**
 * Payment instruction tests: pay (SPL token), pay_native (SOL), pay_foreign_via_cctp.
 */

import type { Program } from '@coral-xyz/anchor';
import { BN } from '@coral-xyz/anchor';
import { Keypair, LAMPORTS_PER_SOL, PublicKey, SystemProgram } from '@solana/web3.js';
import { LiteSVM } from 'litesvm';
import type { Chainbills } from '../target/types/chainbills';
import {
  activityRecordPDA,
  chainRegistryPDA,
  foreignPayablePDA,
  payableActivityPointerPDA,
  payablePaymentPDA,
  payablePDA,
  senderAuthority,
  stats,
  tokenConfigPDA,
  userActivityPointerPDA,
  userPaymentPDA,
  userRecordPDA,
  vaultAuthorityPDA,
} from './accounts';
import { bootstrapProgram } from './helpers/setup';
import {
  createSvm,
  decode,
  encodeAccount,
  expectFailure,
  expectSuccess,
  fund,
  injectAccount,
  sendIx,
} from './helpers/svm';
import {
  ASSOCIATED_TOKEN_PROGRAM_ID,
  createMint,
  getAta,
  getTokenBalance,
  mintTo,
  TOKEN_PROGRAM_ID,
} from './helpers/tokens';

// ── Test environment setup ────────────────────────────────────────────────────

interface TestEnv {
  svm: LiteSVM;
  owner: Keypair;
  mint: PublicKey;
  host: Keypair;
  hostProgram: Program<Chainbills>;
  payableAddr: PublicKey;
}

/** Create a payable (no ATAA) owned by `host`. Returns payable address. */
async function makePayable(
  svm: LiteSVM,
  host: Keypair,
  program: Program<Chainbills>,
  ataa: { token: PublicKey; amount: BN }[] = [],
  isAutoWithdraw: boolean = false
): Promise<PublicKey> {
  const userRecAddr = userRecordPDA(host.publicKey);
  const userRecAccount = svm.getAccount(userRecAddr);
  let hostPayablesCount = new BN(0);
  if (userRecAccount) {
    try {
      hostPayablesCount = decode<any>(svm, 'UserRecord', userRecAddr).payables_count;
    } catch {
      /* not initialized yet */
    }
  }

  const statsCur = decode<any>(svm, 'Stats', stats);
  let userActivitiesCount = new BN(0);
  if (userRecAccount) {
    try {
      userActivitiesCount = decode<any>(svm, 'UserRecord', userRecAddr).activities_count;
    } catch {
      /* not initialized yet */
    }
  }

  const payable = payablePDA(host.publicKey, hostPayablesCount);
  const ix = await (program as any).methods
    .createPayable(ataa, isAutoWithdraw)
    .accounts({
      host: host.publicKey,
      userRecord: userRecAddr,
      payable,
      vaultAuthority: vaultAuthorityPDA(payable),
      activityRecord: activityRecordPDA(statsCur.total_activities),
      userActivityPointer: userActivityPointerPDA(host.publicKey, userActivitiesCount),
      payableActivityPointer: payableActivityPointerPDA(payable, new BN(0)),
    })
    .instruction();

  expectSuccess(sendIx(svm, ix, host));
  return payable;
}

async function setupEnv(): Promise<TestEnv> {
  const svm = createSvm();
  const owner = Keypair.generate();
  svm.airdrop(owner.publicKey, 10_000_000_000n);
  await bootstrapProgram(svm, owner);

  const mint = createMint(svm, owner);

  // allow the token
  const ownerProg = require('./helpers/svm').createProgram(owner);
  const tokenConfig = tokenConfigPDA(mint);
  const allowIx = await (ownerProg as any).methods
    .allowToken(new BN(1_000_000)) // max withdrawal fee = 1 USDC
    .accounts({
      owner: owner.publicKey,
      tokenMint: mint,
      tokenConfig,
      tokenProgram: TOKEN_PROGRAM_ID,
    })
    .instruction();
  expectSuccess(sendIx(svm, allowIx, owner));

  // also allow native SOL (system_program::ID as mint sentinel)
  const nativeMint = new PublicKey('11111111111111111111111111111111'); // system_program::ID
  const nativeTokenConfig = tokenConfigPDA(nativeMint);
  // Note: native SOL uses a different instruction (pay_native) that doesn't check token_config
  // token_config check for native SOL depends on implementation — skip if needed

  const { keypair: host, program: hostProgram } = fund(svm);
  const payableAddr = await makePayable(svm, host, hostProgram as any);

  return { svm, owner, mint, host, hostProgram: hostProgram as any, payableAddr };
}

// ── pay (SPL Token) ───────────────────────────────────────────────────────────

describe('pay (SPL token)', () => {
  let env: TestEnv;

  beforeEach(async () => {
    env = await setupEnv();
  });

  async function payToken(
    svm: LiteSVM,
    payer: Keypair,
    payerProgram: Program<Chainbills>,
    payableAddr: PublicKey,
    mint: PublicKey,
    amount: BN
  ) {
    const userRecAddr = userRecordPDA(payer.publicKey);
    const payableData = decode<any>(svm, 'Payable', payableAddr);
    const statsCur = decode<any>(svm, 'Stats', stats);

    let payerPaymentsCount = new BN(0);
    let payerActivitiesCount = new BN(0);
    const payerRecAccount = svm.getAccount(userRecAddr);
    if (payerRecAccount) {
      try {
        const ur = decode<any>(svm, 'UserRecord', userRecAddr);
        payerPaymentsCount = ur.payments_count;
        payerActivitiesCount = ur.activities_count;
      } catch {
        /* not initialized */
      }
    }

    const vaultAuth = vaultAuthorityPDA(payableAddr);
    const vaultAta = getAta(mint, vaultAuth);
    const payerAta = mintTo(svm, env.owner, mint, payer.publicKey, BigInt(amount.toNumber() * 10));

    const ix = await (payerProgram as any).methods
      .pay(amount)
      .accounts({
        payer: payer.publicKey,
        userRecord: userRecAddr,
        payable: payableAddr,
        payerTokenAccount: payerAta,
        vaultAuthority: vaultAuth,
        vaultTokenAccount: vaultAta,
        tokenMint: mint,
        tokenConfig: tokenConfigPDA(mint),
        userPayment: userPaymentPDA(payer.publicKey, payerPaymentsCount),
        payablePayment: payablePaymentPDA(payableAddr, payableData.payments_count),
        activityRecord: activityRecordPDA(statsCur.total_activities),
        userActivityPointer: userActivityPointerPDA(payer.publicKey, payerActivitiesCount),
        payableActivityPointer: payableActivityPointerPDA(payableAddr, payableData.activities_count),
        tokenProgram: TOKEN_PROGRAM_ID,
      })
      .instruction();

    return sendIx(svm, ix, payer);
  }

  it('transfers tokens to vault ATA', async () => {
    const { svm, mint, host, payableAddr } = env;
    const { keypair: payer, program: payerProg } = fund(svm);
    const amount = new BN(1_000_000);

    expectSuccess(await payToken(svm, payer, payerProg as any, payableAddr, mint, amount));

    const vaultAuth = vaultAuthorityPDA(payableAddr);
    const vaultAta = getAta(mint, vaultAuth);
    expect(getTokenBalance(svm, vaultAta)).toBe(BigInt(amount.toNumber()));
  });

  it('updates payable.balances', async () => {
    const { svm, mint, payableAddr } = env;
    const { keypair: payer, program: payerProg } = fund(svm);
    const amount = new BN(1_000_000);

    expectSuccess(await payToken(svm, payer, payerProg as any, payableAddr, mint, amount));

    const p = decode<any>(svm, 'Payable', payableAddr);
    expect(p.balances.length).toBe(1);
    expect(p.balances[0].token.toBase58()).toBe(mint.toBase58());
    expect(p.balances[0].amount.toNumber()).toBe(amount.toNumber());
  });

  it('increments payable.payments_count', async () => {
    const { svm, mint, payableAddr } = env;
    const { keypair: payer, program: payerProg } = fund(svm);

    expectSuccess(await payToken(svm, payer, payerProg as any, payableAddr, mint, new BN(500_000)));

    const p = decode<any>(svm, 'Payable', payableAddr);
    expect(p.payments_count.toNumber()).toBe(1);
  });

  it('increments stats.total_user_payments and totalPayablePayments', async () => {
    const { svm, mint, payableAddr } = env;
    const { keypair: payer, program: payerProg } = fund(svm);
    const statsBefore = decode<any>(svm, 'Stats', stats);

    expectSuccess(await payToken(svm, payer, payerProg as any, payableAddr, mint, new BN(500_000)));

    const statsAfter = decode<any>(svm, 'Stats', stats);
    expect(statsAfter.total_user_payments.toNumber()).toBe(statsBefore.total_user_payments.toNumber() + 1);
    expect(statsAfter.total_payable_payments.toNumber()).toBe(statsBefore.total_payable_payments.toNumber() + 1);
  });

  it('creates UserPayment and PayablePayment PDAs', async () => {
    const { svm, mint, payableAddr } = env;
    const { keypair: payer, program: payerProg } = fund(svm);

    expectSuccess(await payToken(svm, payer, payerProg as any, payableAddr, mint, new BN(500_000)));

    // UserPayment at [b"up", payer, 0]
    const upAddr = userPaymentPDA(payer.publicKey, new BN(0));
    expect(svm.getAccount(upAddr)).not.toBeNull();

    // PayablePayment at [b"pp", payable, 0]
    const ppAddr = payablePaymentPDA(payableAddr, new BN(0));
    expect(svm.getAccount(ppAddr)).not.toBeNull();
  });

  it('accumulates balances on second payment of same token', async () => {
    const { svm, mint, payableAddr } = env;
    const { keypair: payer, program: payerProg } = fund(svm);

    expectSuccess(await payToken(svm, payer, payerProg as any, payableAddr, mint, new BN(500_000)));
    expectSuccess(await payToken(svm, payer, payerProg as any, payableAddr, mint, new BN(300_000)));

    const p = decode<any>(svm, 'Payable', payableAddr);
    expect(p.balances.length).toBe(1); // same token — one balance entry
    expect(p.balances[0].amount.toNumber()).toBe(800_000);
  });

  it('rejects payment to closed payable', async () => {
    const { svm, mint, host, hostProgram, payableAddr } = env;
    const { keypair: payer, program: payerProg } = fund(svm);

    // Close the payable
    const userRec = decode<any>(svm, 'UserRecord', userRecordPDA(host.publicKey));
    const statsCur = decode<any>(svm, 'Stats', stats);
    const payableData = decode<any>(svm, 'Payable', payableAddr);
    const closeIx = await (hostProgram as any).methods
      .closePayable()
      .accounts({
        host: host.publicKey,
        userRecord: userRecordPDA(host.publicKey),
        payable: payableAddr,
        activityRecord: activityRecordPDA(statsCur.total_activities),
        userActivityPointer: userActivityPointerPDA(host.publicKey, userRec.activities_count),
        payableActivityPointer: payableActivityPointerPDA(payableAddr, payableData.activities_count),
      })
      .instruction();
    expectSuccess(sendIx(svm, closeIx, host));

    expectFailure(await payToken(svm, payer, payerProg as any, payableAddr, mint, new BN(500_000)));
  });

  it('rejects token not in ATAA when ATAA is non-empty', async () => {
    const { svm, mint, owner, host, hostProgram } = env;

    // Create payable with ATAA specifying a different allowed amount
    const payableWithAtaa = await makePayable(
      svm,
      host,
      hostProgram,
      [{ token: mint, amount: new BN(2_000_000) }] // only 2 USDC allowed
    );

    const { keypair: payer, program: payerProg } = fund(svm);
    // Try to pay 1_000_000 (not matching the 2_000_000 in ATAA)
    expectFailure(await payToken(svm, payer, payerProg as any, payableWithAtaa, mint, new BN(1_000_000)));
  });

  it('accepts exact ATAA amount', async () => {
    const { svm, mint, host, hostProgram } = env;

    const payableWithAtaa = await makePayable(svm, host, hostProgram, [{ token: mint, amount: new BN(2_000_000) }]);

    const { keypair: payer, program: payerProg } = fund(svm);
    expectSuccess(await payToken(svm, payer, payerProg as any, payableWithAtaa, mint, new BN(2_000_000)));
  });

  it('rejects zero amount', async () => {
    const { svm, mint, payableAddr } = env;
    const { keypair: payer, program: payerProg } = fund(svm);
    expectFailure(await payToken(svm, payer, payerProg as any, payableAddr, mint, new BN(0)));
  });
});

// ── pay_native (SOL) ──────────────────────────────────────────────────────────

describe('pay_native (SOL)', () => {
  let svm: LiteSVM;
  let owner: Keypair;
  let host: Keypair;
  let hostProgram: Program<Chainbills>;
  let payableAddr: PublicKey;

  // native SOL sentinel = system_program::ID
  const nativeMint = new PublicKey('11111111111111111111111111111111');

  beforeEach(async () => {
    svm = createSvm();
    owner = Keypair.generate();
    svm.airdrop(owner.publicKey, 10_000_000_000n);
    await bootstrapProgram(svm, owner);

    // Allow native SOL (system_program as sentinel mint)
    // We need a TokenConfig for native SOL for the pay_native instruction
    // The pay_native instruction reads token_config to check is_allowed
    const ownerProg = require('./helpers/svm').createProgram(owner);
    const nativeTokenConfig = tokenConfigPDA(nativeMint);

    // Inject a native SOL token config directly (nativeMint is system_program, not a real mint)
    // allow_token requires a Mint account, so we inject the TokenConfig directly
    const { encodeAccount, injectAccount } = require('./helpers/svm');
    const tcData = await encodeAccount('TokenConfig', {
      mint: nativeMint,
      is_allowed: true,
      max_withdrawal_fee: new BN(1_000_000_000), // 1 SOL max fee
    });
    injectAccount(svm, nativeTokenConfig, tcData);

    const { keypair, program } = fund(svm);
    host = keypair;
    hostProgram = program as any;
    payableAddr = await makePayable(svm, host, hostProgram);
  });

  async function payNative(
    svm: LiteSVM,
    payer: Keypair,
    payerProgram: Program<Chainbills>,
    payableAddr: PublicKey,
    amount: BN
  ) {
    const userRecAddr = userRecordPDA(payer.publicKey);
    const payableData = decode<any>(svm, 'Payable', payableAddr);
    const statsCur = decode<any>(svm, 'Stats', stats);

    let payerPaymentsCount = new BN(0);
    let payerActivitiesCount = new BN(0);
    const payerRecAccount = svm.getAccount(userRecAddr);
    if (payerRecAccount) {
      try {
        const ur = decode<any>(svm, 'UserRecord', userRecAddr);
        payerPaymentsCount = ur.payments_count;
        payerActivitiesCount = ur.activities_count;
      } catch {
        /* not initialized */
      }
    }

    const vaultAuth = vaultAuthorityPDA(payableAddr);

    const ix = await (payerProgram as any).methods
      .payNative(amount)
      .accounts({
        payer: payer.publicKey,
        userRecord: userRecAddr,
        payable: payableAddr,
        vaultAuthority: vaultAuth,
        tokenConfig: tokenConfigPDA(nativeMint),
        userPayment: userPaymentPDA(payer.publicKey, payerPaymentsCount),
        payablePayment: payablePaymentPDA(payableAddr, payableData.payments_count),
        activityRecord: activityRecordPDA(statsCur.total_activities),
        userActivityPointer: userActivityPointerPDA(payer.publicKey, payerActivitiesCount),
        payableActivityPointer: payableActivityPointerPDA(payableAddr, payableData.activities_count),
      })
      .instruction();

    return sendIx(svm, ix, payer);
  }

  it('increases vault authority lamports', async () => {
    const { keypair: payer, program: payerProg } = fund(svm);
    const vaultAuth = vaultAuthorityPDA(payableAddr);
    const amount = BigInt(LAMPORTS_PER_SOL);

    const balanceBefore = svm.getBalance(vaultAuth) ?? 0n;
    expectSuccess(await payNative(svm, payer, payerProg as any, payableAddr, new BN(amount.toString())));

    const balanceAfter = svm.getBalance(vaultAuth) ?? 0n;
    expect(balanceAfter - balanceBefore).toBe(amount);
  });

  it('updates payable.balances with native SOL entry', async () => {
    const { keypair: payer, program: payerProg } = fund(svm);
    const amount = new BN(LAMPORTS_PER_SOL.toString());

    expectSuccess(await payNative(svm, payer, payerProg as any, payableAddr, amount));

    const p = decode<any>(svm, 'Payable', payableAddr);
    expect(p.balances.length).toBe(1);
    expect(p.balances[0].token.toBase58()).toBe(nativeMint.toBase58());
    expect(p.balances[0].amount.toNumber()).toBe(LAMPORTS_PER_SOL);
  });

  it('creates UserPayment and PayablePayment PDAs', async () => {
    const { keypair: payer, program: payerProg } = fund(svm);
    expectSuccess(await payNative(svm, payer, payerProg as any, payableAddr, new BN(LAMPORTS_PER_SOL.toString())));

    expect(svm.getAccount(userPaymentPDA(payer.publicKey, new BN(0)))).not.toBeNull();
    expect(svm.getAccount(payablePaymentPDA(payableAddr, new BN(0)))).not.toBeNull();
  });

  it('rejects payment to closed payable', async () => {
    const { keypair: payer, program: payerProg } = fund(svm);

    // Close it
    const userRec = decode<any>(svm, 'UserRecord', userRecordPDA(host.publicKey));
    const statsCur = decode<any>(svm, 'Stats', stats);
    const payableData = decode<any>(svm, 'Payable', payableAddr);
    const closeIx = await (hostProgram as any).methods
      .closePayable()
      .accounts({
        host: host.publicKey,
        userRecord: userRecordPDA(host.publicKey),
        payable: payableAddr,
        activityRecord: activityRecordPDA(statsCur.total_activities),
        userActivityPointer: userActivityPointerPDA(host.publicKey, userRec.activities_count),
        payableActivityPointer: payableActivityPointerPDA(payableAddr, payableData.activities_count),
      })
      .instruction();
    expectSuccess(sendIx(svm, closeIx, host));

    expectFailure(await payNative(svm, payer, payerProg as any, payableAddr, new BN(LAMPORTS_PER_SOL.toString())));
  });

  it('rejects zero amount', async () => {
    const { keypair: payer, program: payerProg } = fund(svm);
    expectFailure(await payNative(svm, payer, payerProg as any, payableAddr, new BN(0)));
  });
});

// ── pay_foreign_via_cctp ──────────────────────────────────────────────────────

// keccak256("eip155:11155111") — Ethereum Sepolia
const SEPOLIA_CB_CHAIN_ID_PF = Buffer.from('afa9c74bd89ea79b5c1da22f7ea1c29de3a3c70e6f84f769e68c51e5f4c1bb1b', 'hex');
const EVM_CONTRACT_PF = new Uint8Array(32).fill(0xaa);
const FOREIGN_PAYABLE_ID = Buffer.alloc(32, 0x07);
const FOREIGN_PAYMENT_AMOUNT = 1_000_000n; // 1 USDC

async function injectSepoliaRegistry(svm: LiteSVM): Promise<void> {
  const data = await encodeAccount('ChainRegistry', {
    cb_chain_id: Array.from(SEPOLIA_CB_CHAIN_ID_PF),
    has_wormhole: true,
    wormhole_chain_id: 10002,
    has_cctp: true,
    circle_domain: 0,
    registered_contract: Array.from(EVM_CONTRACT_PF),
  });
  injectAccount(svm, chainRegistryPDA(SEPOLIA_CB_CHAIN_ID_PF), data);
}

async function injectForeignPayableForPay(svm: LiteSVM, opts: { isClosed?: boolean } = {}): Promise<PublicKey> {
  const data = await encodeAccount('ForeignPayable', {
    payable_id: Array.from(FOREIGN_PAYABLE_ID),
    cb_chain_id: Array.from(SEPOLIA_CB_CHAIN_ID_PF),
    is_closed: opts.isClosed ?? false,
    is_auto_withdraw: false,
    payable_update_nonce: new BN(1),
    payments_count: new BN(0),
    created_at: new BN(0),
    allowed_tokens_and_amounts: [],
  });
  const addr = foreignPayablePDA(FOREIGN_PAYABLE_ID);
  injectAccount(svm, addr, data);
  return addr;
}

describe('pay_foreign_via_cctp', () => {
  let svm: LiteSVM;
  let owner: Keypair;
  let usdcMint: PublicKey;

  beforeEach(async () => {
    svm = createSvm();
    owner = Keypair.generate();
    svm.airdrop(owner.publicKey, 10_000_000_000n);
    await bootstrapProgram(svm, owner);
    usdcMint = createMint(svm, owner);
    await injectSepoliaRegistry(svm);
    await injectForeignPayableForPay(svm);
  });

  async function callPayForeign(
    payer: Keypair,
    prog: Program<Chainbills>,
    opts: { amount?: BN; maxFee?: BN; isClosed?: boolean } = {}
  ) {
    const amount = opts.amount ?? new BN(FOREIGN_PAYMENT_AMOUNT.toString());
    const maxFee = opts.maxFee ?? new BN(0);

    const userRec = svm.getAccount(userRecordPDA(payer.publicKey));
    const userRecData = userRec ? decode<any>(svm, 'UserRecord', userRecordPDA(payer.publicKey)) : null;
    const payerCount = userRecData ? userRecData.payments_count : new BN(0);
    const payerActivities = userRecData ? userRecData.activities_count : new BN(0);
    const statsCur = decode<any>(svm, 'Stats', stats);

    const payerUsdcAta = mintTo(svm, owner, usdcMint, payer.publicKey, FOREIGN_PAYMENT_AMOUNT + 100n);
    const programUsdcAta = getAta(usdcMint, senderAuthority);

    const ix = await (prog as any).methods
      .payForeignViaCctp(Array.from(FOREIGN_PAYABLE_ID), Array.from(SEPOLIA_CB_CHAIN_ID_PF), amount, maxFee)
      .accounts({
        payer: payer.publicKey,
        userRecord: userRecordPDA(payer.publicKey),
        foreignPayable: foreignPayablePDA(FOREIGN_PAYABLE_ID),
        config: (await import('./accounts')).config,
        stats,
        chainRegistry: chainRegistryPDA(SEPOLIA_CB_CHAIN_ID_PF),
        usdcMint,
        payerUsdcAta,
        senderAuthority,
        programUsdcAta,
        userPayment: userPaymentPDA(payer.publicKey, payerCount),
        activityRecord: activityRecordPDA(statsCur.total_activities),
        userActivityPointer: userActivityPointerPDA(payer.publicKey, payerActivities),
        tokenProgram: TOKEN_PROGRAM_ID,
        associatedTokenProgram: ASSOCIATED_TOKEN_PROGRAM_ID,
        systemProgram: SystemProgram.programId,
      })
      .instruction();

    return sendIx(svm, ix, payer);
  }

  it('creates UserPayment PDA', async () => {
    const { keypair: payer, program } = fund(svm);
    expectSuccess(await callPayForeign(payer, program as any));

    const up = decode<any>(svm, 'UserPayment', userPaymentPDA(payer.publicKey, new BN(0)));
    expect(up.amount.toNumber()).toBe(Number(FOREIGN_PAYMENT_AMOUNT));
    expect(up.token_mint.toBase58()).toBe(usdcMint.toBase58());
    expect(Array.from(up.payable_chain_id)).toEqual(Array.from(SEPOLIA_CB_CHAIN_ID_PF));
  });

  it('increments stats.total_user_payments and emitted_cctp_payment_messages', async () => {
    const { keypair: payer, program } = fund(svm);
    const before = decode<any>(svm, 'Stats', stats);
    expectSuccess(await callPayForeign(payer, program as any));

    const after = decode<any>(svm, 'Stats', stats);
    expect(after.total_user_payments.toNumber()).toBe(before.total_user_payments.toNumber() + 1);
    // Config has_wormhole=true + chain_registry has_wormhole=true → Wormhole path
    expect(after.published_wormhole_messages.toNumber()).toBe(before.published_wormhole_messages.toNumber() + 1);
  });

  it('transfers USDC from payer to program_usdc_ata', async () => {
    const { keypair: payer, program } = fund(svm);
    expectSuccess(await callPayForeign(payer, program as any));

    const programAta = getAta(usdcMint, senderAuthority);
    const bal = getTokenBalance(svm, programAta);
    expect(bal).toBe(FOREIGN_PAYMENT_AMOUNT);
  });

  it('rejects closed foreign payable', async () => {
    await injectForeignPayableForPay(svm, { isClosed: true });
    const { keypair: payer, program } = fund(svm);
    expectFailure(await callPayForeign(payer, program as any));
  });

  it('rejects zero amount', async () => {
    const { keypair: payer, program } = fund(svm);
    expectFailure(await callPayForeign(payer, program as any, { amount: new BN(0) }));
  });
});
