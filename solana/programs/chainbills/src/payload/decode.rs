//! Payload decoding: raw bytes from Wormhole/CCTP → typed Rust structs.
//! Validates type bytes, version, and length before extracting fields.

use anchor_lang::prelude::*;

use crate::{
  constants::*,
  errors::ChainbillsError,
  payload::encode::{PayablePayload, PaymentPayload},
};

/// Decode a raw byte slice into a `PaymentPayload`.
///
/// Validates:
/// 1. Length == 251
/// 2. data[0] == PAYLOAD_TYPE_PAYMENT (0x02)
/// 3. data[1] == PAYLOAD_VERSION (0x01)
///
/// All integers are decoded from big-endian.
///
/// # Arguments
/// * `data` — raw payload bytes from a Wormhole VAA body
pub fn decode_payment_payload(data: &[u8]) -> Result<PaymentPayload> {
  require!(
    data.len() == PAYMENT_PAYLOAD_SIZE,
    ChainbillsError::InvalidPayloadLength
  );
  require!(
    data[0] == PAYLOAD_TYPE_PAYMENT,
    ChainbillsError::InvalidPayloadType
  );
  require!(
    data[1] == PAYLOAD_VERSION,
    ChainbillsError::InvalidPayloadVersion
  );

  let action_type = data[2];

  let mut payable_id = [0u8; 32];
  payable_id.copy_from_slice(&data[3..35]);

  let nonce = u64::from_be_bytes(data[35..43].try_into().unwrap());
  let initiated_at = i64::from_be_bytes(data[43..51].try_into().unwrap());
  let amount = u64::from_be_bytes(data[51..59].try_into().unwrap());

  let mut payable_chain_token = [0u8; 32];
  payable_chain_token.copy_from_slice(&data[59..91]);

  let mut payable_chain_id = [0u8; 32];
  payable_chain_id.copy_from_slice(&data[91..123]);

  let mut payer = [0u8; 32];
  payer.copy_from_slice(&data[123..155]);

  let mut payer_chain_token = [0u8; 32];
  payer_chain_token.copy_from_slice(&data[155..187]);

  let mut payer_chain_id = [0u8; 32];
  payer_chain_id.copy_from_slice(&data[187..219]);

  let mut payer_payment_id = [0u8; 32];
  payer_payment_id.copy_from_slice(&data[219..251]);

  Ok(PaymentPayload {
    action_type,
    payable_id,
    nonce,
    initiated_at,
    amount,
    payable_chain_token,
    payable_chain_id,
    payer,
    payer_chain_token,
    payer_chain_id,
    payer_payment_id,
  })
}

/// Decode a raw byte slice into a `PayablePayload`.
///
/// Validates:
/// 1. Length >= 52 (minimum: 51-byte header + 1 tail byte)
/// 2. data[0] == PAYLOAD_TYPE_PAYABLE (0x01)
/// 3. data[1] == PAYLOAD_VERSION (0x01)
/// 4. For ATAA actions: length covers declared ataa_length entries
///
/// All integers are decoded from big-endian.
///
/// # Arguments
/// * `data` — raw payload bytes from a Wormhole VAA body or CCTP message
pub fn decode_payable_payload(data: &[u8]) -> Result<PayablePayload> {
  // Minimum: 51-byte header + 1 tail byte
  require!(data.len() >= 52, ChainbillsError::InvalidPayloadLength);
  require!(
    data[0] == PAYLOAD_TYPE_PAYABLE,
    ChainbillsError::InvalidPayloadType
  );
  require!(
    data[1] == PAYLOAD_VERSION,
    ChainbillsError::InvalidPayloadVersion
  );

  let action_type = data[2];

  let mut payable_id = [0u8; 32];
  payable_id.copy_from_slice(&data[3..35]);

  let nonce = u64::from_be_bytes(data[35..43].try_into().unwrap());
  let initiated_at = i64::from_be_bytes(data[43..51].try_into().unwrap());

  let mut allowed_tokens_and_amounts: Vec<([u8; 32], u64)> = Vec::new();
  let mut is_closed = false;

  match action_type {
    ACTION_CREATE | ACTION_UPDATE_ATAA => {
      let ataa_length = data[51] as usize;
      // Each entry is 32 (token) + 8 (amount) = 40 bytes
      let expected_len = 52 + ataa_length * 40;
      require!(
        data.len() == expected_len,
        ChainbillsError::InvalidPayloadLength
      );
      let mut offset = 52;
      for _ in 0..ataa_length {
        let mut token = [0u8; 32];
        token.copy_from_slice(&data[offset..offset + 32]);
        let amount = u64::from_be_bytes(
          data[offset + 32..offset + 40].try_into().unwrap(),
        );
        allowed_tokens_and_amounts.push((token, amount));
        offset += 40;
      }
    }
    ACTION_CLOSE => {
      require!(data.len() == 52, ChainbillsError::InvalidPayloadLength);
      is_closed = data[51] != 0;
    }
    ACTION_REOPEN => {
      require!(data.len() == 52, ChainbillsError::InvalidPayloadLength);
      is_closed = data[51] != 0;
    }
    _ => return err!(ChainbillsError::InvalidPayloadType),
  }

  Ok(PayablePayload {
    action_type,
    payable_id,
    nonce,
    initiated_at,
    allowed_tokens_and_amounts,
    is_closed,
  })
}

