use anchor_lang::prelude::*;
use std::io;

#[derive(Clone, Copy, Debug)]
/// Necessary info to record a payable's payment if the involved blockchain
/// networks are different. That is the when a user is on a different chain
/// from the payable.
pub struct PaymentPayload {
  /// Version of the payload.
  pub version: u8,

  /// The Payable's ID.
  pub payable_id: [u8; 32],

  /// The Wormhole-normalized address of the involved token on the payable
  /// (destination) chain.
  pub payable_chain_token: [u8; 32],

  /// Wormhole Chain ID of where the Payable was created.
  pub payable_chain_id: u16,

  /// Who made the payment.
  pub payer: [u8; 32],

  /// The Wormhole-normalized address of the involved token on the payer
  /// (source) chain.
  pub payer_chain_token: [u8; 32],

  /// Wormhole Chain ID of where the User made the payment.
  pub payer_chain_id: u16,

  /// The amount paid on for the transaction.
  pub amount: u64,
  
  /// Circle Nonce of the payment.
  pub circle_nonce: u64,
}

impl AnchorSerialize for PaymentPayload {
  fn serialize<W: io::Write>(&self, writer: &mut W) -> io::Result<()> {
    self.version.serialize(writer)?;
    self.payable_id.serialize(writer)?;
    self.payable_chain_token.serialize(writer)?;
    self.payable_chain_id.to_le_bytes().serialize(writer)?;
    self.payer.serialize(writer)?;
    self.payer_chain_token.serialize(writer)?;
    self.payer_chain_id.to_le_bytes().serialize(writer)?;
    self.amount.to_le_bytes().serialize(writer)?;
    self.circle_nonce.to_le_bytes().serialize(writer)?;
    Ok(())
  }
}

impl AnchorDeserialize for PaymentPayload {
  fn deserialize(buf: &mut &[u8]) -> io::Result<Self> {
    let mut index = 0usize;
    let version = u8::deserialize(&mut &buf[index..(index + 1)])?;
    index += 1;

    let payable_id = <[u8; 32]>::deserialize(&mut &buf[index..(index + 32)])?;
    index += 32;

    let payable_chain_token =
      <[u8; 32]>::deserialize(&mut &buf[index..(index + 32)])?;
    index += 32;

    let payable_chain_id = {
      let mut out = [0u8; 2];
      out.copy_from_slice(&buf[index..(index + 2)]);
      u16::from_le_bytes(out) as u16
    };
    index += 2;

    let payer = <[u8; 32]>::deserialize(&mut &buf[index..(index + 32)])?;
    index += 32;

    let payer_chain_token =
      <[u8; 32]>::deserialize(&mut &buf[index..(index + 32)])?;
    index += 32;

    let payer_chain_id = {
      let mut out = [0u8; 2];
      out.copy_from_slice(&buf[index..(index + 2)]);
      u16::from_le_bytes(out) as u16
    };
    index += 2;

    let amount = {
      let mut out = [0u8; 8];
      out.copy_from_slice(&buf[index..(index + 8)]);
      u64::from_le_bytes(out) as u64
    };
    index += 8;

    let circle_nonce = {
      let mut out = [0u8; 8];
      out.copy_from_slice(&buf[index..(index + 8)]);
      u64::from_le_bytes(out) as u64
    };
    index += 8;

    if index != buf.len() {
      return Err(io::Error::new(
        io::ErrorKind::InvalidInput,
        "InvalidPayload",
      ));
    }

    Ok(PaymentPayload {
      version,
      payable_id,
      payable_chain_token,
      payable_chain_id,
      payer,
      payer_chain_token,
      payer_chain_id,
      amount,
      circle_nonce,
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
    let payload = PaymentPayload {
      version: 1,
      payable_id: [1; 32],
      payable_chain_token: [2; 32],
      payable_chain_id: 100,
      payer: [3; 32],
      payer_chain_token: [4; 32],
      payer_chain_id: 200,
      amount: 1000,
      circle_nonce: 123456789,
    };
    let mut buf = Vec::new();
    payload.serialize(&mut buf).unwrap();
    let deserialized_payload =
      PaymentPayload::deserialize(&mut &buf[..]).unwrap();

    assert_eq!(payload.version, deserialized_payload.version);
    assert_eq!(payload.payable_id, deserialized_payload.payable_id);
    assert_eq!(
      payload.payable_chain_token,
      deserialized_payload.payable_chain_token
    );
    assert_eq!(
      payload.payable_chain_id,
      deserialized_payload.payable_chain_id
    );
    assert_eq!(payload.payer, deserialized_payload.payer);
    assert_eq!(
      payload.payer_chain_token,
      deserialized_payload.payer_chain_token
    );
    assert_eq!(payload.payer_chain_id, deserialized_payload.payer_chain_id);
    assert_eq!(payload.amount, deserialized_payload.amount);
    assert_eq!(payload.circle_nonce, deserialized_payload.circle_nonce);
  }

  #[test]
  fn test_deserialize_invalid_input() {
    let buf = vec![0; 152]; // Too long buffer length
    let result = PaymentPayload::deserialize(&mut &buf[..]);

    assert!(result.is_err());
    assert_eq!(result.unwrap_err().kind(), io::ErrorKind::InvalidInput);
  }
}
