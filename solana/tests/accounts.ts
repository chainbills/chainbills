import { BN, web3 } from '@coral-xyz/anchor';
import { Keypair, PublicKey } from '@solana/web3.js';

/** Chainbills program ID (from declare_id! in lib.rs). */
export const PROGRAM_ID = new PublicKey('DWhfdyzTiD2Jpkh3FhS2PreTSraqh3jWGfiTAoFG5wNk');

export const systemProgram = new PublicKey(web3.SystemProgram.programId);
export const chainbillsFeeCollector = Keypair.generate();
export const user1 = Keypair.generate();

/** Derive a program PDA from the given seeds. */
export const getPDA = (seeds: (Uint8Array | Buffer)[]): PublicKey =>
  PublicKey.findProgramAddressSync(seeds, PROGRAM_ID)[0];

// ── Core config PDAs ──────────────────────────────────────────────────────────

/** Admin config PDA. Seeds: [b"config"]. */
export const config = getPDA([Buffer.from('config')]);

/** Chain statistics PDA. Seeds: [b"stats"]. */
export const stats = getPDA([Buffer.from('stats')]);

/** Sender authority PDA — signs CCTP deposit_for_burn. Seeds: [b"sender_authority"]. */
export const senderAuthority = getPDA([Buffer.from('sender_authority')]);

// ── Per-entity PDA helpers ────────────────────────────────────────────────────

/** Derive a UserRecord PDA for the given wallet. Seeds: [b"user", wallet]. */
export const userRecordPDA = (wallet: PublicKey): PublicKey => getPDA([Buffer.from('user'), wallet.toBuffer()]);

/**
 * Derive a Payable PDA.
 * Seeds: [b"payable", host, hostCount_le8]
 */
export const payablePDA = (host: PublicKey, hostCount: BN): PublicKey =>
  getPDA([Buffer.from('payable'), host.toBuffer(), hostCount.toArrayLike(Buffer, 'le', 8)]);

/** Derive the vault authority PDA for a payable. Seeds: [b"vault", payable]. */
export const vaultAuthorityPDA = (payable: PublicKey): PublicKey => getPDA([Buffer.from('vault'), payable.toBuffer()]);

/** Derive a TokenConfig PDA for a mint. Seeds: [b"token_config", mint]. */
export const tokenConfigPDA = (mint: PublicKey): PublicKey => getPDA([Buffer.from('token_config'), mint.toBuffer()]);

/** Derive a ChainRegistry PDA for a cbChainId. Seeds: [b"chain_registry", cbChainId]. */
export const chainRegistryPDA = (cbChainId: Buffer): PublicKey => getPDA([Buffer.from('chain_registry'), cbChainId]);

/** Derive a ForeignPayable PDA. Seeds: [b"foreign_payable", payableId]. */
export const foreignPayablePDA = (payableId: Buffer): PublicKey => getPDA([Buffer.from('foreign_payable'), payableId]);

/**
 * Derive a UserPayment PDA.
 * Seeds: [b"user_payment", payer, paymentCount_le8]
 */
export const userPaymentPDA = (payer: PublicKey, paymentCount: BN): PublicKey =>
  getPDA([Buffer.from('user_payment'), payer.toBuffer(), paymentCount.toArrayLike(Buffer, 'le', 8)]);

/**
 * Derive a PayablePayment PDA.
 * Seeds: [b"payable_payment", payable, paymentCount_le8]
 */
export const payablePaymentPDA = (payable: PublicKey, paymentCount: BN): PublicKey =>
  getPDA([Buffer.from('payable_payment'), payable.toBuffer(), paymentCount.toArrayLike(Buffer, 'le', 8)]);

/**
 * Derive a Withdrawal PDA.
 * Seeds: [b"withdrawal", payable, withdrawalCount_le8]
 */
export const withdrawalPDA = (payable: PublicKey, withdrawalCount: BN): PublicKey =>
  getPDA([Buffer.from('withdrawal'), payable.toBuffer(), withdrawalCount.toArrayLike(Buffer, 'le', 8)]);

/**
 * Derive a global ActivityRecord PDA.
 * Seeds: [b"activity", b"global", globalIndex_le8]
 */
export const activityRecordPDA = (globalIndex: BN): PublicKey =>
  getPDA([Buffer.from('activity'), Buffer.from('global'), globalIndex.toArrayLike(Buffer, 'le', 8)]);

/**
 * Derive a UserActivityPointer PDA.
 * Seeds: [b"activity", b"user", user, userIndex_le8]
 */
export const userActivityPointerPDA = (user: PublicKey, userIndex: BN): PublicKey =>
  getPDA([Buffer.from('activity'), Buffer.from('user'), user.toBuffer(), userIndex.toArrayLike(Buffer, 'le', 8)]);

/**
 * Derive a PayableActivityPointer PDA.
 * Seeds: [b"activity", b"payable", payable, payableIndex_le8]
 */
export const payableActivityPointerPDA = (payable: PublicKey, payableIndex: BN): PublicKey =>
  getPDA([
    Buffer.from('activity'),
    Buffer.from('payable'),
    payable.toBuffer(),
    payableIndex.toArrayLike(Buffer, 'le', 8),
  ]);

/** Derive a ConsumedVaa PDA. Seeds: [b"consumed_vaa", vaaHash]. */
export const consumedVaaPDA = (vaaHash: Buffer): PublicKey => getPDA([Buffer.from('consumed_vaa'), vaaHash]);

/**
 * Derive a PaymentNonce PDA.
 * Seeds: [b"payment_nonce", payerChainId, payer, nonce_le8]
 */
export const paymentNoncePDA = (payerChainId: Buffer, payer: Buffer, nonce: BN): PublicKey =>
  getPDA([
    Buffer.from('payment_nonce'),
    payerChainId,
    payer,
    nonce.toArrayLike(Buffer, 'le', 8),
  ]);

/**
 * Derive a CctpTokenBurnNonce PDA.
 * Seeds: [b"cctp_token_burn_nonce", srcDomain_le4, nonce]
 */
export const cctpTokenBurnNoncePDA = (srcDomain: number, nonce: Buffer): PublicKey => {
  const domainBuf = Buffer.alloc(4);
  domainBuf.writeUInt32LE(srcDomain, 0);
  return getPDA([Buffer.from('cctp_token_burn_nonce'), domainBuf, nonce]);
};
