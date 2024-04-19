use crate::{constants::*, state::TokenAndAmount};
use anchor_lang::prelude::*;
use std::io;

#[derive(Clone, Copy)]
/// Details of the payload coming from Wormhole.
pub struct CbPayloadMessage {
  /// Unique Identifier for the payload message type.
  /// 1 for InitializePayable
  /// 2 for ClosePayable
  /// 3 for ReopenPayable
  /// 4 for UpdatePayableDescription
  /// 5 for Pay
  /// 6 for Withdraw
  pub action_id: u8,
  /// The Wormhole-normalized wallet address that made the contract call
  /// in the source chain.
  pub caller: [u8; 32],
  /// The Wormhole-normalized address for a payable.
  ///
  /// Necesary when the `action_id` is not 1.
  pub payable_id: [u8; 32],
  /// The Wormhole-normalized address of the involved token.
  ///
  /// Necessary when the `action_id` is 5 or 6. That is, for "Pay" and
  /// "Withdraw" methods. Essentially, this is the token involved in
  /// the transaction.
  pub token: [u8; 32],
  /// The Wormhole-normalized (with 8 decimals) amount of the token.
  ///
  /// Necessary when the `action_id` is 5 or 6. That is, for "Pay" and
  /// "Withdraw" methods. Essentially, this is the amount involved in
  /// the transaction.
  pub amount: u64,
  /// Whether a payable allows payments of any amount of any token.
  ///
  /// Necesary when the `action_id` is 1.
  pub allows_free_payments: bool,
  /// The serialized accepted tokens (and their amounts) on a payable.
  ///
  /// Necesary when the `action_id` is 1.
  ///
  /// This is serialized to allow the Copy trait on this struct. And for
  /// such to work, we must set the size of the bytes and compile time and
  /// hence this the maximum obtainable was used. The padded `1` is for the
  /// u8 that tells the size of the tokens_and_amounts during
  /// deserialization.
  pub tokens_and_amounts_serialized: [u8; 1 + MAX_PAYABLES_TOKENS * TokenAndAmount::SPACE],
  /// The serialized description that is displayed to payers when paying to and
  /// on receipts of a payable. It is serialized to allow the Copy trait on
  /// this struct.
  ///
  /// Necesary when the `action_id` is 1 or 4. That is, when initializing a
  /// payable or when updating its description.
  pub description_serialized: [u8; 2 + MAX_PAYABLES_DESCRIPTION_LENGTH],
}

impl CbPayloadMessage {
  pub fn tokens_and_amounts(&self) -> Vec<TokenAndAmount> {
    let mut index = 0usize;
    let buf = &self.tokens_and_amounts_serialized;
    let taas_length = buf[index];
    index += 1;

    let mut taas = Vec::<TokenAndAmount>::new();
    for _i in 0..taas_length {
      let _token = {
        let mut out = [0u8; 32];
        out.copy_from_slice(&buf[index..(index + 32)]);
        out
      };
      index += 32;
      let _amount = {
        let mut out = [0u8; 8];
        out.copy_from_slice(&buf[index..(index + 16)]);
        u64::from_be_bytes(out) as u64
      };
      index += 16;
      taas.push(TokenAndAmount {
        token: _token,
        amount: _amount,
      })
    }
    taas
  }

  pub fn description(&self) -> String {
    let mut index = 0usize;
    let buf = &self.tokens_and_amounts_serialized;
    let desc_length = {
      let mut out = [0u8; 2];
      out.copy_from_slice(&buf[index..(index + 2)]);
      u16::from_be_bytes(out) as u16
    };
    index += 2;

    String::from_utf8(buf[index..(index + desc_length as usize)].to_vec()).unwrap()
  }
}

impl AnchorSerialize for CbPayloadMessage {
  fn serialize<W: io::Write>(&self, writer: &mut W) -> io::Result<()> {
    self.action_id.serialize(writer)?;
    self.caller.serialize(writer)?;

    if self.action_id == 1 {
      if self.allows_free_payments {
        (1 as u8).to_be_bytes().serialize(writer)?;
      } else {
        (0 as u8).to_be_bytes().serialize(writer)?;

        let taas = self.tokens_and_amounts();
        (taas.len() as u8).to_be_bytes().serialize(writer)?;

        for taa in taas.iter() {
          taa.token.serialize(writer)?;
          taa.amount.serialize(writer)?;
        }
      }

      let desc = self.description().try_to_vec()?;
      (desc.len() as u16).to_be_bytes().serialize(writer)?;
      for item in desc {
        item.serialize(writer)?;
      }

      Ok(())
    } else if self.action_id > 1 && self.action_id <= 6 {
      self.payable_id.serialize(writer)?;

      if self.action_id == 4 {
        let desc = self.description().try_to_vec()?;
        (desc.len() as u16).to_be_bytes().serialize(writer)?;
        for item in desc {
          item.serialize(writer)?;
        }
      }

      if self.action_id == 5 || self.action_id == 6 {
        self.token.serialize(writer)?;
        self.amount.to_be_bytes().serialize(writer)?;
      }

      Ok(())
    } else {
      Err(io::Error::new(
        io::ErrorKind::InvalidInput,
        format!("InvalidActionId"),
      ))
    }
  }
}

