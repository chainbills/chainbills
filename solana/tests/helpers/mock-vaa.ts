/**
 * Mock VAA and CCTP message builders for LiteSVM injection.
 *
 * PostedVAA byte layout (wormhole.rs):
 *   [0..8]   discriminator "vaa\x01\0\0\0\0"
 *   [8]      consistency_level u8
 *   [9..13]  timestamp u32 LE
 *   [13..45] signature_set Pubkey (32 bytes)
 *   [45..49] guardian_set_index u32 LE
 *   [49..53] nonce u32 LE
 *   [53..61] sequence u64 LE
 *   [61..63] emitter_chain u16 LE
 *   [63..95] emitter_address [u8;32]
 *   [95..99] payload_len u32 LE
 *   [99+]    payload bytes
 *
 * CCTP V2 message offsets (recv_payable_update_via_cctp.rs):
 *   [4..8]   src_domain u32 BE (big-endian per EVM abi.encodePacked)
 *   [12..44] cctp_nonce [u8;32]
 *   [44..76] sender [u8;32]
 *   [148+]   payload body
 */

import { PublicKey } from '@solana/web3.js';
import { LiteSVM } from 'litesvm';
import { PROGRAM_ID } from './svm';

export const WORMHOLE_DEVNET = new PublicKey('3u8hJUVTA4jH1wYAyUur7FFZVQ8H635K3tSHHF4ssjQ5');
export const CCTP_DEVNET = new PublicKey('CCTPmbSD7gX1bxKPAmg77w8oFzNFpaQiQUWD43TKaecd');

// ── PayablePayload encoder ────────────────────────────────────────────────────

export const ACTION_CREATE = 1;
export const ACTION_CLOSE = 2;
export const ACTION_REOPEN = 3;
export const ACTION_UPDATE_ATAA = 4;

export interface PayablePayloadParams {
  actionType: number;
  payableId: Uint8Array;
  nonce: bigint;
  initiatedAt?: bigint;
  ataa?: Array<{ token: Uint8Array; amount: bigint }>;
  isClosed?: boolean;
}

export function encodePayablePayload(p: PayablePayloadParams): Buffer {
  const header = Buffer.alloc(51, 0);
  header[0] = 0x01; // PAYLOAD_TYPE_PAYABLE
  header[1] = 0x01; // PAYLOAD_VERSION
  header[2] = p.actionType;
  header.set(p.payableId.slice(0, 32), 3);
  header.writeBigUInt64BE(p.nonce, 35);
  header.writeBigInt64BE(p.initiatedAt ?? 0n, 43);

  if (p.actionType === ACTION_CREATE || p.actionType === ACTION_UPDATE_ATAA) {
    const entries = p.ataa ?? [];
    const tail = Buffer.alloc(1 + entries.length * 40, 0);
    tail[0] = entries.length;
    entries.forEach((e, i) => {
      tail.set(e.token.slice(0, 32), 1 + i * 40);
      tail.writeBigUInt64BE(e.amount, 1 + i * 40 + 32);
    });
    return Buffer.concat([header, tail]);
  } else {
    return Buffer.concat([header, Buffer.from([p.isClosed ? 1 : 0])]);
  }
}

// ── PaymentPayload encoder ────────────────────────────────────────────────────

export interface PaymentPayloadParams {
  payableId: Uint8Array;
  nonce: bigint;
  initiatedAt?: bigint;
  amount: bigint;
  payableChainToken?: Uint8Array;
  payableChainId: Uint8Array;
  payer: Uint8Array;
  payerChainToken?: Uint8Array;
  payerChainId: Uint8Array;
  payerPaymentId?: Uint8Array;
}

/**
 * Encode a PaymentPayload to exactly 251 bytes.
 * Byte layout mirrors encode.rs encode_payment_payload():
 *   [0]       0x02 PAYLOAD_TYPE_PAYMENT
 *   [1]       0x01 version
 *   [2]       0x05 ACTION_PAYMENT
 *   [3..35]   payable_id
 *   [35..43]  nonce (u64 be)
 *   [43..51]  initiated_at (i64 be)
 *   [51..59]  amount (u64 be)
 *   [59..91]  payable_chain_token
 *   [91..123] payable_chain_id
 *   [123..155] payer
 *   [155..187] payer_chain_token
 *   [187..219] payer_chain_id
 *   [219..251] payer_payment_id
 */
