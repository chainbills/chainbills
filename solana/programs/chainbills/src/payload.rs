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
  pub amount: u128,
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
        out.copy_from_slice(&buf[index..(index + 33)]);
        out
      };
      index += 32;
      let _amount = {
        let mut out = [0u8; 16];
        out.copy_from_slice(&buf[index..(index + 17)]);
        u128::from_be_bytes(out) as u128
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
    String::from_utf8(self.description_serialized.to_vec()).expect("InvalidPayloadMessage")
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

    let caller = {
      let mut out = [0u8; 32];
      out.copy_from_slice(&buf[index..33]);
      out
    };
    index += 32;

    let mut payable_id = [0u8; 32];
    let mut token = [0u8; 32];
    let mut amount = 0u128;
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
          .copy_from_slice(&[_start, &buf[index..(index + 1 + taas_bytes_length)]].concat());
        index += taas_bytes_length;
      }
    } else if action_id > 1 && action_id <= 6 {
    } else {
      return Err(io::Error::new(
        io::ErrorKind::InvalidInput,
        "InvalidPayloadMessage",
      ));
    }

    // match buf[0] {

    // PAYLOAD_ID_ALIVE => Ok(HelloWorldMessage::Alive {
    //   program_id: Pubkey::try_from(&buf[1..33]).unwrap(),
    // }),
    // PAYLOAD_ID_HELLO => {
    //   let length = {
    //     let mut out = [0u8; 2];
    //     out.copy_from_slice(&buf[1..3]);
    //     u16::from_be_bytes(out) as usize
    //   };
    //   if length > HELLO_MESSAGE_MAX_LENGTH {
    //     Err(io::Error::new(
    //       io::ErrorKind::InvalidInput,
    //       format!("message exceeds {HELLO_MESSAGE_MAX_LENGTH} bytes"),
    //     ))
    //   } else {
    //     Ok(HelloWorldMessage::Hello {
    //       message: buf[3..(3 + length)].to_vec(),
    //     })
    //   }
    // }

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
