use anchor_lang::prelude::*;

/// Keeps track of how much of a token is its max fee.
#[account]
pub struct MaxFeeDetails {
  /// The Wormhole-normalized address of the token mint.
  /// This should be the bridged address on Solana.
  pub token: [u8; 32], // 32 bytes

  /// The Wormhole-normalized (with 8 decimals) amount of the token.
  pub amount: u64, // 8 bytes
}

impl MaxFeeDetails {
  // discriminator (8) first
  pub const SPACE: usize = 8 + 32 + 8;

  /// AKA `b"max_withdrawal_fee`.
  #[constant]
  pub const SEED_PREFIX: &'static [u8] = b"max_withdrawal_fee";
}