export function encodePaymentPayload(p: PaymentPayloadParams): Buffer {
  const buf = Buffer.alloc(251, 0);
  buf[0] = 0x02; // PAYLOAD_TYPE_PAYMENT
  buf[1] = 0x01; // version
  buf[2] = 0x05; // ACTION_PAYMENT
  buf.set(p.payableId.slice(0, 32), 3);
  buf.writeBigUInt64BE(p.nonce, 35);
  buf.writeBigInt64BE(p.initiatedAt ?? 0n, 43);
  buf.writeBigUInt64BE(p.amount, 51);
  if (p.payableChainToken) buf.set(p.payableChainToken.slice(0, 32), 59);
  buf.set(p.payableChainId.slice(0, 32), 91);
  buf.set(p.payer.slice(0, 32), 123);
  if (p.payerChainToken) buf.set(p.payerChainToken.slice(0, 32), 155);
  buf.set(p.payerChainId.slice(0, 32), 187);
  if (p.payerPaymentId) buf.set(p.payerPaymentId.slice(0, 32), 219);
  return buf;
}

// ── PostedVAA ─────────────────────────────────────────────────────────────────

export interface PostedVaaParams {
  sequence?: bigint;
  emitterChain: number;
  emitterAddress: Uint8Array;
  payload: Buffer;
}

export function buildPostedVaaData(p: PostedVaaParams): Buffer {
  const { sequence = 1n, emitterChain, emitterAddress, payload } = p;
  const buf = Buffer.alloc(99 + payload.length, 0);
  // discriminator: "vaa\x01\0\0\0\0"
  buf.set([0x76, 0x61, 0x61, 0x01, 0x00, 0x00, 0x00, 0x00], 0);
  buf[8] = 1; // consistency_level
  buf.writeBigUInt64LE(sequence, 53);
  buf.writeUInt16LE(emitterChain, 61);
  buf.set(emitterAddress.slice(0, 32), 63);
  buf.writeUInt32LE(payload.length, 95);
  buf.set(payload, 99);
  return buf;
}

export function postedVaaPDA(vaaHash: Buffer, wormhole: PublicKey = WORMHOLE_DEVNET): PublicKey {
  return PublicKey.findProgramAddressSync([Buffer.from('PostedVAA'), vaaHash], wormhole)[0];
}

export function injectPostedVaa(
  svm: LiteSVM,
  vaaHash: Buffer,
  vaaData: Buffer,
  wormhole: PublicKey = WORMHOLE_DEVNET
): PublicKey {
  const addr = postedVaaPDA(vaaHash, wormhole);
  const lamports = Number(svm.minimumBalanceForRentExemption(BigInt(vaaData.length)));
  svm.setAccount(addr, { lamports, data: vaaData, owner: wormhole, executable: false });
  return addr;
}

// ── CCTP message ──────────────────────────────────────────────────────────────

export interface CctpMessageParams {
  srcDomain: number;
  nonce: Buffer;
  sender: Buffer;
  payload: Buffer;
}

export function buildCctpMessage(p: CctpMessageParams): Buffer {
  const buf = Buffer.alloc(148 + p.payload.length, 0);
  buf.writeUInt32BE(p.srcDomain, 4);
  buf.set(p.nonce.slice(0, 32), 12);
  buf.set(p.sender.slice(0, 32), 44);
  buf.set(p.payload, 148);
  return buf;
}

// ── ChainRegistry injection ───────────────────────────────────────────────────

export function cctpDataNoncePDA(srcDomain: number, nonce: Buffer): PublicKey {
  const domainBuf = Buffer.alloc(4);
  domainBuf.writeUInt32LE(srcDomain, 0);
  return PublicKey.findProgramAddressSync([Buffer.from('cctp_data_nonce'), domainBuf, nonce], PROGRAM_ID)[0];
}