impl AnchorDeserialize for CbPayloadMessage {
  fn deserialize(buf: &mut &[u8]) -> io::Result<Self> {
    let mut index = 0usize;
    let action_id = buf[index];
    index += 1;

    let caller = <[u8; 32]>::deserialize(&mut &buf[index..(index + 32)])?;
    index += 32;

    let mut payable_id = [0u8; 32];
    let mut token = [0u8; 32];
    let mut amount = 0u64;
    let mut allows_free_payments = false;
    let mut tokens_and_amounts_serialized = [0u8; 1 + MAX_PAYABLES_TOKENS * TokenAndAmount::SPACE];
    let mut description_serialized = [0u8; 2 + MAX_PAYABLES_DESCRIPTION_LENGTH];

    if action_id == 1 {
      let allows_free_encoded = buf[index];
      index += 1;

      if allows_free_encoded == 0 {
        allows_free_payments = false;
      } else if allows_free_encoded == 1 {
        allows_free_payments = true;
      } else {
        return Err(io::Error::new(
          io::ErrorKind::InvalidInput,
          "InvalidPayloadMessage",
        ));
      }

      if !allows_free_payments {
        let taas_length = buf[index];
        index += 1;

        if (taas_length as usize) > MAX_PAYABLES_TOKENS {
          return Err(io::Error::new(
            io::ErrorKind::InvalidInput,
            "InvalidPayloadMessage",
          ));
        }

        let _start: &[u8] = &[taas_length];
        let taas_bytes_length = (taas_length as usize) * TokenAndAmount::SPACE;
        tokens_and_amounts_serialized
          .copy_from_slice(&[_start, &buf[index..(index + taas_bytes_length)]].concat());
        index += taas_bytes_length;
      }

      let desc_length = {
        let mut out = [0u8; 2];
        out.copy_from_slice(&buf[index..(index + 2)]);
        u16::from_be_bytes(out) as u16
      };
      index += 2;

      if (desc_length as usize) > MAX_PAYABLES_DESCRIPTION_LENGTH {
        return Err(io::Error::new(
          io::ErrorKind::InvalidInput,
          "InvalidPayloadMessage",
        ));
      }

      let _start: &[u8] = desc_length.to_be_bytes().as_slice();
      description_serialized.copy_from_slice(
        &[
          desc_length.to_be_bytes().as_slice(),
          &buf[index..(index + (desc_length as usize))],
        ]
        .concat(),
      );
      index += desc_length as usize;

      // confirm that the message was the payload has ended
      if index != buf.len() {
        return Err(io::Error::new(
          io::ErrorKind::InvalidInput,
          "InvalidPayloadMessage",
        ));
      }
    } else if action_id > 1 && action_id <= 6 {
      payable_id = <[u8; 32]>::deserialize(&mut &buf[index..(index + 32)])?;
      index += 32;

      if action_id == 4 {
        let desc_length = {
          let mut out = [0u8; 2];
          out.copy_from_slice(&buf[index..(index + 2)]);
          u16::from_be_bytes(out) as u16
        };
        index += 2;

        if (desc_length as usize) > MAX_PAYABLES_DESCRIPTION_LENGTH {
          return Err(io::Error::new(
            io::ErrorKind::InvalidInput,
            "InvalidPayloadMessage",
          ));
        }

        let _start: &[u8] = desc_length.to_be_bytes().as_slice();
        description_serialized.copy_from_slice(
          &[
            desc_length.to_be_bytes().as_slice(),
            &buf[index..(index + (desc_length as usize))],
          ]
          .concat(),
        );
        index += desc_length as usize;
      }

      if action_id == 5 || action_id == 6 {
        token = <[u8; 32]>::deserialize(&mut &buf[index..(index + 32)])?;
        index += 32;
        amount = {
          let mut out = [0u8; 8];
          out.copy_from_slice(&buf[index..(index + 16)]);
          u64::from_be_bytes(out) as u64
        };
        index += 16;
      }

      // confirm that the message was the payload has ended
      if index != buf.len() {
        return Err(io::Error::new(
          io::ErrorKind::InvalidInput,
          "InvalidPayloadMessage",
        ));
      }
    } else {
      return Err(io::Error::new(
        io::ErrorKind::InvalidInput,
        "InvalidPayloadMessage",
      ));
    }

    Ok(CbPayloadMessage {
      action_id,
      caller,
      payable_id,
      token,
      amount,
      allows_free_payments,
      tokens_and_amounts_serialized,
      description_serialized,
    })
  }

  fn deserialize_reader<R: io::prelude::Read>(_reader: &mut R) -> io::Result<Self> {
    todo!()
  }
}
