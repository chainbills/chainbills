use anchor_lang::prelude::*;

/// A combination of a token address and its amount from another chain.
#[derive(AnchorDeserialize, AnchorSerialize, Clone, Copy, Debug)]
pub struct TokenAndAmountForeign {
  /// The address of the associated token.
  pub token: [u8; 32], // 32 bytes

  /// The amount of the token.
  pub amount: u64, // 8 bytes
}

impl TokenAndAmountForeign {
  pub const SPACE: usize = 32 + 8;
}
