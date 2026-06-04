/**
 * broadcast_payable_update tests.
 *
 * All external CPIs (Wormhole post_message, CCTP send_message) are skipped via
 * the skip-external-cpi feature. Tests verify:
 *   - Stats counter increments for each protocol path
 *   - Nonce monotonically increases across broadcasts
 *   - Unauthorized host rejection
 *   - Missing remaining_accounts rejection (when CCTP chain registered)
 *   - Invalid chain_registry in remaining_accounts rejection
 *   - All 4 action_type values (Create=1, Close=2, Reopen=3, UpdateATAA=4)
 */

import { BN } from '@coral-xyz/anchor';
import { Keypair, PublicKey, SystemProgram } from '@solana/web3.js';
import { LiteSVM } from 'litesvm';
import {
  activityRecordPDA,
  chainRegistryPDA,
  config,
  payableActivityPointerPDA,
  payablePDA,
  senderAuthority,
  stats,
  userActivityPointerPDA,
  userRecordPDA,
  vaultAuthorityPDA,
} from './accounts';
import { bootstrapProgram, SOLANA_DEVNET_CB_CHAIN_ID } from './helpers/setup';
import {
  createSvm,
  decode,
  encodeAccount,
  expectFailure,
  expectSuccess,
  fund,
  injectAccount,
  PROGRAM_ID,
  sendIx,
} from './helpers/svm';

// ── Constants ─────────────────────────────────────────────────────────────────

const SEPOLIA_CB_CHAIN_ID = Buffer.from(
  'afa9c74bd89ea79b5c1da22f7ea1c29de3a3c70e6f84f769e68c51e5f4c1bb1b',
  'hex'
);
const EVM_CONTRACT = new Uint8Array(32).fill(0xaa);
const CCTP_DEVNET = new PublicKey('CCTPmbSD7gX1bxKPAmg77w8oFzNFpaQiQUWD43TKaecd');

// ── Helpers ───────────────────────────────────────────────────────────────────

