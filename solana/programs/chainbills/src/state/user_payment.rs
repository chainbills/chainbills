use crate::state::TokenAndAmount;
use anchor_lang::prelude::*;

#[account]
/// A user's receipt of a payment made in this chain to a Payable on any
/// blockchain network (this-chain inclusive).
pub struct UserPayment {
  /// The ID of the Payable to which this Payment was made.
  /// If the payable was created in Solana, then this will be the bytes that
  /// payable's Pubkey. Otherwise, it will be a valid 32-byte hash ID
  /// from another chain.
  pub payable_id: [u8; 32], // 32 bytes

  /// The wallet address that made this Payment.
  pub payer: Pubkey, // 32 bytes

  /// The Wormhole Chain ID of the chain into which the payment was made.
  pub payable_chain_id: u16, // 2 bytes

  /// The nth count of payments on this chain at the point this payment
  /// was made.
  pub chain_count: u64, // 8 bytes

  /// The nth count of payments that the payer has made
  /// at the point of making this payment.
  pub payer_count: u64, // 8 bytes

  /// When this payment was made.
  pub timestamp: u64, // 8 bytes

  /// The amount and token that the payer paid
  pub details: TokenAndAmount, // TokenAndAmount::SPACE
}

impl UserPayment {
  // discriminator (8) included
  pub const SPACE: usize = 2 + (4 * 8) + (2 * 32) + TokenAndAmount::SPACE;

  /// AKA `b"user_payment"`.
  pub const SEED_PREFIX: &'static [u8] = b"user_payment";
}
