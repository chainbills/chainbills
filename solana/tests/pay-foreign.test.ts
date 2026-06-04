/**
 * pay_foreign_via_cctp tests — Solana → EVM cross-chain outbound payment.
 *
 * CCTP deposit_for_burn and Wormhole/CCTP payload CPIs are skipped in the
 * compiled .so (skip-external-cpi feature). These tests verify:
 *   - UserPayment PDA creation with correct fields
 *   - UserRecord initialization + payments_count increment
 *   - Stats counters (total_user_payments, published_wormhole_messages or
 *     emitted_cctp_payment_messages)
 *   - ATAA validation on ForeignPayable
 *   - Rejection of closed ForeignPayable
 *   - Rejection of zero amount
 */

import { BN } from '@coral-xyz/anchor';
import { Keypair, PublicKey, SystemProgram } from '@solana/web3.js';
import { LiteSVM } from 'litesvm';
import {
  activityRecordPDA,
  chainRegistryPDA,
  foreignPayablePDA,
  senderAuthority,
  stats,
  userActivityPointerPDA,
  userPaymentPDA,
  userRecordPDA,
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
  sendIx,
} from './helpers/svm';
import {
  ASSOCIATED_TOKEN_PROGRAM_ID,
  createMint,
  getAta,
  mintTo,
  TOKEN_PROGRAM_ID,
} from './helpers/tokens';

// ── Constants ─────────────────────────────────────────────────────────────────

// keccak256("eip155:11155111") — Ethereum Sepolia
const SEPOLIA_CB_CHAIN_ID = Buffer.from(
  'afa9c74bd89ea79b5c1da22f7ea1c29de3a3c70e6f84f769e68c51e5f4c1bb1b',
  'hex'
);
const SEPOLIA_CIRCLE_DOMAIN = 0;
const SEPOLIA_WORMHOLE_CHAIN_ID = 10002;
const EVM_CONTRACT = new Uint8Array(32).fill(0xaa);

const FOREIGN_PAYABLE_ID = Buffer.alloc(32, 0x07);
const AMOUNT = 5_000_000n; // 5 USDC
const MAX_FEE = 100_000n;

// ── Helpers ───────────────────────────────────────────────────────────────────

async function injectForeignPayable(
  svm: LiteSVM,
  payableId: Buffer,
  opts: {
    isClosed?: boolean;
    ataa?: Array<{ token: number[]; amount: BN }>;
  } = {}
): Promise<PublicKey> {
  const data = await encodeAccount('ForeignPayable', {
    payable_id: Array.from(payableId),
    cb_chain_id: Array.from(SEPOLIA_CB_CHAIN_ID),
    is_closed: opts.isClosed ?? false,
    is_auto_withdraw: false,
    payable_update_nonce: new BN(1),
    payments_count: new BN(0),
    created_at: new BN(0),
    allowed_tokens_and_amounts: opts.ataa ?? [],
  });
  const addr = foreignPayablePDA(payableId);
  injectAccount(svm, addr, data);
  return addr;
}

async function injectChainRegistry(
  svm: LiteSVM,
  opts: { hasCctp?: boolean; hasWormhole?: boolean } = {}
): Promise<PublicKey> {
  const data = await encodeAccount('ChainRegistry', {
    cb_chain_id: Array.from(SEPOLIA_CB_CHAIN_ID),
    has_wormhole: opts.hasWormhole ?? false,
    wormhole_chain_id: SEPOLIA_WORMHOLE_CHAIN_ID,
    has_cctp: opts.hasCctp ?? true,
    circle_domain: SEPOLIA_CIRCLE_DOMAIN,
    registered_contract: Array.from(EVM_CONTRACT),
  });
  const addr = chainRegistryPDA(SEPOLIA_CB_CHAIN_ID);
  injectAccount(svm, addr, data);
  return addr;
}

// ── Tests ─────────────────────────────────────────────────────────────────────

