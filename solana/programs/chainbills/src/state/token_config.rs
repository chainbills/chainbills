//! `TokenConfig` — per-token configuration and lifetime statistics.
//! Seeds: `[b"token_cfg", mint: Pubkey]`

use anchor_lang::prelude::*;

/// Configuration and cumulative stats for a token mint.
/// Created by `allow_token`, updated by payments and withdrawals.
///
/// Seeds: `[TokenConfig::SEED_PREFIX, mint.key()]`
#[account]
pub struct TokenConfig {
  /// The token mint this config applies to. `system_program::ID` for native
  /// SOL.
  pub mint: Pubkey,

  /// Whether this token is currently accepted for payments.
  /// Set to true by `allow_token`, false by `disallow_token`.
  pub is_allowed: bool,

  /// Maximum fee cap in token base units.
  /// Fee = min(amount * fee_bps / 10_000, max_withdrawal_fee).
  /// Set by `allow_token`. Prevents runaway fees on high-value tokens.
  pub max_withdrawal_fee: u64,

  /// Cumulative amount of this token paid into all payables on this chain.
  pub total_paid: u64,

  /// Cumulative amount of this token received (inbound cross-chain).
  pub total_received: u64,

  /// Cumulative amount of this token withdrawn by hosts.
  pub total_withdrawn: u64,

  /// Cumulative fees collected in this token.
  pub total_fees_collected: u64,
}

impl TokenConfig {
  /// AKA b"token_config"
  pub const SEED_PREFIX: &'static [u8] = b"token_config";
  // 8  discriminator
  // 32 mint
  // 1  is_allowed
  // 8  max_withdrawal_fee
  // 8  total_paid
  // 8  total_received
  // 8  total_withdrawn
  // 8  total_fees_collected
  /// Computed account byte space based on all fields.
  pub const SPACE: usize = 8 + 32 + 1 + 8 + 8 + 8 + 8 + 8;
}
