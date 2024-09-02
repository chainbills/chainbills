use anchor_lang::prelude::*;

#[account]
#[derive(Default)]
/// Holds data for every received message. Prevents replay attacks.
pub struct WormholeReceived {
  /// AKA nonce. Should always be zero.
  pub batch_id: u32, // 32 bytes
  /// Keccak256 hash of verified Wormhole message.
  pub vaa_hash: [u8; 32], // 32 bytes
}

impl WormholeReceived {
  // discriminator first
  pub const SPACE: usize = 8 + 32 + 32;

  /// AKA `b"wormhole_received"`.
  pub const SEED_PREFIX: &'static [u8] = b"wormhole_received";
}
