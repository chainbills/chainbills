use anchor_lang::prelude::*;

#[account]
#[derive(Default)]
/// Foreign Contract Account Data.
pub struct RegisteredForeignContract {
  /// Wormhole Chain ID of the Foreign Contract
  pub chain_id: u16, // 2 bytes

  /// Contract's address. Cannot be zero address.
  pub emitter_address: [u8; 32], // 32 bytes
}

impl RegisteredForeignContract {
  // discriminator first
  pub const SPACE: usize = 8 + 2 + 32;

  /// AKA `b"registered_foreign_contract"`.
  pub const SEED_PREFIX: &'static [u8] = b"registered_foreign_contract";
}
