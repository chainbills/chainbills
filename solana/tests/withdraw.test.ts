/**
 * Withdrawal instruction tests: withdraw (SPL token), withdraw_native (SOL).
 *
 * Each test creates a payable, makes a payment into it, then withdraws.
 * Fee formula: fee = min(amount * fee_bps / 10_000, max_withdrawal_fee).
 */

import type { Program } from '@coral-xyz/anchor';
import { BN } from '@coral-xyz/anchor';
import { Keypair, LAMPORTS_PER_SOL, PublicKey } from '@solana/web3.js';
import { LiteSVM } from 'litesvm';
import type { Chainbills } from '../target/types/chainbills';
import {
  activityRecordPDA,
  config,
  payableActivityPointerPDA,
  payablePaymentPDA,
  payablePDA,
  stats,
  tokenConfigPDA,
  userActivityPointerPDA,
  userPaymentPDA,
  userRecordPDA,
  vaultAuthorityPDA,
  withdrawalPDA,
} from './accounts';
import { bootstrapProgram } from './helpers/setup';
import { createSvm, decode, expectFailure, expectSuccess, fund, sendIx } from './helpers/svm';
import { createMint, getAta, getTokenBalance, mintTo, TOKEN_PROGRAM_ID } from './helpers/tokens';

// ── Test state setup ──────────────────────────────────────────────────────────

interface WithdrawEnv {
  svm: LiteSVM;
  owner: Keypair;
  mint: PublicKey;
  host: Keypair;
  hostProgram: Program<Chainbills>;
  payableAddr: PublicKey;
  /** Amount currently in the vault (from a payment already made). */
  paymentAmount: number;
}

/** Create payable, allow token, pay into it. Returns env ready for withdrawal. */
async function setupWithdrawEnv(
  paymentAmountUnits: number = 5_000_000,
  max_withdrawal_fee: number = 1_000_000
): Promise<WithdrawEnv> {
  const svm = createSvm();
  const owner = Keypair.generate();
  svm.airdrop(owner.publicKey, 10_000_000_000n);
  await bootstrapProgram(svm, owner);

  const mint = createMint(svm, owner);
  const ownerProg = require('./helpers/svm').createProgram(owner) as Program<Chainbills>;

  // allow token
  const tokenConfig = tokenConfigPDA(mint);
  const allowIx = await (ownerProg as any).methods
    .allowToken(new BN(max_withdrawal_fee))
    .accounts({
      owner: owner.publicKey,
      tokenMint: mint,
      tokenConfig,
      tokenProgram: TOKEN_PROGRAM_ID,
    })
    .instruction();
  expectSuccess(sendIx(svm, allowIx, owner));

  // create payable
  const { keypair: host, program: hostProgram } = fund(svm);
  const statsCur1 = decode<any>(svm, 'Stats', stats);
  const payable = payablePDA(host.publicKey, new BN(0));
  const createIx = await (hostProgram as any).methods
    .createPayable([], false)
    .accounts({
      host: host.publicKey,
      userRecord: userRecordPDA(host.publicKey),
      payable,
      vaultAuthority: vaultAuthorityPDA(payable),
      activityRecord: activityRecordPDA(statsCur1.total_activities),
      userActivityPointer: userActivityPointerPDA(host.publicKey, new BN(0)),
      payableActivityPointer: payableActivityPointerPDA(payable, new BN(0)),
    })
    .instruction();
  expectSuccess(sendIx(svm, createIx, host));

  // pay into payable
  const { keypair: payer } = fund(svm);
  const payerAta = mintTo(svm, owner, mint, payer.publicKey, BigInt(paymentAmountUnits * 2));
  const vaultAuth = vaultAuthorityPDA(payable);
  const vaultAta = getAta(mint, vaultAuth);
  const statsCur2 = decode<any>(svm, 'Stats', stats);
  const payableData = decode<any>(svm, 'Payable', payable);

  const payIx = await (require('./helpers/svm').createProgram(payer) as any).methods
    .pay(new BN(paymentAmountUnits))
    .accounts({
      payer: payer.publicKey,
      userRecord: userRecordPDA(payer.publicKey),
      payable,
      payerTokenAccount: payerAta,
      vaultAuthority: vaultAuth,
      vaultTokenAccount: vaultAta,
      tokenMint: mint,
      tokenConfig,
      userPayment: userPaymentPDA(payer.publicKey, new BN(0)),
      payablePayment: payablePaymentPDA(payable, payableData.payments_count),
      activityRecord: activityRecordPDA(statsCur2.total_activities),
      userActivityPointer: userActivityPointerPDA(payer.publicKey, new BN(0)),
      payableActivityPointer: payableActivityPointerPDA(payable, payableData.activities_count),
      tokenProgram: TOKEN_PROGRAM_ID,
    })
    .instruction();
  expectSuccess(sendIx(svm, payIx, payer));

  return {
    svm,
    owner,
    mint,
    host,
    hostProgram: hostProgram as any,
    payableAddr: payable,
    paymentAmount: paymentAmountUnits,
  };
}

