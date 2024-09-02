use anchor_lang::prelude::*;

/// A combination of a token address and its associated amount.
///
/// This combination is used to constrain how much of a token
/// a payable can accept. It is also used to record the details
/// of a payment or a withdrawal.
#[derive(AnchorDeserialize, AnchorSerialize, Clone, Copy)]
pub struct TokenAndAmount {
  /// The associated token mint.
  pub token: Pubkey, // 32 bytes

  /// The amount of the token with its decimals.
  pub amount: u64, // 8 bytes
}

impl TokenAndAmount {
  pub const SPACE: usize = 32 + 8;
}
