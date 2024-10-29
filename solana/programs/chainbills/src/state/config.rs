use anchor_lang::prelude::*;

#[account(zero_copy)]
/// Config account data. Mainly Wormhole-related addresses and infos.
pub struct Config {
  /// Wormhole-Chain ID for this chain.
  pub chain_id: u16, // 2 bytes

  /// The withdrawal fee percentage. Takes into account 2 decimal places. 
  /// For example, 200 means 2.00%. 
  pub withdrawal_fee_percentage: u16, // 2 bytes
  
  /// Deployer of this program.
  pub owner: Pubkey, // 32 bytes
  
  /// Chainbills' [FeeCollector](FeeCollector) address.
  pub chainbills_fee_collector: Pubkey, // 32 bytes
  
  /// Wormhole's [BridgeData](wormhole_anchor_sdk::wormhole::BridgeData)
  /// address. Needed by the Wormhole program to post messages.
  pub wormhole_bridge: Pubkey, // 32 bytes

  /// Used by Wormhole to send messages
  pub wormhole_emitter: Pubkey, // 32 bytes

  /// Wormhole's [FeeCollector](wormhole_anchor_sdk::wormhole::FeeCollector)
  /// address.
  pub wormhole_fee_collector: Pubkey, // 32 bytes

  /// The [SequenceTracker](wormhole_anchor_sdk::wormhole::SequenceTracker)
  /// address for Wormhole messages. It tracks the number of messages posted
  /// by this program.
  pub wormhole_sequence: Pubkey, // 32 bytes
}

impl Config {
  // discriminator (8) included
  pub const SPACE: usize = 2 + 2 + 8 + (6 * 32);

  /// AKA `b"config"`.
  pub const SEED_PREFIX: &'static [u8] = b"config";
}
