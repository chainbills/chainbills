//! `ConsumedVaa` — replay protection for processed Wormhole VAAs.
//! Seeds: `[b"consumed_vaa", vaa_hash: [u8;32]]`
//!
//! **Never closed.** This mirrors EVM's `consumedWormholeMessages` mapping.
//! `init` (not `init_if_needed`) is used so that a duplicate init = replay
//! fails loudly.

use anchor_lang::prelude::*;

/// Marks a Wormhole VAA as consumed. Created atomically with the state changes
/// it triggers. If the account already exists, `init` fails → replay rejected.
///
/// This is the primary replay protection layer for all inbound Wormhole
/// messages. A secondary layer is the Core Bridge's own PostedVAA account, but
/// we create this PDA to store our own metadata and to survive Core Bridge
/// account closure.
///
/// Seeds: `[ConsumedVaa::SEED_PREFIX, vaa_hash]`
/// where `vaa_hash` = the keccak256 hash of the VAA body (matches Core Bridge
/// convention).
#[account]
pub struct ConsumedVaa {
  /// The 32-byte keccak256 hash of the VAA body. Used as PDA seed.
  pub vaa_hash: [u8; 32],

  /// The Wormhole chain ID of the VAA's emitter.
  pub emitter_chain: u16,

  /// The VAA's sequence number (from the emitter's emitter_sequence).
  pub sequence: u64,

  /// The payload type byte (0x01 = PayablePayload, 0x02 = PaymentPayload).
  pub payload_type: u8,

  /// Unix timestamp when this VAA was processed by Chainbills.
  pub processed_at: i64,
}

impl ConsumedVaa {
  /// AKA b"consumed_vaa"
  pub const SEED_PREFIX: &'static [u8] = b"consumed_vaa";
  // 8  discriminator
  // 32 vaa_hash
  // 2  emitter_chain
  // 8  sequence
  // 1  payload_type
  // 8  processed_at
  /// Computed account byte space based on all fields.
  pub const SPACE: usize = 8 + 32 + 2 + 8 + 1 + 8;
}
