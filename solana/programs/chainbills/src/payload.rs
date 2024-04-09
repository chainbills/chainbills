use anchor_lang::prelude::*;

use crate::{constants::*, state::TokenAndAmount};

/// The properties of a Payable that a host must provide to create one.
pub struct CbPayableInputs {
  /// Displayed to payers when paying to and on receipts of a payable.
  pub description: string,
  /// Whether a payable allows payments of any amount of any token.
  pub allows_free_payments: bool,
  /// The accepted tokens (and their amounts) on a payable.
  pub tokens_and_amounts: Vec<TokenAndAmount>,
}

/// Holds a payable's Wormhole-normalized address and the new description.
struct CbUpdatePayableDescription {
  /// The Wormhole-normalized address for the payable.
  pub payable_id: [u8; 32],
  /// The Wormhole-normalized address of the token and Wormhole-normalized
  /// amount.
  pub description: string,
}

/// Holds a payable's Wormhole-normalized address and the transaction details.
pub struct CbTransaction {
  /// The Wormhole-normalized address for the payable.
  pub payable_id: [u8; 32],
  /// The Wormhole-normalized address of the token and Wormhole-normalized
  /// amount.
  pub details: TokenAndAmount,
}

#[derive(AnchorDeserialize, AnchorSerialize, Clone)]
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
  /// The abi.encoded equivalent of the necessary data for action.
  ///
  /// The abi.decoded result of data should match the following data types
  /// for the corresponding actionId:
  /// 1: {CbPayableInputs}
  /// 2: [u8; 32] // The Wormhole-normalized address of a payable.
  /// 3: [u8; 32] // The Wormhole-normalized address of a payable.
  /// 4: {CbUpdatePayableDescription}
  /// 5: {CbTransaction}
  /// 6: {CbTransaction}
  pub data: Vec<u8>,
}

impl CbPayloadMessage {
  pub fn extract(&mut self) -> T {
    match self.action_id {
      ACTION_ID_INITIALIZE_PAYABLE => self.data.try_into(),
    }
  }
}
