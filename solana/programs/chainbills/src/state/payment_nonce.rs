//! `PaymentNonce` — per-payer cross-chain payment replay protection.
//! Seeds: `[b"pnonce", payer_chain_id: [u8;32], payer: [u8;32], nonce_le:
//! [u8;8]]`
//!
//! **Never closed.** Mirrors EVM's `consumedPaymentNonces` mapping.

use anchor_lang::prelude::*;

/// Marks a cross-chain payment nonce as consumed.
///
/// Each EVM→Solana payment carries a payer-specific nonce in the
/// PaymentPayload. `init`-ing this PDA is the second layer of replay protection
/// (first is ConsumedVaa).
///
/// Seeds: `[PaymentNonce::SEED_PREFIX, payer_chain_id, payer,
/// nonce.to_le_bytes()]`
#[account]
pub struct PaymentNonce {
  /// cbChainId of the payer's chain.
  pub payer_chain_id: [u8; 32],

  /// Wormhole-normalized payer address (32 bytes).
  pub payer: [u8; 32],

  /// The nonce value from the PaymentPayload.
  pub nonce: u64,

  /// Unix timestamp when this nonce was consumed.
  pub processed_at: i64,
}

impl PaymentNonce {
  /// AKA b"payment_nonce"
  pub const SEED_PREFIX: &'static [u8] = b"payment_nonce";
  // 8  discriminator
  // 32 payer_chain_id
  // 32 payer
  // 8  nonce
  // 8  processed_at
  /// Computed account byte space based on all fields.
  pub const SPACE: usize = 8 + 32 + 32 + 8 + 8;
}
