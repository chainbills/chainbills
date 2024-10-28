use crate::state::TokenAndAmount;
use anchor_lang::prelude::*;

#[account]
/// Receipt of a payment from any blockchain network (this-chain inclusive)
/// made to a Payable in this chain.
pub struct PayablePayment {
  /// The ID of the Payable to which this Payment was made.
  pub payable_id: Pubkey, // 32 bytes

  /// The Wormhole-normalized wallet address that made this Payment.
  /// If the payer is on Solana, then will be the bytes of their wallet address.
  pub payer: [u8; 32], // 32 bytes

  /// The Wormhole Chain ID of the chain from which the payment was made.
  pub payer_chain_id: u16, // 2 bytes

  /// The nth count of payments to this payable from the payment source
  /// chain at the point this payment was recorded.
  pub local_chain_count: u64, // 8 bytes

  /// The nth count of payments that the payable has received
  /// at the point when this payment was made.
  pub payable_count: u64, // 8 bytes

  /// When this payment was made.
  pub timestamp: u64, // 8 bytes

  /// The amount and token that the payer paid
  pub details: TokenAndAmount, // TokenAndAmount::SPACE
}

impl PayablePayment {
  // discriminator (8) included
  pub const SPACE: usize = 2 + (4 * 8) + (2 * 32) + TokenAndAmount::SPACE;

  /// AKA `b"payment"`.
  #[constant]
  pub const SEED_PREFIX: &'static [u8] = b"payable_payment";
}
