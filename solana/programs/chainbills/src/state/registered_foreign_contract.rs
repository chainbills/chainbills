use anchor_lang::prelude::*;

#[account]
#[derive(Default)]
/// Foreign Contract Account Data.
pub struct RegisteredForeignContract {
  /// Contract's address. Cannot be zero address.
  pub address: [u8; 32], // 32 bytes
}

impl RegisteredForeignContract {
  // discriminator first
  pub const SPACE: usize = 8 + 32;

  /// AKA `b"registered_foreign_contract"`.
  pub const SEED_PREFIX: &'static [u8] = b"registered_foreign_contract";
}
