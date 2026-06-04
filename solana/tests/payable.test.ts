/**
 * Payable instruction tests:
 * create_payable, close_payable, reopen_payable,
 * update_payable_ataa, update_payable_auto_withdraw.
 */

import type { Program } from '@coral-xyz/anchor';
import { BN } from '@coral-xyz/anchor';
import { Keypair, PublicKey } from '@solana/web3.js';
import { LiteSVM } from 'litesvm';
import type { Chainbills } from '../target/types/chainbills';
import {
  activityRecordPDA,
  payableActivityPointerPDA,
  payablePDA,
  stats,
  userActivityPointerPDA,
  userRecordPDA,
  vaultAuthorityPDA,
} from './accounts';
import { bootstrapProgram } from './helpers/setup';
import { createSvm, decode, expectFailure, expectSuccess, fund, sendIx } from './helpers/svm';
import { createMint } from './helpers/tokens';

// ── Helpers ───────────────────────────────────────────────────────────────────

/** Derive all PDAs needed for create_payable and return them. */
function payableAccounts(host: PublicKey, hostPayablesCount: BN, totalActivities: BN) {
  const userRec = userRecordPDA(host);
  const payable = payablePDA(host, hostPayablesCount);
  const vaultAuth = vaultAuthorityPDA(payable);
  const actRec = activityRecordPDA(totalActivities);
  const userAct = userActivityPointerPDA(host, new BN(0)); // first activity for user
  const payableAct = payableActivityPointerPDA(payable, new BN(0));
  return { userRec, payable, vaultAuth, actRec, userAct, payableAct };
}

/** Call create_payable and return the payable PDA. */
async function createPayable(
  svm: LiteSVM,
  host: Keypair,
  program: Program<Chainbills>,
  ataa: { token: PublicKey; amount: BN }[] = [],
  isAutoWithdraw: boolean = false
): Promise<PublicKey> {
  // Read current counts from decoded UserRecord (safe, no raw byte math)
  const userRecAddr = userRecordPDA(host.publicKey);
  let hostPayablesCount = new BN(0);
  let userActivitiesCount = new BN(0);
  if (svm.getAccount(userRecAddr)) {
    const ur = decode<any>(svm, 'UserRecord', userRecAddr);
    hostPayablesCount = ur.payables_count;
    userActivitiesCount = ur.activities_count;
  }

  const statsData = decode<any>(svm, 'Stats', stats);
  const totalActivities = statsData.total_activities;

  const pdas = payableAccounts(host.publicKey, hostPayablesCount, totalActivities);
  const userActPointer = userActivityPointerPDA(host.publicKey, userActivitiesCount);

  const ix = await (program as any).methods
    .createPayable(ataa, isAutoWithdraw)
    .accounts({
      host: host.publicKey,
      userRecord: pdas.userRec,
      payable: pdas.payable,
      vaultAuthority: pdas.vaultAuth,
      activityRecord: pdas.actRec,
      userActivityPointer: userActPointer,
      payableActivityPointer: pdas.payableAct,
    })
    .instruction();

  expectSuccess(sendIx(svm, ix, host));
  return pdas.payable;
}

// ── create_payable ────────────────────────────────────────────────────────────

