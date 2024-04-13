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
    uint256 amount;
  }

  /// The properties of a Payable that a host must provide to create one.
  struct CbPayableInputs {
    /// Displayed to payers when paying to and on receipts of a payable.
    string description;
    /// Whether a payable allows payments of any amount of any token.
    bool allowsFreePayments;
    /// The accepted tokens (and their amounts) on a payable.
    CbTokenAndAmount[] tokensAndAmounts;
  }

  /// Holds a payable's Wormhole-normalized address and the new description.
  struct CbUpdatePayableDescription {
    bytes32 payableId;
    string description;
  }

  /// Holds a payable's Wormhole-normalized address and the transaction details.
  struct CbTransaction {
    bytes32 payableId;
    CbTokenAndAmount details;
  }

  /// Details of the payload being sent to Wormhole.
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
    /// The abi.encoded equivalent of the necessary input for action.
    ///
    /// The abi.decoded result of input should match the following input types
    /// for the corresponding actionId:
    /// 1: {CbPayableInputs}
    /// 2: {bytes32} // The Wormhole-normalized address of a payable.
    /// 3: {bytes32} // The Wormhole-normalized address of a payable.
    /// 4: {CbUpdatePayableDescription}
    /// 5: {CbTransaction}
    /// 6: {CbTransaction}
    bytes input;
  }
}
