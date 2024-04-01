use anchor_lang::prelude::*;

/// Maximum characters in a payable's description
#[constant]
pub const MAX_PAYABLES_DESCRIPTION_LENGTH: usize = 3000;

/// The maximum number of tokens a payable can hold balances in.
/// Also the maximum number of tokens that a payable can specify
/// that it can accept payments in.
#[constant]
pub const MAX_PAYABLES_TOKENS: usize = 20;
