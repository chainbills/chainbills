//! `CctpTokenBurnNonce` — per-domain CCTP burn nonce replay protection.
//! Seeds: `[b"cctp_bnonce", circle_domain: [u8;4], nonce_le: [u8;8]]`
//!
//! **Never closed.** Mirrors EVM's `consumedCctpBurnNonces` mapping.

use anchor_lang::prelude::*;

/// Marks a Circle CCTP burn nonce as consumed on CCTP-only payment receive
/// paths.
///
/// CCTP V2 uses a 32-byte nonce (bytes [12..44] of the message header).
/// The nonce is unique per source domain, preventing replay of the same burn
/// message.
///
/// Seeds: `[CctpTokenBurnNonce::SEED_PREFIX, circle_domain.to_le_bytes(),
/// &nonce]`
#[account]
pub struct CctpTokenBurnNonce {
  /// Circle's uint32 domain ID of the source chain.
  pub circle_domain: u32,

  /// The 32-byte CCTP V2 nonce from the source chain's burn message header
  /// (bytes 12-44).
  pub nonce: [u8; 32],

  /// Unix timestamp when this burn nonce was consumed.
  pub processed_at: i64,
}

impl CctpTokenBurnNonce {
  /// AKA b"cctp_token_burn_nonce"
  pub const SEED_PREFIX: &'static [u8] = b"cctp_token_burn_nonce";
  // 8  discriminator
  // 4  circle_domain
  // 32 nonce ([u8;32] — CCTP V2 uses 32-byte nonces)
  // 8  processed_at
  /// Computed account byte space based on all fields.
  pub const SPACE: usize = 8 + 4 + 32 + 8;
}
