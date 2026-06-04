//! `CctpDataNonce` — per-domain CCTP data-message nonce replay protection.
//! Seeds: `[b"cctp_dnonce", circle_domain: [u8;4], nonce: [u8;32]]`
//!
//! Used when a Circle CCTP data message (type `sendMessage`, no token burn)
//! carries a PayablePayload for cross-chain payable state sync. Mirrors EVM's
//! `consumedCctpDataNonces` mapping.
//!
//! **Never closed.** `init` (not `init_if_needed`) enforces replay rejection.

use anchor_lang::prelude::*;

/// Marks a Circle CCTP data-message nonce as consumed.
///
/// Created atomically with the state changes triggered by the data message.
/// A duplicate `init` fails → replay rejected.
///
/// Seeds: `[CctpDataNonce::SEED_PREFIX, circle_domain.to_le_bytes(), &nonce]`
#[account]
pub struct CctpDataNonce {
  /// Circle's uint32 domain ID of the source chain.
  pub circle_domain: u32,

  /// The 32-byte CCTP V2 nonce from the data message header (bytes 12-44).
  pub nonce: [u8; 32],

  /// Unix timestamp when this data nonce was consumed.
  pub processed_at: i64,
}

impl CctpDataNonce {
  /// AKA b"cctp_data_nonce"
  pub const SEED_PREFIX: &'static [u8] = b"cctp_data_nonce";
  // 8  discriminator
  // 4  circle_domain
  // 32 nonce ([u8;32] — CCTP V2 uses 32-byte nonces)
  // 8  processed_at
  /// Computed account byte space based on all fields.
  pub const SPACE: usize = 8 + 4 + 32 + 8;
}
