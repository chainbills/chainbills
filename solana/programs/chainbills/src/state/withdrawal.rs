//! `Withdrawal` — immutable record of a host withdrawal.
//! Seeds: `[b"wdl", payable: Pubkey, withdrawal_count_le: [u8;8]]`

use anchor_lang::prelude::*;

/// Immutable record of a withdrawal by a payable host.
///
/// Seeds: `[Withdrawal::SEED_PREFIX, payable.key(),
/// payable.withdrawals_count.to_le_bytes()]` where `withdrawals_count` is the
/// value BEFORE incrementing (0-based index).
#[account]
pub struct Withdrawal {
  /// The payable that was withdrawn from.
  pub payable: Pubkey,

  /// The host wallet that performed the withdrawal.
  pub host: Pubkey,

  /// The token mint withdrawn. `system_program::ID` for native SOL.
  pub token_mint: Pubkey,

  /// Gross withdrawal amount (before fee deduction).
  pub amount: u64,

  /// Fee deducted (min of percentage-based and max_fee cap).
  pub fees: u64,

  /// Net amount actually received by the host (amount - fees).
  pub net_amount: u64,

  /// This withdrawal's index within the payable's withdrawal history
  /// (0-based).
  pub withdrawal_count: u64,

  /// Snapshot of `global_config.total_withdrawals` at time of withdrawal.
  pub chain_count: u64,

  /// Unix timestamp of the withdrawal.
  pub created_at: i64,
}

impl Withdrawal {
  /// AKA b"withdrawal"
  pub const SEED_PREFIX: &'static [u8] = b"withdrawal";
  // 8  discriminator
  // 32 payable
  // 32 host
  // 32 token_mint
  // 8  amount
  // 8  fees
  // 8  net_amount
  // 8  withdrawal_count
  // 8  chain_count
  // 8  created_at
  /// Computed account byte space based on all fields.
  pub const SPACE: usize = 8 + 32 + 32 + 32 + 8 + 8 + 8 + 8 + 8 + 8;
}