describe('create_payable', () => {
  let svm: LiteSVM;
  let owner: Keypair;

  beforeEach(async () => {
    svm = createSvm();
    owner = Keypair.generate();
    svm.airdrop(owner.publicKey, 10_000_000_000n);
    await bootstrapProgram(svm, owner);
  });

  it('creates payable with no ATAA (accepts any token/amount)', async () => {
    const { keypair: host, program } = fund(svm);
    const payable = await createPayable(svm, host, program as any);

    const p = decode<any>(svm, 'Payable', payable);
    expect(p.host.toBase58()).toBe(host.publicKey.toBase58());
    expect(p.is_closed).toBe(false);
    expect(p.is_auto_withdraw).toBe(false);
    expect(p.allowed_tokens_and_amounts.length).toBe(0);
    expect(p.balances.length).toBe(0);
    expect(p.payments_count.toNumber()).toBe(0);
    expect(p.withdrawals_count.toNumber()).toBe(0);
  });

  it('increments stats.total_payables', async () => {
    const { keypair: host, program } = fund(svm);
    const statsBefore = decode<any>(svm, 'Stats', stats);
    const countBefore = statsBefore.total_payables.toNumber();

    await createPayable(svm, host, program as any);

    const statsAfter = decode<any>(svm, 'Stats', stats);
    expect(statsAfter.total_payables.toNumber()).toBe(countBefore + 1);
  });

  it('increments stats.total_activities', async () => {
    const { keypair: host, program } = fund(svm);
    const statsBefore = decode<any>(svm, 'Stats', stats);
    const actBefore = statsBefore.total_activities.toNumber();

    await createPayable(svm, host, program as any);

    const statsAfter = decode<any>(svm, 'Stats', stats);
    expect(statsAfter.total_activities.toNumber()).toBe(actBefore + 1);
  });

  it('creates UserRecord for new host (increments totalUsers)', async () => {
    const { keypair: host, program } = fund(svm);
    const statsBefore = decode<any>(svm, 'Stats', stats);
    const usersBefore = statsBefore.total_users.toNumber();

    await createPayable(svm, host, program as any);

    const statsAfter = decode<any>(svm, 'Stats', stats);
    expect(statsAfter.total_users.toNumber()).toBe(usersBefore + 1);

    const userRec = decode<any>(svm, 'UserRecord', userRecordPDA(host.publicKey));
    expect(userRec.wallet.toBase58()).toBe(host.publicKey.toBase58());
    expect(userRec.payables_count.toNumber()).toBe(1);
  });

  it('does NOT re-increment totalUsers for same host second payable', async () => {
    const { keypair: host, program } = fund(svm);
    await createPayable(svm, host, program as any);

    const statsBefore = decode<any>(svm, 'Stats', stats);
    const usersBefore = statsBefore.total_users.toNumber();

    await createPayable(svm, host, program as any);

    const statsAfter = decode<any>(svm, 'Stats', stats);
    expect(statsAfter.total_users.toNumber()).toBe(usersBefore); // unchanged
  });

  it('second payable for same host has host_count=1', async () => {
    const { keypair: host, program } = fund(svm);
    await createPayable(svm, host, program as any); // hostCount=0
    const payable2 = await createPayable(svm, host, program as any); // hostCount=1

    const p = decode<any>(svm, 'Payable', payable2);
    expect(p.host_count.toNumber()).toBe(1);
  });

  it('creates payable with auto_withdraw=true', async () => {
    const { keypair: host, program } = fund(svm);
    const payable = await createPayable(svm, host, program as any, [], true);

    const p = decode<any>(svm, 'Payable', payable);
    expect(p.is_auto_withdraw).toBe(true);
  });

  it('creates ActivityRecord and PayableActivityPointer', async () => {
    const { keypair: host, program } = fund(svm);
    const statsBefore = decode<any>(svm, 'Stats', stats);
    const totalAct = statsBefore.total_activities;

    await createPayable(svm, host, program as any);

    const actRec = activityRecordPDA(totalAct);
    expect(svm.getAccount(actRec)).not.toBeNull();
  });

  it('rejects duplicate token in ATAA', async () => {
    const { keypair: host, program } = fund(svm);
    const mint = createMint(svm, owner);

    const duplicateAtaa = [
      { token: mint, amount: new BN(1_000_000) },
      { token: mint, amount: new BN(2_000_000) }, // same token — duplicate
    ];

    const userRec = userRecordPDA(host.publicKey);
    const payable = payablePDA(host.publicKey, new BN(0));
    const vaultAuth = vaultAuthorityPDA(payable);
    const statsCurrent = decode<any>(svm, 'Stats', stats);

    const ix = await (program as any).methods
      .createPayable(duplicateAtaa, false)
      .accounts({
        host: host.publicKey,
        userRecord: userRec,
        payable,
        vaultAuthority: vaultAuth,
        activityRecord: activityRecordPDA(statsCurrent.total_activities),
        userActivityPointer: userActivityPointerPDA(host.publicKey, new BN(0)),
        payableActivityPointer: payableActivityPointerPDA(payable, new BN(0)),
      })
      .instruction();

    expectFailure(sendIx(svm, ix, host));
  });
});

