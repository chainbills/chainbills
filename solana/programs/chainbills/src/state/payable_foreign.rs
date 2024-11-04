use crate::state::TokenAndAmountForeign;
use anchor_lang::prelude::*;

#[account]
/// A Payable that exists on another chain.
pub struct PayableForeign {
  pub chain_id: u16, // 2 bytes

  /// Whether this payable is currently accepting payments.
  pub is_closed: bool, // 1 byte

  /// The allowed tokens (and their amounts) on this payable.
  /* TokenAndAmount::SPACE * len() */
  pub allowed_tokens_and_amounts: Vec<TokenAndAmountForeign>,
}

impl PayableForeign {
  pub fn space(ataa_len: usize) -> usize {
    // discriminator (8) included
    8 + 2 + 1 + (ataa_len * TokenAndAmountForeign::SPACE)
  }
}