describe('pay_foreign_via_cctp', () => {
  let svm: LiteSVM;
  let owner: Keypair;
  let payer: Keypair;
  let usdcMint: PublicKey;
  let chainRegAddr: PublicKey;
  let fpAddr: PublicKey;

  beforeEach(async () => {
    svm = createSvm();
    owner = Keypair.generate();
    svm.airdrop(owner.publicKey, 10_000_000_000n);
    await bootstrapProgram(svm, owner);

    const funded = fund(svm);
    payer = funded.keypair;

    usdcMint = createMint(svm, owner);

    // Give payer a USDC ATA with 100 USDC
    mintTo(svm, owner, usdcMint, payer.publicKey, 100_000_000n);

    // CCTP-only chain registry (has_cctp=true, has_wormhole=false)
    chainRegAddr = await injectChainRegistry(svm, { hasCctp: true });

    // ForeignPayable with no ATAA (accepts any amount)
    fpAddr = await injectForeignPayable(svm, FOREIGN_PAYABLE_ID);
  });

  async function callPayForeign(opts: {
    amount?: bigint;
    maxFee?: bigint;
    fpId?: Buffer;
    destChainId?: Buffer;
  } = {}) {
    const amount = opts.amount ?? AMOUNT;
    const maxFee = opts.maxFee ?? MAX_FEE;
    const fpId = opts.fpId ?? FOREIGN_PAYABLE_ID;
    const destChainId = opts.destChainId ?? SEPOLIA_CB_CHAIN_ID;

    const userRec = userRecordPDA(payer.publicKey);
    const paymentCount = (() => {
      try { return decode<any>(svm, 'UserRecord', userRec).payments_count; }
      catch { return new BN(0); }
    })();
    const statsCur = decode<any>(svm, 'Stats', stats);
    const senderAuth = senderAuthority;
    const programUsdcAta = getAta(usdcMint, senderAuth);

    const prog = require('./helpers/svm').createProgram(payer);
    const ix = await prog.methods
      .payForeignViaCctp(
        Array.from(fpId),
        Array.from(destChainId),
        new BN(amount.toString()),
        new BN(maxFee.toString())
      )
      .accounts({
        payer: payer.publicKey,
        userRecord: userRec,
        foreignPayable: foreignPayablePDA(fpId),
        config: require('./accounts').config,
        stats,
        chainRegistry: chainRegAddr,
        usdcMint,
        payerUsdcAta: getAta(usdcMint, payer.publicKey),
        senderAuthority: senderAuth,
        programUsdcAta,
        userPayment: userPaymentPDA(payer.publicKey, paymentCount),
        activityRecord: activityRecordPDA(statsCur.total_activities),
        userActivityPointer: userActivityPointerPDA(
          payer.publicKey,
          (() => {
            try { return decode<any>(svm, 'UserRecord', userRec).activities_count; }
            catch { return new BN(0); }
          })()
        ),
        tokenProgram: TOKEN_PROGRAM_ID,
        associatedTokenProgram: ASSOCIATED_TOKEN_PROGRAM_ID,
        systemProgram: SystemProgram.programId,
      })
      .instruction();

    return sendIx(svm, ix, payer);
  }

  it('creates UserPayment with correct fields', async () => {
    expectSuccess(await callPayForeign());

    const userRec = decode<any>(svm, 'UserRecord', userRecordPDA(payer.publicKey));
    const up = decode<any>(svm, 'UserPayment', userPaymentPDA(payer.publicKey, new BN(0)));

    expect(up.payer.toBase58()).toBe(payer.publicKey.toBase58());
    expect(Array.from(up.payable_chain_id)).toEqual(Array.from(SEPOLIA_CB_CHAIN_ID));
    expect(Array.from(up.payer_chain_id)).toEqual(Array.from(SOLANA_DEVNET_CB_CHAIN_ID));
    expect(up.amount.toNumber()).toBe(Number(AMOUNT));
    expect(up.token_mint.toBase58()).toBe(usdcMint.toBase58());
    expect(userRec.payments_count.toNumber()).toBe(1);
  });

  it('initializes UserRecord on first payment', async () => {
    expect(svm.getAccount(userRecordPDA(payer.publicKey))).toBeNull();
    expectSuccess(await callPayForeign());
    const userRec = decode<any>(svm, 'UserRecord', userRecordPDA(payer.publicKey));
    expect(userRec.wallet.toBase58()).toBe(payer.publicKey.toBase58());
  });

  it('increments stats (CCTP-only path: emitted_cctp_payment_messages)', async () => {
    const before = decode<any>(svm, 'Stats', stats);
    expectSuccess(await callPayForeign());
    const after = decode<any>(svm, 'Stats', stats);
    expect(after.total_user_payments.toNumber()).toBe(
      before.total_user_payments.toNumber() + 1
    );
    // CCTP-only path (has_wormhole=false in chain_registry)
    expect(after.emitted_cctp_payment_messages.toNumber()).toBe(
      before.emitted_cctp_payment_messages.toNumber() + 1
    );
    expect(after.published_wormhole_messages.toNumber()).toBe(
      before.published_wormhole_messages.toNumber()
    );
  });

  it('increments stats (Wormhole path: published_wormhole_messages)', async () => {
    // Re-inject chain_registry with has_wormhole=true
    chainRegAddr = await injectChainRegistry(svm, { hasCctp: true, hasWormhole: true });

    const before = decode<any>(svm, 'Stats', stats);
    expectSuccess(await callPayForeign());
    const after = decode<any>(svm, 'Stats', stats);
    expect(after.published_wormhole_messages.toNumber()).toBe(
      before.published_wormhole_messages.toNumber() + 1
    );
    expect(after.emitted_cctp_payment_messages.toNumber()).toBe(
      before.emitted_cctp_payment_messages.toNumber()
    );
  });

  it('rejects zero amount', async () => {
    expectFailure(await callPayForeign({ amount: 0n }));
  });

  it('rejects closed ForeignPayable', async () => {
    await injectForeignPayable(svm, FOREIGN_PAYABLE_ID, { isClosed: true });
    expectFailure(await callPayForeign());
  });

  it('rejects when token+amount not in ATAA', async () => {
    // ForeignPayable with ATAA requiring a DIFFERENT token (fill 0x55)
    const wrongToken = Array.from(new Uint8Array(32).fill(0x55));
    await injectForeignPayable(svm, FOREIGN_PAYABLE_ID, {
      ataa: [{ token: wrongToken, amount: new BN(Number(AMOUNT)) }],
    });
    // payer pays with usdcMint (normalized key != 0x55...55)
    expectFailure(await callPayForeign());
  });

  it('supports second payment from same payer (payment_count increments)', async () => {
    expectSuccess(await callPayForeign());
    // payer has 100 USDC initial; first payment used ~5.1 USDC; second uses ~6 USDC
    expectSuccess(await callPayForeign({ amount: AMOUNT + 1_000_000n }));
    const userRec = decode<any>(svm, 'UserRecord', userRecordPDA(payer.publicKey));
    expect(userRec.payments_count.toNumber()).toBe(2);
  });
});
