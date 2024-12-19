use anchor_lang::prelude::*;

/// Details about a token on a foreign chain.
#[account]
pub struct TokenForeignChain {
  /// The token as it is in the foreign chain.
  pub foreign_token: [u8; 32], // 32 bytes

  /// The equivalent token's mint on this chain.
  pub token: Pubkey, // 32 bytes
}

impl TokenForeignChain {
  // discriminator (8) included
  pub const SPACE: usize = 8 + 32 + 32;

  /// AKA `b"token_foreign_chain`.
  #[constant]
  pub const SEED_PREFIX: &'static [u8] = b"token_foreign_chain";
}
