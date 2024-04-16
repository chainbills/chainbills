use anchor_lang::prelude::*;

#[account]
#[derive(Default)]
/// Config account data. Mainly Wormhole-related addresses and infos.
pub struct Config {
  /// Program's owner.
  pub owner: Pubkey, // 32 bytes
  /// Wormhole's [BridgeData](wormhole_anchor_sdk::wormhole::BridgeData)
  /// address. Needed by the Wormhole program to post messages.
  pub wormhole_bridge: Pubkey, // 32 bytes
  /// [TokenBridge's Config](wormhole_anchor_sdk::token_bridge::Config)
  /// address. Needed by the TokenBridge to post messages to Wormhole.
  pub token_bridge_config: Pubkey, // 32 bytes
  /// Used by Wormhole and TokenBridge to send messages
  pub emitter: Pubkey, // 32 bytes
  /// Wormhole's [FeeCollector](wormhole_anchor_sdk::wormhole::FeeCollector)
  /// address.
  pub fee_collector: Pubkey, // 32 bytes
  /// The [SequenceTracker](wormhole_anchor_sdk::wormhole::SequenceTracker)
  /// address for Wormhole messages. It tracks the number of messages posted
  /// by this program.
  pub sequence: Pubkey, // 32 bytes
  /// Doesn't hold data. Is SPL mint authority (signer) for Token Bridge
  /// wrapped assets.
  pub mint_authority: Pubkey, // 32 bytes
  /// Doesn't hold data. Signs custody (holding-balances) Token Bridge
  /// SPL transfers.
  pub custody_signer: Pubkey, // 32 bytes
  /// Doesn't hold data. Signs outbound TokenBridge SPL transfers.
  pub authority_signer: Pubkey, // 32 bytes
  /// AKA nonce. Just zero, but saving this information in this account.
  pub batch_id: u32, // 4 bytes
  /// AKA consistency level. u8 representation of Solana's
  /// [Finality](wormhole_anchor_sdk::wormhole::Finality).
  pub finality: u8, // 1 bytes
}

impl Config {
  // discriminator first
  pub const SPACE: usize = 8 + (9 * 32) + 4 + 1;
  /// AKA `b"config"`.
  pub const SEED_PREFIX: &'static [u8] = b"config";
}
