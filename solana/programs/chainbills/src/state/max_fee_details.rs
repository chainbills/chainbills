use anchor_lang::prelude::*;

/// Keeps track of how much of a token is its max fee.
#[account]
pub struct MaxFeeDetails {
  /// The address of the token mint.
  pub token: Pubkey, // 32 bytes

  /// The amount of the token (with its decimals).
  pub amount: u64, // 8 bytes
}

impl MaxFeeDetails {
  // discriminator (8) first
  pub const SPACE: usize = 8 + 32 + 8;

  /// AKA `b"max_withdrawal_fee`.
  #[constant]
  pub const SEED_PREFIX: &'static [u8] = b"max_withdrawal_fee";
}
