use crate::state::TokenAndAmount;
use anchor_lang::prelude::*;

#[account]
pub struct Payment {
  /// The nth count of global payments at the point this payment was made.
  pub global_count: u64, // 8 bytes

  /// The nth count of payments on the calling chain at the point this payment
  /// was made.
  pub chain_count: u64, // 8 bytes

  /// The address of the Payable to which this Payment was made.
  pub payable: Pubkey, // 32 bytes

  /// The address of the User account that made this Payment.
  pub payer: Pubkey, // 32 bytes

  /// The nth count of payments that the payer has made
  /// at the point of making this payment.
  pub payer_count: u64, // 8 bytes

  /// The nth count of payments that the payable has received
  /// at the point when this payment was made.
  pub payable_count: u64, // 8 bytes

  /// When this payment was made.
  pub timestamp: u64, // 8 bytes

  /// The amount and token that the payer paid
  pub details: TokenAndAmount, // TokenAndAmount::SPACE
}

impl Payment {
  // discriminator (8) included
  pub const SPACE: usize = (6 * 8) + (2 * 32) + TokenAndAmount::SPACE;

  /// AKA `b"payment"`.
  #[constant]
  pub const SEED_PREFIX: &'static [u8] = b"payment";
}