/** Build and send a withdraw instruction. */
async function withdraw(
  svm: LiteSVM,
  host: Keypair,
  program: Program<Chainbills>,
  payableAddr: PublicKey,
  mint: PublicKey,
  owner: Keypair,
  amount: BN
) {
  const userRecAddr = userRecordPDA(host.publicKey);
  const userRec = svm.getAccount(userRecAddr)
    ? decode<any>(svm, 'UserRecord', userRecAddr)
    : { activities_count: new BN(0) };
  const payableData = decode<any>(svm, 'Payable', payableAddr);
  const statsCur = decode<any>(svm, 'Stats', stats);
  const cfg = decode<any>(svm, 'Config', config);

  const vaultAuth = vaultAuthorityPDA(payableAddr);
  const vaultAta = getAta(mint, vaultAuth);
  const hostAta = getAta(mint, host.publicKey);
  const feeCollectorAta = getAta(mint, cfg.fee_collector);

  const ix = await (program as any).methods
    .withdraw(amount)
    .accounts({
      host: host.publicKey,
      userRecord: userRecordPDA(host.publicKey),
      payable: payableAddr,
      vaultAuthority: vaultAuth,
      vaultTokenAccount: vaultAta,
      hostTokenAccount: hostAta,
      feeCollectorTokenAccount: feeCollectorAta,
      feeCollector: cfg.fee_collector,
      tokenMint: mint,
      tokenConfig: tokenConfigPDA(mint),
      withdrawal: withdrawalPDA(payableAddr, payableData.withdrawals_count),
      activityRecord: activityRecordPDA(statsCur.total_activities),
      userActivityPointer: userActivityPointerPDA(host.publicKey, userRec.activities_count),
      payableActivityPointer: payableActivityPointerPDA(payableAddr, payableData.activities_count),
      tokenProgram: TOKEN_PROGRAM_ID,
    })
    .instruction();

  return sendIx(svm, ix, host);
}

// ── withdraw (SPL) ────────────────────────────────────────────────────────────

