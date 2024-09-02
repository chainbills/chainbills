use anchor_lang::prelude::*;
use std::io;

#[derive(Clone, Copy, Debug)]
/// Necessary info to record a user's payment if the involved blockchain
/// networks are different. That is the when a user is on a different chain
/// from the payable.
pub struct CompletePaymentPayload {
  /// The Payable's ID.
  pub payable_id: [u8; 32],

  /// The Wormhole-normalized wallet address that made the payment.
  pub wallet: [u8; 32],

  /// The Wormhole-normalized address of the involved token.
  pub token: [u8; 32],

  /// The Wormhole-normalized (with 8 decimals) amount of the token.
  pub amount: u64,
  /// The nth count of payments by the payable at the point of this payment.
  /// This can only be obtained from the Payable's chain.
  pub payable_count: u64,

  /// When the payment was made.
  pub timestamp: u64,
}

impl AnchorSerialize for CompletePaymentPayload {
  fn serialize<W: io::Write>(&self, writer: &mut W) -> io::Result<()> {
    self.payable_id.serialize(writer)?;
    self.wallet.serialize(writer)?;
    self.token.serialize(writer)?;
    self.amount.to_be_bytes().serialize(writer)?;
    self.payable_count.to_be_bytes().serialize(writer)?;
    self.timestamp.to_be_bytes().serialize(writer)?;
    Ok(())
  }
}

impl AnchorDeserialize for CompletePaymentPayload {
  fn deserialize(buf: &mut &[u8]) -> io::Result<Self> {
    let mut index = 0usize;
    let payable_id = <[u8; 32]>::deserialize(&mut &buf[index..(index + 32)])?;
    index += 32;

    let wallet = <[u8; 32]>::deserialize(&mut &buf[index..(index + 32)])?;
    index += 32;

    let token = <[u8; 32]>::deserialize(&mut &buf[index..(index + 32)])?;
    index += 32;

    let amount = {
      let mut out = [0u8; 8];
      out.copy_from_slice(&buf[index..(index + 8)]);
      u64::from_be_bytes(out) as u64
    };
    index += 8;

    let payable_count = {
      let mut out = [0u8; 8];
      out.copy_from_slice(&buf[index..(index + 8)]);
      u64::from_be_bytes(out) as u64
    };
    index += 8;

    let timestamp = {
      let mut out = [0u8; 8];
      out.copy_from_slice(&buf[index..(index + 8)]);
      u64::from_be_bytes(out) as u64
    };
    index += 8;

    if index != buf.len() {
      return Err(io::Error::new(
        io::ErrorKind::InvalidInput,
        "InvalidPayloadMessage",
      ));
    }

    Ok(CompletePaymentPayload {
      payable_id,
      wallet,
      token,
      amount,
      payable_count,
      timestamp,
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
    let payload = CompletePaymentPayload {
      payable_id: [1; 32],
      wallet: [2; 32],
      token: [3; 32],
      amount: 100,
      payable_count: 5,
      timestamp: 1631234567890,
    };
    let mut buf = Vec::new();
    payload.serialize(&mut buf).unwrap();
    let deserialized_payload =
      CompletePaymentPayload::deserialize(&mut &buf[..]).unwrap();

    assert_eq!(payload.payable_id, deserialized_payload.payable_id);
    assert_eq!(payload.wallet, deserialized_payload.wallet);
    assert_eq!(payload.token, deserialized_payload.token);
    assert_eq!(payload.amount, deserialized_payload.amount);
    assert_eq!(payload.payable_count, deserialized_payload.payable_count);
    assert_eq!(payload.timestamp, deserialized_payload.timestamp);
  }

  #[test]
  fn test_deserialize_invalid_input() {
    let buf = vec![0; 121]; // Too long buffer length
    let result = CompletePaymentPayload::deserialize(&mut &buf[..]);

    assert!(result.is_err());
    assert_eq!(result.unwrap_err().kind(), io::ErrorKind::InvalidInput);
  }
}