#[cfg(test)]
mod tests {
  use super::*;
  use crate::payload::encode::encode_payment_payload;

  #[test]
  fn test_payment_payload_roundtrip() {
    let original = PaymentPayload {
      action_type: ACTION_PAYMENT,
      payable_id: [1u8; 32],
      nonce: 42,
      initiated_at: 1_700_000_000,
      amount: 1_000_000,
      payable_chain_token: [2u8; 32],
      payable_chain_id: [3u8; 32],
      payer: [4u8; 32],
      payer_chain_token: [5u8; 32],
      payer_chain_id: [6u8; 32],
      payer_payment_id: [7u8; 32],
    };

    let encoded = encode_payment_payload(&original);
    assert_eq!(encoded.len(), 251);

    let decoded = decode_payment_payload(&encoded).unwrap();
    assert_eq!(decoded.action_type, ACTION_PAYMENT);
    assert_eq!(decoded.payable_id, [1u8; 32]);
    assert_eq!(decoded.nonce, 42);
    assert_eq!(decoded.initiated_at, 1_700_000_000);
    assert_eq!(decoded.amount, 1_000_000);
    assert_eq!(decoded.payable_chain_token, [2u8; 32]);
    assert_eq!(decoded.payer, [4u8; 32]);
    assert_eq!(decoded.payer_chain_id, [6u8; 32]);
    assert_eq!(decoded.payer_payment_id, [7u8; 32]);
  }

  #[test]
  fn test_payment_payload_byte_at_offset_0_is_type() {
    let p = PaymentPayload {
      action_type: ACTION_PAYMENT,
      payable_id: [0u8; 32],
      nonce: 0,
      initiated_at: 0,
      amount: 0,
      payable_chain_token: [0u8; 32],
      payable_chain_id: [0u8; 32],
      payer: [0u8; 32],
      payer_chain_token: [0u8; 32],
      payer_chain_id: [0u8; 32],
      payer_payment_id: [0u8; 32],
    };
    let encoded = encode_payment_payload(&p);
    assert_eq!(encoded[0], PAYLOAD_TYPE_PAYMENT);
    assert_eq!(encoded[1], PAYLOAD_VERSION);
    assert_eq!(encoded[2], ACTION_PAYMENT);
  }

  #[test]
  fn test_decode_rejects_wrong_type_byte() {
    let mut data = [0u8; 251];
    data[0] = 0xFF; // wrong type
    data[1] = PAYLOAD_VERSION;
    assert!(decode_payment_payload(&data).is_err());
  }

  #[test]
  fn test_decode_rejects_short_payload() {
    let mut data = [0u8; 12];
    data[0] = PAYLOAD_TYPE_PAYMENT;
    data[1] = PAYLOAD_VERSION;
    assert!(decode_payment_payload(&data).is_err());
  }
}
