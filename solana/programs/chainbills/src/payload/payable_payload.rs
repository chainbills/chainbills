use crate::state::TokenAndAmountForeign;
use anchor_lang::prelude::*;
use std::io;

#[derive(Clone, Debug)]
/// Emitted when a payable is created.
pub struct PayablePayload {
  /// Version of the payload.
  pub version: u8,

  /// Type of the payable activity.
  ///
  /// 1 - CreatedPayable
  /// 2 - ClosedPayable
  /// 3 - ReopenedPayable
  /// 4 - UpdatedPayableAllowedTokensAndAmounts
  pub action_type: u8,

  /// The Payable's ID.
  pub payable_id: [u8; 32],

  /// Whether the payable is closed or not.
  pub is_closed: bool,
  
  /// The allowed tokens and their amounts.
  pub allowed_tokens_and_amounts: Vec<TokenAndAmountForeign>,
}

impl AnchorSerialize for PayablePayload {
  fn serialize<W: io::Write>(&self, writer: &mut W) -> io::Result<()> {
    self.version.serialize(writer)?;
    self.action_type.serialize(writer)?;
    self.payable_id.serialize(writer)?;
    if self.action_type == 1 || self.action_type == 4 {
      (self.allowed_tokens_and_amounts.len() as u8).serialize(writer)?;
      for ataa in &self.allowed_tokens_and_amounts {
        ataa.serialize(writer)?;
      }
    } else if self.action_type == 2 || self.action_type == 3 {
      self.is_closed.serialize(writer)?;
    } else {
      return Err(io::Error::new(
        io::ErrorKind::InvalidInput,
        "InvalidPayload",
      ));
    }
    Ok(())
  }
}

impl AnchorDeserialize for PayablePayload {
  fn deserialize(buf: &mut &[u8]) -> io::Result<Self> {
    let mut index = 0usize;
    let version = u8::deserialize(&mut &buf[index..(index + 1)])?;
    index += 1;

    let action_type = u8::deserialize(&mut &buf[index..(index + 1)])?;
    index += 1;

    let payable_id = <[u8; 32]>::deserialize(&mut &buf[index..(index + 32)])?;
    index += 32;

    let mut is_closed = false;
    let mut allowed_tokens_and_amounts = vec![];

    if action_type == 1 || action_type == 4 {
      let ataa_len = u8::deserialize(&mut &buf[index..(index + 1)])?;
      index += 1;
      for _ in 0..ataa_len {
        let ataa = TokenAndAmountForeign::deserialize(&mut &buf[index..])?;
        allowed_tokens_and_amounts.push(ataa);
        index += 40; // 32 bytes for token + 8 bytes for amount
      }
    } else if action_type == 2 || action_type == 3 {
      is_closed = bool::deserialize(&mut &buf[index..(index + 1)])?;
      index += 1;
    }

    if index != buf.len() {
      return Err(io::Error::new(
        io::ErrorKind::InvalidInput,
        "InvalidPayload",
      ));
    }

    Ok(PayablePayload {
      version,
      action_type,
      payable_id,
      is_closed,
      allowed_tokens_and_amounts,
    })
  }

  fn deserialize_reader<R: io::prelude::Read>(
    _reader: &mut R,
  ) -> io::Result<Self> {
    todo!()
  }
}

#[cfg(test)]
mod tests {
  use super::*;

  #[test]
  fn test_serialize_deserialize() {
    let token_and_amount = TokenAndAmountForeign {
      token: [1; 32],
      amount: 100,
    };

    let payload = PayablePayload {
      version: 1,
      action_type: 1,
      payable_id: [2; 32],
      is_closed: false,
      allowed_tokens_and_amounts: vec![token_and_amount],
    };

    let mut buf = Vec::new();
    payload.serialize(&mut buf).unwrap();
    let deserialized_payload =
      PayablePayload::deserialize(&mut &buf[..]).unwrap();

    assert_eq!(payload.version, deserialized_payload.version);
    assert_eq!(payload.action_type, deserialized_payload.action_type);
    assert_eq!(payload.payable_id, deserialized_payload.payable_id);
    assert_eq!(payload.is_closed, deserialized_payload.is_closed);
    assert_eq!(
      payload.allowed_tokens_and_amounts.len(),
      deserialized_payload.allowed_tokens_and_amounts.len()
    );
    assert_eq!(
      payload.allowed_tokens_and_amounts[0].token,
      deserialized_payload.allowed_tokens_and_amounts[0].token
    );
    assert_eq!(
      payload.allowed_tokens_and_amounts[0].amount,
      deserialized_payload.allowed_tokens_and_amounts[0].amount
    );
  }

  #[test]
  fn test_deserialize_invalid_input() {
    let buf = vec![0; 121]; // Too long buffer length
    let result = PayablePayload::deserialize(&mut &buf[..]);

    assert!(result.is_err());
    assert_eq!(result.unwrap_err().kind(), io::ErrorKind::InvalidInput);
  }
}