// ── close_payable ─────────────────────────────────────────────────────────────

describe('close_payable', () => {
  let svm: LiteSVM;
  let owner: Keypair;
  let host: Keypair;
  let hostProgram: Program<Chainbills>;
  let payableAddr: PublicKey;

  beforeEach(async () => {
    svm = createSvm();
    owner = Keypair.generate();
    svm.airdrop(owner.publicKey, 10_000_000_000n);
    await bootstrapProgram(svm, owner);
    const { keypair, program } = fund(svm);
    host = keypair;
    hostProgram = program as any;
    payableAddr = await createPayable(svm, host, hostProgram);
  });

  async function closePayable(svm: LiteSVM, host: Keypair, program: Program<Chainbills>, payable: PublicKey) {
    const statsCur = decode<any>(svm, 'Stats', stats);
    const payableData = svm.getAccount(payable)
      ? decode<any>(svm, 'Payable', payable)
      : { activities_count: new BN(0) };
    const userRecAddr = userRecordPDA(host.publicKey);
    const userActivitiesCount = svm.getAccount(userRecAddr)
      ? decode<any>(svm, 'UserRecord', userRecAddr).activities_count
      : new BN(0);

    const ix = await (program as any).methods
      .closePayable()
      .accounts({
        host: host.publicKey,
        userRecord: userRecAddr,
        payable,
        activityRecord: activityRecordPDA(statsCur.total_activities),
        userActivityPointer: userActivityPointerPDA(host.publicKey, userActivitiesCount),
        payableActivityPointer: payableActivityPointerPDA(payable, payableData.activities_count),
      })
      .instruction();
    return sendIx(svm, ix, host);
  }

  it('sets is_closed=true', async () => {
    expectSuccess(await closePayable(svm, host, hostProgram, payableAddr));
    const p = decode<any>(svm, 'Payable', payableAddr);
    expect(p.is_closed).toBe(true);
  });

  it('rejects non-host caller', async () => {
    const { keypair: nonHost, program: nonHostProg } = fund(svm);
    const result = await closePayable(svm, nonHost, nonHostProg as any, payableAddr);
    expectFailure(result);
  });

  it('rejects closing already-closed payable', async () => {
    await closePayable(svm, host, hostProgram, payableAddr);
    const result = await closePayable(svm, host, hostProgram, payableAddr);
    expectFailure(result);
  });
});

// ── reopen_payable ────────────────────────────────────────────────────────────

describe('reopen_payable', () => {
  let svm: LiteSVM;
  let owner: Keypair;
  let host: Keypair;
  let hostProgram: Program<Chainbills>;
  let payableAddr: PublicKey;

  beforeEach(async () => {
    svm = createSvm();
    owner = Keypair.generate();
    svm.airdrop(owner.publicKey, 10_000_000_000n);
    await bootstrapProgram(svm, owner);
    const { keypair, program } = fund(svm);
    host = keypair;
    hostProgram = program as any;
    payableAddr = await createPayable(svm, host, hostProgram);

    // Close it first so we can test reopen
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
  });

  async function reopenPayable(svm: LiteSVM, host: Keypair, program: Program<Chainbills>, payable: PublicKey) {
    const statsCur = decode<any>(svm, 'Stats', stats);
    const payableData = svm.getAccount(payable)
      ? decode<any>(svm, 'Payable', payable)
      : { activities_count: new BN(0) };
    const userRecAddr = userRecordPDA(host.publicKey);
    const userActivitiesCount = svm.getAccount(userRecAddr)
      ? decode<any>(svm, 'UserRecord', userRecAddr).activities_count
      : new BN(0);

    const ix = await (program as any).methods
      .reopenPayable()
      .accounts({
        host: host.publicKey,
        userRecord: userRecAddr,
        payable,
        activityRecord: activityRecordPDA(statsCur.total_activities),
        userActivityPointer: userActivityPointerPDA(host.publicKey, userActivitiesCount),
        payableActivityPointer: payableActivityPointerPDA(payable, payableData.activities_count),
      })
      .instruction();
    return sendIx(svm, ix, host);
  }

  it('clears is_closed flag', async () => {
    expectSuccess(await reopenPayable(svm, host, hostProgram, payableAddr));
    const p = decode<any>(svm, 'Payable', payableAddr);
    expect(p.is_closed).toBe(false);
  });

  it('rejects non-host caller', async () => {
    const { keypair: nonHost, program: nonHostProg } = fund(svm);
    expectFailure(await reopenPayable(svm, nonHost, nonHostProg as any, payableAddr));
  });

  it('rejects reopening an open payable', async () => {
    await reopenPayable(svm, host, hostProgram, payableAddr); // open it
    // Try to reopen again — should fail (PayableNotClosed)
    expectFailure(await reopenPayable(svm, host, hostProgram, payableAddr));
  });
});

