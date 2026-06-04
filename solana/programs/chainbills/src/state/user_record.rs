//! `UserRecord` — per-wallet user state and activity counters.
//! Seeds: `[b"user", wallet: Pubkey]`

use anchor_lang::prelude::*;

use crate::errors::ChainbillsError;

/// Tracks a user's activity counts and creation timestamp.
/// Created with `init_if_needed` on first action by a wallet.
///
/// Seeds: `[UserRecord::SEED_PREFIX, wallet.key()]`
#[account]
pub struct UserRecord {
  /// The wallet this record belongs to.
  pub wallet: Pubkey,

  /// Number of payables this user has created. Used as the index seed
  /// for new Payable PDAs: seeds = [b"payable", wallet,
  /// payables_count.to_le_bytes()].
  pub payables_count: u64,

  /// Number of payments this user has made. Used as the index seed
  /// for new UserPayment PDAs.
  pub payments_count: u64,

  /// Number of withdrawals this user has performed.
  pub withdrawals_count: u64,

  /// Number of activity records linked to this user.
  pub activities_count: u64,

  /// Unix timestamp when this UserRecord was first created.
  pub created_at: i64,
}

impl UserRecord {
  /// AKA b"user"
  pub const SEED_PREFIX: &'static [u8] = b"user";
  // 8  discriminator
  // 32 wallet
  // 8  payables_count
  // 8  payments_count
  // 8  withdrawals_count
  // 8  activities_count
  // 8  created_at
  /// Computed account byte space based on all fields.
  pub const SPACE: usize = 8 + 32 + 8 + 8 + 8 + 8 + 8;

  /// Increment payables_count by 1. Returns Err on overflow.
  pub fn increment_payables(&mut self) -> Result<()> {
    self.payables_count = self
      .payables_count
      .checked_add(1)
      .ok_or(ChainbillsError::MathOverflow)?;
    Ok(())
  }

  /// Increment payments_count by 1. Returns Err on overflow.
  pub fn increment_payments(&mut self) -> Result<()> {
    self.payments_count = self
      .payments_count
      .checked_add(1)
      .ok_or(ChainbillsError::MathOverflow)?;
    Ok(())
  }

  /// Increment withdrawals_count by 1. Returns Err on overflow.
  pub fn increment_withdrawals(&mut self) -> Result<()> {
    self.withdrawals_count = self
      .withdrawals_count
      .checked_add(1)
      .ok_or(ChainbillsError::MathOverflow)?;
    Ok(())
  }

  /// Increment activities_count by 1. Returns Err on overflow.
  pub fn increment_activities(&mut self) -> Result<()> {
    self.activities_count = self
      .activities_count
      .checked_add(1)
      .ok_or(ChainbillsError::MathOverflow)?;
    Ok(())
  }
}