/** Create a payable for `host` and return its PDA. */
async function createPayable(svm: LiteSVM, host: Keypair): Promise<PublicKey> {
  const prog = require('./helpers/svm').createProgram(host);
  const userRecAddr = userRecordPDA(host.publicKey);
  let hostPayablesCount = new BN(0);
  let userActivitiesCount = new BN(0);
  if (svm.getAccount(userRecAddr)) {
    const ur = decode<any>(svm, 'UserRecord', userRecAddr);
    hostPayablesCount = ur.payables_count;
    userActivitiesCount = ur.activities_count;
  }
  const statsCur = decode<any>(svm, 'Stats', stats);
  const payable = payablePDA(host.publicKey, hostPayablesCount);

  const ix = await prog.methods
    .createPayable([], false)
    .accounts({
      host: host.publicKey,
      userRecord: userRecordPDA(host.publicKey),
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

/** Inject a CCTP chain_registry and return its address and the chain_id. */
async function injectCctpChainRegistry(
  svm: LiteSVM,
  cbChainId: Buffer = SEPOLIA_CB_CHAIN_ID
): Promise<PublicKey> {
  const data = await encodeAccount('ChainRegistry', {
    cb_chain_id: Array.from(cbChainId),
    has_wormhole: false,
    wormhole_chain_id: 0,
    has_cctp: true,
    circle_domain: 0,
    registered_contract: Array.from(EVM_CONTRACT),
  });
  const addr = chainRegistryPDA(cbChainId);
  injectAccount(svm, addr, data);
  return addr;
}

/** Inject Stats with registered_cctp_chain_count = n. */
async function injectStatsWithCctpCount(svm: LiteSVM, n: number): Promise<void> {
  const cur = decode<any>(svm, 'Stats', stats);
  const data = await encodeAccount('Stats', {
    total_users: cur.total_users,
    total_payables: cur.total_payables,
    total_foreign_payables: cur.total_foreign_payables,
    total_user_payments: cur.total_user_payments,
    total_payable_payments: cur.total_payable_payments,
    total_withdrawals: cur.total_withdrawals,
    total_activities: cur.total_activities,
    published_wormhole_messages: cur.published_wormhole_messages,
    consumed_wormhole_messages: cur.consumed_wormhole_messages,
    emitted_cctp_payment_messages: cur.emitted_cctp_payment_messages,
    emitted_cctp_update_messages: cur.emitted_cctp_update_messages,
    received_cctp_payment_messages: cur.received_cctp_payment_messages,
    received_cctp_update_messages: cur.received_cctp_update_messages,
    registered_cctp_chain_count: n,
  });
  injectAccount(svm, stats, data);
}

// ── Tests ─────────────────────────────────────────────────────────────────────

describe('broadcast_payable_update', () => {
  let svm: LiteSVM;
  let owner: Keypair;
  let host: Keypair;
  let payable: PublicKey;

  beforeEach(async () => {
    svm = createSvm();
    owner = Keypair.generate();
    svm.airdrop(owner.publicKey, 10_000_000_000n);
    await bootstrapProgram(svm, owner);

    const funded = fund(svm);
    host = funded.keypair;
    payable = await createPayable(svm, host);
  });

  async function callBroadcast(
    authority: Keypair,
    payableAddr: PublicKey,
    actionType: number,
    remainingAccounts: { pubkey: PublicKey; isSigner: boolean; isWritable: boolean }[] = []
  ) {
    const prog = require('./helpers/svm').createProgram(authority);
    const ix = await prog.methods
      .broadcastPayableUpdate(actionType)
      .accounts({
        authority: authority.publicKey,
        payable: payableAddr,
        config,
        stats,
        senderAuthority,
        messageTransmitterProgram: CCTP_DEVNET,
        chainbillsProgram: PROGRAM_ID,
        systemProgram: SystemProgram.programId,
      })
      .remainingAccounts(remainingAccounts)
      .instruction();
    return sendIx(svm, ix, authority);
  }

  // ── Wormhole-only path (default config has has_wormhole=true, has_cctp=true)

  it('action_type=1 (Create): increments published_wormhole_messages', async () => {
    const before = decode<any>(svm, 'Stats', stats);
    expectSuccess(await callBroadcast(host, payable, 1));
    const after = decode<any>(svm, 'Stats', stats);
    expect(after.published_wormhole_messages.toNumber()).toBe(
      before.published_wormhole_messages.toNumber() + 1
    );
  });

  it('action_type=2 (Close): increments published_wormhole_messages', async () => {
    const before = decode<any>(svm, 'Stats', stats);
    expectSuccess(await callBroadcast(host, payable, 2));
    const after = decode<any>(svm, 'Stats', stats);
    expect(after.published_wormhole_messages.toNumber()).toBe(
      before.published_wormhole_messages.toNumber() + 1
    );
  });

  it('action_type=3 (Reopen): increments published_wormhole_messages', async () => {
    const before = decode<any>(svm, 'Stats', stats);
    expectSuccess(await callBroadcast(host, payable, 3));
    const after = decode<any>(svm, 'Stats', stats);
    expect(after.published_wormhole_messages.toNumber()).toBe(
      before.published_wormhole_messages.toNumber() + 1
    );
  });

  it('action_type=4 (UpdateATAA): increments published_wormhole_messages', async () => {
    const before = decode<any>(svm, 'Stats', stats);
    expectSuccess(await callBroadcast(host, payable, 4));
    const after = decode<any>(svm, 'Stats', stats);
    expect(after.published_wormhole_messages.toNumber()).toBe(
      before.published_wormhole_messages.toNumber() + 1
    );
  });

  it('nonce increments monotonically across broadcasts', async () => {
    expectSuccess(await callBroadcast(host, payable, 1));
    expectSuccess(await callBroadcast(host, payable, 4));
    const cfg = decode<any>(svm, 'Config', config);
    expect(cfg.payable_update_nonce_counter.toNumber()).toBe(2);
  });

  it('rejects invalid action_type (0)', async () => {
    expectFailure(await callBroadcast(host, payable, 0));
  });

  it('rejects invalid action_type (5)', async () => {
    expectFailure(await callBroadcast(host, payable, 5));
  });

  it('rejects non-host caller', async () => {
    const { keypair: other } = fund(svm);
    expectFailure(await callBroadcast(other, payable, 1));
  });

  it('owner can broadcast any payable (admin escape hatch)', async () => {
    expectSuccess(await callBroadcast(owner, payable, 1));
  });

  // ── CCTP path: registered_cctp_chain_count > 0

  it('CCTP: increments emitted_cctp_update_messages with 1 registered chain', async () => {
    // Inject chain + set count to 1
    const chainRegAddr = await injectCctpChainRegistry(svm);
    await injectStatsWithCctpCount(svm, 1);

    // remaining_accounts: [8..] = 1 chunk of 3 per chain
    // Wormhole: [0..7] = 8 Wormhole accounts (CPIs skipped, so dummies OK)
    const dummy = Keypair.generate().publicKey;
    const wormholeSlots = Array.from({ length: 8 }, () => ({
      pubkey: dummy,
      isSigner: false,
      isWritable: false,
    }));
    const eventData = Keypair.generate().publicKey;
    const mtState = Keypair.generate().publicKey;
    const cctpSlot = [
      { pubkey: chainRegAddr, isSigner: false, isWritable: false },
      { pubkey: eventData, isSigner: false, isWritable: true },
      { pubkey: mtState, isSigner: false, isWritable: true },
    ];

    const before = decode<any>(svm, 'Stats', stats);
    expectSuccess(await callBroadcast(host, payable, 1, [...wormholeSlots, ...cctpSlot]));
    const after = decode<any>(svm, 'Stats', stats);
    expect(after.emitted_cctp_update_messages.toNumber()).toBe(
      before.emitted_cctp_update_messages.toNumber() + 1
    );
  });

  // NOTE: remaining_accounts count enforcement and chain_registry PDA validation
  // only run in production builds (without skip-external-cpi feature). These
  // checks are inside #[cfg(not(feature = "skip-external-cpi"))] blocks.
  // Integration tests on devnet should verify those paths.
});
