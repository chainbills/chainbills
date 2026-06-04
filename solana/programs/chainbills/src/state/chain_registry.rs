//! `ChainRegistry` — one PDA per registered foreign chain.
//! Seeds: `[b"chain_reg", cb_chain_id: [u8;32]]`

use anchor_lang::prelude::*;

/// Describes a foreign chain that Chainbills is deployed on.
/// Created by the owner via `register_chain`. Used for:
/// - Routing payable sync broadcasts (Wormhole vs CCTP path)
/// - Validating inbound VAA emitter addresses and CCTP source domains
/// - Cross-chain payment routing in `pay_foreign_via_cctp`
///
/// Seeds: `[ChainRegistry::SEED_PREFIX, cb_chain_id]`
#[account]
pub struct ChainRegistry {
  /// The universal chain key: keccak256("namespace:reference") (CAIP-2).
  /// e.g., keccak256("eip155:11155111") for Ethereum Sepolia.
  pub cb_chain_id: [u8; 32],

  /// Whether this chain uses Wormhole for cross-chain messaging.
  pub has_wormhole: bool,

  /// Wormhole's uint16 chain ID for this chain. Only valid if `has_wormhole =
  /// true`. Used for VAA emitter_chain validation.
  pub wormhole_chain_id: u16,

  /// Whether this chain uses Circle CCTP for token bridging.
  pub has_cctp: bool,

  /// Circle's uint32 domain for this chain. Only valid if `has_cctp = true`.
  /// Used in CCTP burn/receive message routing.
  pub circle_domain: u32,

  /// The 32-byte normalized address of the Chainbills contract on this chain.
  /// For EVM: left-padded 20-byte address. For Solana: program PDA bytes.
  /// Validated against VAA emitter_address and CCTP message sender fields.
  pub registered_contract: [u8; 32],
}

impl ChainRegistry {
  /// AKA b"chain_registry"
  pub const SEED_PREFIX: &'static [u8] = b"chain_registry";
  // 8  discriminator
  // 32 cb_chain_id
  // 1  has_wormhole
  // 2  wormhole_chain_id
  // 1  has_cctp
  // 4  circle_domain
  // 32 registered_contract
  /// Computed account byte space based on all fields.
  pub const SPACE: usize = 8 + 32 + 1 + 2 + 1 + 4 + 32;
}