describe('withdraw (SPL token)', () => {
  it('transfers net amount to host ATA', async () => {
    const { svm, owner, mint, host, hostProgram, payableAddr, paymentAmount } = await setupWithdrawEnv(
      5_000_000,
      1_000_000
    );

    const hostAta = getAta(mint, host.publicKey);
    const balanceBefore = getTokenBalance(svm, hostAta) ?? 0n;

    expectSuccess(await withdraw(svm, host, hostProgram, payableAddr, mint, owner, new BN(paymentAmount)));

    // fee = min(5_000_000 * 200 / 10_000, 1_000_000) = min(100_000, 1_000_000) = 100_000
    const expectedFee = 100_000n;
    const expectedNet = BigInt(paymentAmount) - expectedFee;

    const balanceAfter = getTokenBalance(svm, hostAta) ?? 0n;
    expect(balanceAfter - balanceBefore).toBe(expectedNet);
  });

  it('transfers fee to fee_collector ATA', async () => {
    const { svm, owner, mint, host, hostProgram, payableAddr, paymentAmount } = await setupWithdrawEnv(
      5_000_000,
      1_000_000
    );

    const cfg = decode<any>(svm, 'Config', config);
    const feeCollectorAta = getAta(mint, cfg.fee_collector);
    // Create fee collector ATA first (it may not exist)
    require('./helpers/tokens').createAta(svm, host, mint, cfg.fee_collector);
    const balanceBefore = getTokenBalance(svm, feeCollectorAta) ?? 0n;

    expectSuccess(await withdraw(svm, host, hostProgram, payableAddr, mint, owner, new BN(paymentAmount)));

    // fee = min(5_000_000 * 200 / 10_000, 1_000_000) = 100_000
    const balanceAfter = getTokenBalance(svm, feeCollectorAta) ?? 0n;
    expect(balanceAfter - balanceBefore).toBe(100_000n);
  });

  it('applies max_withdrawal_fee cap when 2% exceeds cap', async () => {
    // 2% of 50_000_000 = 1_000_000; max = 500_000 → fee capped at 500_000
    const { svm, owner, mint, host, hostProgram, payableAddr, paymentAmount } = await setupWithdrawEnv(
      50_000_000,
      500_000
    );

    const hostAta = getAta(mint, host.publicKey);
    const balanceBefore = getTokenBalance(svm, hostAta) ?? 0n;

    expectSuccess(await withdraw(svm, host, hostProgram, payableAddr, mint, owner, new BN(paymentAmount)));

    const expectedFee = 500_000n; // capped
    const expectedNet = BigInt(paymentAmount) - expectedFee;
    expect((getTokenBalance(svm, hostAta) ?? 0n) - balanceBefore).toBe(expectedNet);
  });

  it('creates Withdrawal PDA', async () => {
    const { svm, owner, mint, host, hostProgram, payableAddr, paymentAmount } = await setupWithdrawEnv();

    const payableData = decode<any>(svm, 'Payable', payableAddr);
    const wdlAddr = withdrawalPDA(payableAddr, payableData.withdrawals_count);

    expectSuccess(await withdraw(svm, host, hostProgram, payableAddr, mint, owner, new BN(paymentAmount)));

    expect(svm.getAccount(wdlAddr)).not.toBeNull();
    const wdl = decode<any>(svm, 'Withdrawal', wdlAddr);
    expect(wdl.host.toBase58()).toBe(host.publicKey.toBase58());
    expect(wdl.amount.toNumber()).toBe(paymentAmount);
  });

  it('increments stats.total_withdrawals', async () => {
    const { svm, owner, mint, host, hostProgram, payableAddr, paymentAmount } = await setupWithdrawEnv();

    const statsBefore = decode<any>(svm, 'Stats', stats);
    expectSuccess(await withdraw(svm, host, hostProgram, payableAddr, mint, owner, new BN(paymentAmount)));
    const statsAfter = decode<any>(svm, 'Stats', stats);
    expect(statsAfter.total_withdrawals.toNumber()).toBe(statsBefore.total_withdrawals.toNumber() + 1);
  });

  it('deducts balance from payable', async () => {
    const { svm, owner, mint, host, hostProgram, payableAddr, paymentAmount } = await setupWithdrawEnv(5_000_000);

    expectSuccess(await withdraw(svm, host, hostProgram, payableAddr, mint, owner, new BN(paymentAmount)));

    const p = decode<any>(svm, 'Payable', payableAddr);
    // After full withdrawal: balance should be 0
    expect(p.balances[0].amount.toNumber()).toBe(0);
  });

  it('rejects non-host caller', async () => {
    const { svm, owner, mint, host, hostProgram, payableAddr, paymentAmount } = await setupWithdrawEnv();

    const { keypair: nonHost, program: nonHostProg } = fund(svm);
    expectFailure(await withdraw(svm, nonHost, nonHostProg as any, payableAddr, mint, owner, new BN(paymentAmount)));
  });

  it('rejects withdrawal exceeding balance', async () => {
    const { svm, owner, mint, host, hostProgram, payableAddr, paymentAmount } = await setupWithdrawEnv(5_000_000);

    expectFailure(await withdraw(svm, host, hostProgram, payableAddr, mint, owner, new BN(paymentAmount + 1)));
  });
});

