//! Payload encoding: Rust structs → byte arrays for Wormhole/CCTP messages.
//! Byte layouts must match EVM's `CbPayloadMessages.sol` exactly.

use anchor_lang::prelude::*;

use crate::{constants::*, errors::ChainbillsError};

/// All fields of a PaymentPayload (type = 0x02).
/// Wire format: exactly 251 bytes, big-endian integers.
/// See DESIGN.md §12.1 for byte-offset layout.
pub struct PaymentPayload {
  /// actionType byte — always ACTION_PAYMENT (0x05).
  pub action_type: u8,
  /// payable_id: 32 bytes — the target payable's identifier on its home chain.
  pub payable_id: [u8; 32],
  /// nonce: u64 big-endian — unique per-payer payment counter.
  pub nonce: u64,
  /// initiated_at: i64 big-endian — Unix timestamp of payment.
  pub initiated_at: i64,
  /// amount: u64 big-endian — payment amount in USDC base units.
  pub amount: u64,
  /// payable_chain_token: 32 bytes — Wormhole-normalized token on payable's
  /// chain.
  pub payable_chain_token: [u8; 32],
  /// payable_chain_id: 32 bytes — cbChainId of the payable's home chain.
  pub payable_chain_id: [u8; 32],
  /// payer: 32 bytes — Wormhole-normalized payer address.
  pub payer: [u8; 32],
  /// payer_chain_token: 32 bytes — Wormhole-normalized token on payer's chain.
  pub payer_chain_token: [u8; 32],
  /// payer_chain_id: 32 bytes — cbChainId of the payer's chain.
  pub payer_chain_id: [u8; 32],
  /// payer_payment_id: 32 bytes — UserPayment PDA address as bytes.
  pub payer_payment_id: [u8; 32],
}

/// All fields of a PayablePayload (type = 0x01).
/// Wire format: variable length, header is 51 bytes, tail depends on
/// action_type. See DESIGN.md §12.2 for byte-offset layout.
pub struct PayablePayload {
  /// action_type: 1=Create, 2=Close, 3=Reopen, 4=UpdateATAA.
  pub action_type: u8,
  /// payable_id: 32 bytes — the payable's identifier on its home chain.
  pub payable_id: [u8; 32],
  /// nonce: u64 big-endian — monotonically increasing broadcast counter.
  pub nonce: u64,
  /// initiated_at: i64 big-endian — Unix timestamp of broadcast.
  pub initiated_at: i64,
  /// ATAA entries — populated for action_type 1 (Create) and 4 (UpdateATAA).
  pub allowed_tokens_and_amounts: Vec<([u8; 32], u64)>,
  /// is_closed flag — populated for action_type 2 (Close) and 3 (Reopen).
  pub is_closed: bool,
}

/// Encode a `PaymentPayload` into exactly 251 bytes.
///
/// Byte layout (all integers big-endian):
/// ```text
/// [0]       payloadType = 0x02
/// [1]       version     = 0x01
/// [2]       actionType  = 0x05
/// [3..35]   payable_id
/// [35..43]  nonce       (u64 be)
/// [43..51]  initiated_at (i64 be)
/// [51..59]  amount      (u64 be)
/// [59..91]  payable_chain_token
/// [91..123] payable_chain_id
/// [123..155] payer
/// [155..187] payer_chain_token
/// [187..219] payer_chain_id
/// [219..251] payer_payment_id
/// ```
///
/// # Arguments
/// * `p` — the `PaymentPayload` to encode
pub fn encode_payment_payload(
  p: &PaymentPayload,
) -> [u8; PAYMENT_PAYLOAD_SIZE] {
  let mut buf = [0u8; PAYMENT_PAYLOAD_SIZE];

  buf[0] = PAYLOAD_TYPE_PAYMENT;
  buf[1] = PAYLOAD_VERSION;
  buf[2] = p.action_type;
  buf[3..35].copy_from_slice(&p.payable_id);
  buf[35..43].copy_from_slice(&p.nonce.to_be_bytes());
  buf[43..51].copy_from_slice(&p.initiated_at.to_be_bytes());
  buf[51..59].copy_from_slice(&p.amount.to_be_bytes());
  buf[59..91].copy_from_slice(&p.payable_chain_token);
  buf[91..123].copy_from_slice(&p.payable_chain_id);
  buf[123..155].copy_from_slice(&p.payer);
  buf[155..187].copy_from_slice(&p.payer_chain_token);
  buf[187..219].copy_from_slice(&p.payer_chain_id);
  buf[219..251].copy_from_slice(&p.payer_payment_id);

  buf
}

/// Encode a `PayablePayload` into a variable-length byte vector.
///
/// Header (51 bytes, always present):
/// ```text
/// [0]       payloadType = 0x01
/// [1]       version     = 0x01
/// [2]       actionType  (1/2/3/4)
/// [3..35]   payable_id
/// [35..43]  nonce (u64 be)
/// [43..51]  initiated_at (i64 be)
/// ```
///
/// Tail for actionType 1 or 4 (ATAA payload):
/// ```text
/// [51]      ataa_length (u8, max 255)
/// [52..]    [token:[u8;32] | amount:u64 be] * ataa_length
/// ```
///
/// Tail for actionType 2 or 3 (open/close):
/// ```text
/// [51]      is_closed (0x00 or 0x01)
/// ```
///
/// # Arguments
/// * `p` — the `PayablePayload` to encode
pub fn encode_payable_payload(p: &PayablePayload) -> Result<Vec<u8>> {
  let mut buf = Vec::new();

  // Header
  buf.push(PAYLOAD_TYPE_PAYABLE);
  buf.push(PAYLOAD_VERSION);
  buf.push(p.action_type);
  buf.extend_from_slice(&p.payable_id);
  buf.extend_from_slice(&p.nonce.to_be_bytes());
  buf.extend_from_slice(&p.initiated_at.to_be_bytes());

  // Tail
  match p.action_type {
    ACTION_CREATE | ACTION_UPDATE_ATAA => {
      let len = p.allowed_tokens_and_amounts.len();
      require!(
        len <= MAX_ATAA_COUNT as usize,
        ChainbillsError::MaxAtaaExceeded
      );
      buf.push(len as u8);
      for (token, amount) in &p.allowed_tokens_and_amounts {
        buf.extend_from_slice(token);
        buf.extend_from_slice(&amount.to_be_bytes());
      }
    }
    ACTION_CLOSE | ACTION_REOPEN => {
      buf.push(if p.is_closed { 0x01 } else { 0x00 });
    }
    _ => return err!(ChainbillsError::InvalidPayloadType),
  }

  Ok(buf)
}
