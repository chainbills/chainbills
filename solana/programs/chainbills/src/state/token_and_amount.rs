use anchor_lang::prelude::*;

/// A combination of token mints and associated amounts with
/// that this program uses to constrain how much of a token
/// a payable can accept and also to record details of
/// payments and withdrawals.
#[derive(AnchorDeserialize, AnchorSerialize, Clone, Copy)]
pub struct TokenAndAmount {
    /// The address of the token mint of the associated token.
    pub token: Pubkey,

    /// The amount (with decimals) associated with the token.
    pub amount: u64,
}

impl TokenAndAmount {
    pub const SPACE: usize = 32 + 8;
}