// ── withdraw_native (SOL) ─────────────────────────────────────────────────────

describe('withdraw_native (SOL)', () => {
  const nativeMint = new PublicKey('11111111111111111111111111111111');

  /** Set up a payable with SOL in it, ready to withdraw. */
  async function setupNativeWithdrawEnv(paymentLamports: number = LAMPORTS_PER_SOL) {
    const svm = createSvm();
    const owner = Keypair.generate();
    svm.airdrop(owner.publicKey, 10_000_000_000n);
    await bootstrapProgram(svm, owner);

    // Inject native SOL TokenConfig
    const { encodeAccount, injectAccount } = require('./helpers/svm');
    const nativeTokenConfig = tokenConfigPDA(nativeMint);
    const tcData = await encodeAccount('TokenConfig', {
      mint: nativeMint,
      is_allowed: true,
      max_withdrawal_fee: new BN(LAMPORTS_PER_SOL), // 1 SOL cap
    });
    injectAccount(svm, nativeTokenConfig, tcData);

    const { keypair: host, program: hostProgram } = fund(svm);
    const statsCur1 = decode<any>(svm, 'Stats', stats);
    const payable = payablePDA(host.publicKey, new BN(0));

    const createIx = await (hostProgram as any).methods
      .createPayable([], false)
      .accounts({
        host: host.publicKey,
        userRecord: userRecordPDA(host.publicKey),
        payable,
        vaultAuthority: vaultAuthorityPDA(payable),
        activityRecord: activityRecordPDA(statsCur1.total_activities),
        userActivityPointer: userActivityPointerPDA(host.publicKey, new BN(0)),
        payableActivityPointer: payableActivityPointerPDA(payable, new BN(0)),
      })
      .instruction();
    expectSuccess(sendIx(svm, createIx, host));

    // pay native SOL
    const { keypair: payer } = fund(svm);
    const statsCur2 = decode<any>(svm, 'Stats', stats);
    const payableData = decode<any>(svm, 'Payable', payable);

    const payIx = await (require('./helpers/svm').createProgram(payer) as any).methods
      .payNative(new BN(paymentLamports))
      .accounts({
        payer: payer.publicKey,
        userRecord: userRecordPDA(payer.publicKey),
        payable,
        vaultAuthority: vaultAuthorityPDA(payable),
        tokenConfig: nativeTokenConfig,
        userPayment: userPaymentPDA(payer.publicKey, new BN(0)),
        payablePayment: payablePaymentPDA(payable, payableData.payments_count),
        activityRecord: activityRecordPDA(statsCur2.total_activities),
        userActivityPointer: userActivityPointerPDA(payer.publicKey, new BN(0)),
        payableActivityPointer: payableActivityPointerPDA(payable, payableData.activities_count),
      })
      .instruction();
    expectSuccess(sendIx(svm, payIx, payer));

    return { svm, owner, host, hostProgram: hostProgram as any, payableAddr: payable, paymentLamports };
  }

  async function withdrawNative(
    svm: LiteSVM,
    host: Keypair,
    program: Program<Chainbills>,
    payableAddr: PublicKey,
    amount: BN,
    owner: Keypair
  ) {
    const userRecAddr = userRecordPDA(host.publicKey);
    const userRec = svm.getAccount(userRecAddr)
      ? decode<any>(svm, 'UserRecord', userRecAddr)
      : { activities_count: new BN(0) };
    const payableData = decode<any>(svm, 'Payable', payableAddr);
    const statsCur = decode<any>(svm, 'Stats', stats);
    const cfg = decode<any>(svm, 'Config', config);

    const ix = await (program as any).methods
      .withdrawNative(amount)
      .accounts({
        host: host.publicKey,
        userRecord: userRecordPDA(host.publicKey),
        payable: payableAddr,
        vaultAuthority: vaultAuthorityPDA(payableAddr),
        feeCollector: cfg.fee_collector,
        tokenConfig: tokenConfigPDA(nativeMint),
        withdrawal: withdrawalPDA(payableAddr, payableData.withdrawals_count),
        activityRecord: activityRecordPDA(statsCur.total_activities),
        userActivityPointer: userActivityPointerPDA(host.publicKey, userRec.activities_count),
        payableActivityPointer: payableActivityPointerPDA(payableAddr, payableData.activities_count),
      })
      .instruction();

    return sendIx(svm, ix, host);
  }

  it('increases host lamport balance (net of fee)', async () => {
    const { svm, owner, host, hostProgram, payableAddr, paymentLamports } =
      await setupNativeWithdrawEnv(LAMPORTS_PER_SOL);

    const hostBalBefore = svm.getBalance(host.publicKey) ?? 0n;
    expectSuccess(await withdrawNative(svm, host, hostProgram, payableAddr, new BN(paymentLamports), owner));

    // fee = min(1_SOL * 200 / 10_000, 1_SOL) = 0.02 SOL = 20_000_000 lamports
    const expectedFee = BigInt(Math.floor((paymentLamports * 200) / 10_000));
    const expectedNet = BigInt(paymentLamports) - expectedFee;
    const hostBalAfter = svm.getBalance(host.publicKey) ?? 0n;
    // Net increase should be ~expectedNet minus rent for Withdrawal+Activity PDAs (~5.5M) and tx fee.
    expect(hostBalAfter - hostBalBefore).toBeGreaterThanOrEqual(expectedNet - 10_000_000n);
  });

  it('sends fee to fee_collector', async () => {
    const { svm, owner, host, hostProgram, payableAddr, paymentLamports } =
      await setupNativeWithdrawEnv(LAMPORTS_PER_SOL);

    const cfg = decode<any>(svm, 'Config', config);
    const collectorBalBefore = svm.getBalance(cfg.fee_collector) ?? 0n;
    expectSuccess(await withdrawNative(svm, host, hostProgram, payableAddr, new BN(paymentLamports), owner));

    const expectedFee = BigInt(Math.floor((paymentLamports * 200) / 10_000));
    const collectorBalAfter = svm.getBalance(cfg.fee_collector) ?? 0n;
    expect(collectorBalAfter - collectorBalBefore).toBe(expectedFee);
  });

  it('creates Withdrawal PDA', async () => {
    const { svm, owner, host, hostProgram, payableAddr, paymentLamports } = await setupNativeWithdrawEnv();

    const payableData = decode<any>(svm, 'Payable', payableAddr);
    const wdlAddr = withdrawalPDA(payableAddr, payableData.withdrawals_count);

    expectSuccess(await withdrawNative(svm, host, hostProgram, payableAddr, new BN(paymentLamports), owner));
    expect(svm.getAccount(wdlAddr)).not.toBeNull();
  });

  it('rejects non-host caller', async () => {
    const { svm, owner, host, hostProgram, payableAddr, paymentLamports } = await setupNativeWithdrawEnv();

    const { keypair: nonHost, program: nonHostProg } = fund(svm);
    expectFailure(await withdrawNative(svm, nonHost, nonHostProg as any, payableAddr, new BN(paymentLamports), owner));
  });

  it('rejects withdrawal exceeding balance', async () => {
    const { svm, owner, host, hostProgram, payableAddr, paymentLamports } =
      await setupNativeWithdrawEnv(LAMPORTS_PER_SOL);

    expectFailure(await withdrawNative(svm, host, hostProgram, payableAddr, new BN(paymentLamports + 1), owner));
  });
});
