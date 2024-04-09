use anchor_lang::prelude::*;

/// A combination of a Wormhole-normalized token address and its
/// Wormhole-normalized associated amount.
///
/// This combination is used to constrain how much of a token
/// a payable can accept. It is also used to record the details
/// of a payment or a withdrawal.
#[derive(AnchorDeserialize, AnchorSerialize, Clone, Copy)]
pub struct TokenAndAmount {
  /// The Wormhole-normalized address of the associated token mint.
  /// This should be the bridged address on Solana.
  pub token: [u8; 32],

  /// The Wormhole-normalized (with 8 decimals) amount of the token.
  pub amount: u64,
}

impl TokenAndAmount {
  pub const SPACE: usize = 32 + 8;
}
