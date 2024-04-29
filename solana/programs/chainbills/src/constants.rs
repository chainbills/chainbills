use anchor_lang::prelude::*;

/// Expected actionId in received payload message for InitializePayable
/// instruction.
#[constant]
pub const ACTION_ID_INITIALIZE_PAYABLE: u8 = 1;

/// Expected actionId in received payload message for ClosePayable instruction.
#[constant]
pub const ACTION_ID_CLOSE_PAYABLE: u8 = 2;

/// Expected actionId in received payload message for ReopenPayable instruction.
#[constant]
pub const ACTION_ID_REOPEN_PAYABLE: u8 = 3;

/// Expected actionId in received payload message for UpdatePayableDescription
/// instruction.
#[constant]
pub const ACTION_ID_UPDATE_PAYABLE_DESCRIPTION: u8 = 4;

/// Expected actionId in received payload message for Pay instruction.
#[constant]
pub const ACTION_ID_PAY: u8 = 5;

/// Expected actionId in received payload message for Withdraw instruction.
#[constant]
pub const ACTION_ID_WITHDRAW: u8 = 6;

/// Maximum characters in a payable's description.
#[constant]
pub const MAX_PAYABLES_DESCRIPTION_LENGTH: usize = 3000;

/// The maximum number of tokens a payable can hold balances in.
/// Also the maximum number of tokens that a payable can specify
/// that it can accept payments in.
#[constant]
pub const MAX_PAYABLES_TOKENS: usize = 20;

/// AKA `b"sending"`.
#[constant]
pub const SEED_PREFIX_SENDING: &[u8] = b"sending";

/// AKA `b"max_withdrawal_fee`.
#[constant]
pub const SEED_PREFIX_MAX_WITHDRAWAL_FEE: &[u8] = b"max_withdrawal_fee";
