// ──────────────────────────────────────────────────────────────────────────────
// Chainbills Relayer — Solana PDA Derivation Helpers
//
// Mirrors the seed constants in the Rust program. All PDAs are derived from
// the Chainbills program ID passed as a string argument.
// ──────────────────────────────────────────────────────────────────────────────

import { PublicKey } from '@solana/web3.js';
import { getPDA } from './client.js';

/** Config PDA. Seeds: [b"config"]. */
export const configPDA = (programId: string) => getPDA([Buffer.from('config')], programId);

/** Stats PDA. Seeds: [b"stats"]. */
export const statsPDA = (programId: string) => getPDA([Buffer.from('stats')], programId);

/** SenderAuthority PDA. Seeds: [b"sender_authority"]. */
export const senderAuthorityPDA = (programId: string) => getPDA([Buffer.from('sender_authority')], programId);

/** ChainRegistry PDA. Seeds: [b"chain_registry", cbChainId]. */
export const chainRegistryPDA = (cbChainId: Buffer, programId: string) =>
  getPDA([Buffer.from('chain_registry'), cbChainId], programId);

/** ForeignPayable PDA. Seeds: [b"foreign_payable", payableId]. */
export const foreignPayablePDA = (payableId: Buffer, programId: string) =>
  getPDA([Buffer.from('foreign_payable'), payableId], programId);

/** Vault authority PDA for a payable. Seeds: [b"vault", payable]. */
export const vaultAuthorityPDA = (payable: PublicKey, programId: string) =>
  getPDA([Buffer.from('vault'), payable.toBuffer()], programId);

/** ConsumedVaa PDA. Seeds: [b"consumed_vaa", vaaHash]. */
export const consumedVaaPDA = (vaaHash: Buffer, programId: string) =>
  getPDA([Buffer.from('consumed_vaa'), vaaHash], programId);

/** PaymentNonce PDA. Seeds: [b"payment_nonce", payerChainId, payer, nonce_le8]. */
export const paymentNoncePDA = (payerChainId: Buffer, payer: Buffer, nonce: bigint, programId: string) => {
  const nonceBuf = Buffer.alloc(8);
  nonceBuf.writeBigUInt64LE(nonce, 0);
  return getPDA([Buffer.from('payment_nonce'), payerChainId, payer, nonceBuf], programId);
};

/** CctpTokenBurnNonce PDA. Seeds: [b"cctp_token_burn_nonce", srcDomain_le4, nonce]. */
export const cctpTokenBurnNoncePDA = (srcDomain: number, nonce: Buffer, programId: string) => {
  const domainBuf = Buffer.alloc(4);
  domainBuf.writeUInt32LE(srcDomain, 0);
  return getPDA([Buffer.from('cctp_token_burn_nonce'), domainBuf, nonce], programId);
};

/** CctpDataNonce PDA. Seeds: [b"cctp_data_nonce", srcDomain_le4, nonce]. */
export const cctpDataNoncePDA = (srcDomain: number, nonce: Buffer, programId: string) => {
  const domainBuf = Buffer.alloc(4);
  domainBuf.writeUInt32LE(srcDomain, 0);
  return getPDA([Buffer.from('cctp_data_nonce'), domainBuf, nonce], programId);
};

/**
 * PayablePayment PDA. Seeds: [b"payable_payment", payable, paymentsCount_le8].
 * paymentsCount is the count BEFORE the new payment (zero-indexed).
 */
export const payablePaymentPDA = (payable: PublicKey, paymentsCount: bigint, programId: string) => {
  const countBuf = Buffer.alloc(8);
  countBuf.writeBigUInt64LE(paymentsCount, 0);
  return getPDA([Buffer.from('payable_payment'), payable.toBuffer(), countBuf], programId);
};

/**
 * ActivityRecord PDA (global sequential index).
 * Seeds: [b"activity", b"global", globalIndex_le8]
 */
export const activityRecordPDA = (globalIndex: bigint, programId: string) => {
  const idxBuf = Buffer.alloc(8);
  idxBuf.writeBigUInt64LE(globalIndex, 0);
  return getPDA([Buffer.from('activity'), Buffer.from('global'), idxBuf], programId);
};

/** PostedVAA PDA (owned by Wormhole Core Bridge). Seeds: [b"PostedVAA", vaaHash]. */
export const postedVaaPDA = (vaaHash: Buffer, wormholeProgramId: string) =>
  PublicKey.findProgramAddressSync([Buffer.from('PostedVAA'), vaaHash], new PublicKey(wormholeProgramId))[0];