// ── update_payable_auto_withdraw ──────────────────────────────────────────────

describe('update_payable_auto_withdraw', () => {
  let svm: LiteSVM;
  let owner: Keypair;
  let host: Keypair;
  let hostProgram: Program<Chainbills>;
  let payableAddr: PublicKey;

  beforeEach(async () => {
    svm = createSvm();
    owner = Keypair.generate();
    svm.airdrop(owner.publicKey, 10_000_000_000n);
    await bootstrapProgram(svm, owner);
    const { keypair, program } = fund(svm);
    host = keypair;
    hostProgram = program as any;
    payableAddr = await createPayable(svm, host, hostProgram);
  });

  async function updateAutoWithdraw(isAutoWithdraw: boolean) {
    const userRec = decode<any>(svm, 'UserRecord', userRecordPDA(host.publicKey));
    const statsCur = decode<any>(svm, 'Stats', stats);
    const payableData = decode<any>(svm, 'Payable', payableAddr);

    const ix = await (hostProgram as any).methods
      .updatePayableAutoWithdraw(isAutoWithdraw)
      .accounts({
        host: host.publicKey,
        userRecord: userRecordPDA(host.publicKey),
        payable: payableAddr,
        activityRecord: activityRecordPDA(statsCur.total_activities),
        userActivityPointer: userActivityPointerPDA(host.publicKey, userRec.activities_count),
        payableActivityPointer: payableActivityPointerPDA(payableAddr, payableData.activities_count),
      })
      .instruction();
    return sendIx(svm, ix, host);
  }

  it('sets is_auto_withdraw=true', async () => {
    expectSuccess(await updateAutoWithdraw(true));
    expect(decode<any>(svm, 'Payable', payableAddr).is_auto_withdraw).toBe(true);
  });

  it('sets is_auto_withdraw=false', async () => {
    await updateAutoWithdraw(true);
    expectSuccess(await updateAutoWithdraw(false));
    expect(decode<any>(svm, 'Payable', payableAddr).is_auto_withdraw).toBe(false);
  });

  it('rejects non-host caller', async () => {
    const { keypair: nonHost, program: nonHostProg } = fund(svm);
    const userRec = decode<any>(svm, 'UserRecord', userRecordPDA(host.publicKey));
    const statsCur = decode<any>(svm, 'Stats', stats);
    const payableData = decode<any>(svm, 'Payable', payableAddr);

    const ix = await (nonHostProg as any).methods
      .updatePayableAutoWithdraw(true)
      .accounts({
        host: nonHost.publicKey, // wrong host
        userRecord: userRecordPDA(nonHost.publicKey),
        payable: payableAddr,
        activityRecord: activityRecordPDA(statsCur.total_activities),
        userActivityPointer: userActivityPointerPDA(nonHost.publicKey, new BN(0)),
        payableActivityPointer: payableActivityPointerPDA(payableAddr, payableData.activities_count),
      })
      .instruction();
    expectFailure(sendIx(svm, ix, nonHost));
  });
});
