use anchor_lang::prelude::*;

#[account]
/// Holds data for every received message. Prevents replay attacks.
pub struct ConsumedWormholeMessage {
  /// Keccak256 hash of verified Wormhole message.
  pub vaa_hash: [u8; 32], // 32 bytes
}

impl ConsumedWormholeMessage {
  // discriminator first
  pub const SPACE: usize = 8 + 32;

  /// AKA `b"consumed_wormhole_message"`.
  pub const SEED_PREFIX: &'static [u8] = b"consumed_wormhole_message";
}

#[account]
/// Keeps track of the total counter of consumed messages per chain.
pub struct PerChainConsumedWormholeMessagesCounter {
  /// Total number of consumed messages.
  /// This is technically the latest Wormhole Sequence for a given chain.
  pub consumed_messages_count: u64, // 8 bytes
}

impl PerChainConsumedWormholeMessagesCounter {
  // discriminator first
  pub const SPACE: usize = 8 + 8;

  /// AKA `b"per_chain_consumed_wormhole_messages_counter"`.
  pub const SEED_PREFIX: &'static [u8] =
    b"per_chain_consumed_wormhole_messages_counter";

  pub fn next_consumed_messages_count(&self) -> u64 {
    self.consumed_messages_count.checked_add(1).unwrap()
  }
}
