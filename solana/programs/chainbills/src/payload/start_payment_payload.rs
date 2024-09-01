use anchor_lang::prelude::*;
use std::io;

#[derive(Clone, Copy, Debug)]
/// Necessary info to record a payable's payment if the involved blockchain
/// networks are different. That is the when a user is on a different chain
/// from the payable.
pub struct StartPaymentPayload {
  /// The Payable's ID.
  pub payable_id: [u8; 32],
  /// The nth count of payments by the payer at the point of this payment.
  /// This can only be obtained from the User's chain.
  pub payer_count: u64,
}

impl AnchorSerialize for StartPaymentPayload {
  fn serialize<W: io::Write>(&self, writer: &mut W) -> io::Result<()> {
    self.payable_id.serialize(writer)?;
    self.payer_count.to_be_bytes().serialize(writer)?;
    Ok(())
  }
}

impl AnchorDeserialize for StartPaymentPayload {
  fn deserialize(buf: &mut &[u8]) -> io::Result<Self> {
    let mut index = 0usize;
    let payable_id = <[u8; 32]>::deserialize(&mut &buf[index..(index + 32)])?;
    index += 32;

    let payer_count = {
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

    Ok(StartPaymentPayload {
      payable_id,
      payer_count,
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
  fn serialize_deserialize() {
    let payload = StartPaymentPayload {
      payable_id: [1; 32],
      payer_count: 10,
    };
    let mut buf = Vec::new();
    payload.serialize(&mut buf).unwrap();
    let deserialized_payload =
      StartPaymentPayload::deserialize(&mut &buf[..]).unwrap();

    assert_eq!(payload.payable_id, deserialized_payload.payable_id);
    assert_eq!(payload.payer_count, deserialized_payload.payer_count);
  }

  #[test]
  fn deserialize_invalid_input() {
    let buf = vec![0; 41]; // Too long buffer length
    let result = StartPaymentPayload::deserialize(&mut &buf[..]);

    assert!(result.is_err());
    assert_eq!(result.unwrap_err().kind(), io::ErrorKind::InvalidInput);
  }
}
