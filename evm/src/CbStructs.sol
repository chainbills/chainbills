// SPDX-License-Identifier: Apache 2
pragma solidity ^0.8.20;

contract CbStructs {
  /// Expected actionId in received payload message for InitializePayable
  /// instruction.
  uint8 public constant ACTION_ID_INITIALIZE_PAYABLE = 1;

  /// Expected actionId in received payload message for ClosePayable instruction.
  uint8 public constant ACTION_ID_CLOSE_PAYABLE = 2;

  /// Expected actionId in received payload message for ReopenPayable instruction.
  uint8 public constant ACTION_ID_REOPEN_PAYABLE = 3;

  /// Expected actionId in received payload message for
  /// UpdatePayableDescription instruction.
  uint8 public constant ACTION_ID_UPDATE_PAYABLE_DESCRIPTION = 4;

  /// Expected actionId in received payload message for Pay instruction.
  uint8 public constant ACTION_ID_PAY = 5;

  /// Expected actionId in received payload message for Withdraw instruction.
  uint8 public constant ACTION_ID_WITHDRAW = 6;

  /// Maximum characters in a payable's description.
  uint256 public constant MAX_PAYABLES_DESCRIPTION_LENGTH = 3000;

  /// The maximum number of tokens a payable can hold balances in.
  /// Also the maximum number of tokens that a payable can specify
  /// that it can accept payments in.
  uint256 public constant MAX_PAYABLES_TOKENS = 20;

  /// A combination of a Wormhole-normalized token address and its
  /// Wormhole-normalized associated amount.
  ///
  /// This combination is used to constrain how much of a token
  /// a payable can accept. It is also used to record the details
  /// of a payment or a withdrawal.
  struct CbTokenAndAmount {
    /// The Wormhole-normalized address of the associated token.
    /// This should be the bridged address on Solana.
    bytes32 token;
    /// The Wormhole-normalized (with 8 decimals) amount of the token.
    uint128 amount;
  }

  /// Details of the payload being sent to Wormhole.
  ///
  /// It is a generic struct with that should serve for all method calls
  /// across Wormhole. The `actionId` and the `caller` are compulsory.
  /// The other properties should have a valid value depending on the method
  /// been called or on the actionId.
  struct CbPayloadMessage {
    /// Unique Identifier for the payload message type.
    /// 1 for InitializePayable
    /// 2 for ClosePayable
    /// 3 for ReopenPayable
    /// 4 for UpdatePayableDescription
    /// 5 for Pay
    /// 6 for Withdraw
    uint8 actionId;
    /// The Wormhole-normalized wallet address that made the contract call.
    bytes32 caller;
    /// The Wormhole-normalized address of a payable.
    ///
    /// Necesary when the `actionId` is not 1.
    bytes32 payableId;
    /// The Wormhole-normalized address of the involved token.
    /// This should be the bridged address on Solana.
    ///
    /// Necessary when the `actionId` is 5 or 6. That is, for "Pay" and
    /// "Withdraw" methods. Essentially, this is the token involved in
    /// the transaction.
    bytes32 token;
    /// The Wormhole-normalized (with 8 decimals) amount of the token.
    ///
    /// Necessary when the `actionId` is 5 or 6. That is, for "Pay" and
    /// "Withdraw" methods. Essentially, this is the amount involved in
    /// the transaction.
    uint128 amount;
    /// Whether a payable allows payments of any amount of any token.
    ///
    /// Necesary when the `actionId` is 1. That is, when initializing a
    /// payable.
    bool allowsFreePayments;
    /// The accepted tokens (and their amounts) on a payable.
    ///
    /// Necesary when the `actionId` is 1. That is, when initializing a
    /// payable.
    CbTokenAndAmount[] tokensAndAmounts;
    /// Displayed to payers when paying to and on receipts of a payable.
    ///
    /// Necesary when the `actionId` is 1 or 4. That is, when initializing a
    /// payable or when updating its description.
    string description;
  }
}
