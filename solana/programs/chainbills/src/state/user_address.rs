use anchor_lang::prelude::*;

#[account]
/// Holds the wallet address of the nth user on the chain.
pub struct UserAddress {
  /// The wallet address of the nth user on this chain at the point this user
  /// was initialized.
  pub address: Pubkey, // 32 bytes
}

impl UserAddress {
  // discriminator (8) included
  pub const SPACE: usize = 8 + 8;

  /// AKA `b"user_address`.
  #[constant]
  pub const SEED_PREFIX: &'static [u8] = b"user_address";
}
