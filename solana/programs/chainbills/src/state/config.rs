//! `Config` — program admin configuration PDA.
//! Seeds: `[b"config"]`. One per deployment.
//!
//! Holds owner, fee settings, cbChainId, nonce counter, and protocol flags.
//! Separated from stats counters so admin reads are cheap (small account).

use anchor_lang::prelude::*;

use crate::errors::ChainbillsError;

/// Program-wide admin configuration. Created once by `initialize`. Never
/// closed.
///
/// Mirrors the admin/config portion of EVM storage (owner, feeBps,
/// feeCollector, etc.). Counters live in `Stats` (`[b"stats"]`) to keep this
/// account small and fast.
///
/// Seeds: `[Config::SEED_PREFIX]`
#[account]
pub struct Config {
  /// The program owner. Can call admin instructions (allow_token,
  /// register_chain, etc.).
  pub owner: Pubkey,

  /// The fee collector wallet. Receives the fee portion on every withdrawal.
  pub fee_collector: Pubkey,

  /// Withdrawal fee in basis points (200 = 2%). Max 10_000 (100%).
  pub fee_bps: u16,

  /// The cbChainId of this Solana deployment (mainnet or devnet).
  /// Set at initialization. Used in cross-chain payload construction.
  pub cb_chain_id: [u8; 32],

  /// Monotonically increasing counter for payable update broadcast nonces.
  /// Each broadcast increments this. Ordering cross-chain payable sync
  /// messages.
  pub payable_update_nonce_counter: u64,

  /// Whether this Solana deployment supports Wormhole for outbound messages.
  /// Mirrors EVM `hasWormhole()`. Gates Wormhole shim CPI in broadcast +
  /// outbound payment.
  pub has_wormhole: bool,

  /// Whether this Solana deployment supports CCTP for outbound messages.
  /// Mirrors EVM `hasCctp()`. Gates CCTP `send_message` / `deposit_for_burn`
  /// CPIs.
  pub has_cctp: bool,
}

impl Config {
  /// AKA b"config"
  pub const SEED_PREFIX: &'static [u8] = b"config";
  // 8  discriminator
  // 32 owner
  // 32 fee_collector
  // 2  fee_bps
  // 32 cb_chain_id
  // 8  payable_update_nonce_counter
  // 1  has_wormhole
  // 1  has_cctp
  /// Computed account byte space.
  pub const SPACE: usize = 8 + 32 + 32 + 2 + 32 + 8 + 1 + 1;

  // = 116

  /// Take the next payable update nonce and increment the counter.
  pub fn next_payable_update_nonce(&mut self) -> Result<u64> {
    let nonce = self.payable_update_nonce_counter;
    self.payable_update_nonce_counter = self
      .payable_update_nonce_counter
      .checked_add(1)
      .ok_or(ChainbillsError::MathOverflow)?;
    Ok(nonce)
  }
}
