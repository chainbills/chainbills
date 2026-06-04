//! `Stats` — program-wide chain statistics PDA.
//! Seeds: `[b"stats"]`. One per deployment.
//!
//! Holds all 13 counters: 7 ChainStats + 2 WormholeStats + 4 CctpStats.
//! Separated from `Config` so writes to counters don't contend with reads of
//! config.

use anchor_lang::prelude::*;

use crate::errors::ChainbillsError;

/// Chain-wide activity counters. Created once by `initialize`. Never closed.
///
/// Mirrors EVM's combined `ChainStats`, `WormholeStats`, and `CctpStats`
/// storage variables. Solana has no slot-layout upgrade concern (we use
/// `realloc`), so all stats fit one PDA.
///
/// Seeds: `[Stats::SEED_PREFIX]`
#[account]
pub struct Stats {
  // ── ChainStats (mirrors EVM chainStats) ───────────────────────────────────
  /// Cumulative count of unique users ever initialized on this chain.
  pub total_users: u64,

  /// Cumulative count of payables ever created on this chain.
  pub total_payables: u64,

  /// Cumulative count of foreign payable records ever created on this chain.
  pub total_foreign_payables: u64,

  /// Cumulative count of user-side payment records ever created on this chain.
  pub total_user_payments: u64,

  /// Cumulative count of payable-side payment records ever created on this
  /// chain.
  pub total_payable_payments: u64,

  /// Cumulative count of withdrawals ever performed on this chain.
  pub total_withdrawals: u64,

  /// Cumulative count of activity records ever created on this chain.
  pub total_activities: u64,

  // ── WormholeStats (mirrors EVM WormholeStats) ─────────────────────────────
  /// Total Wormhole messages published (payable updates + outbound payments).
  pub published_wormhole_messages: u64,

  /// Total Wormhole VAAs consumed (payable updates + inbound payments).
  pub consumed_wormhole_messages: u64,

  // ── CctpStats (mirrors EVM CctpStats) ────────────────────────────────────
  /// Total CCTP payment messages emitted via `pay_foreign_via_cctp`.
  pub emitted_cctp_payment_messages: u64,

  /// Total CCTP payable-update `sendMessage` calls emitted via
  /// `broadcast_payable_update`.
  pub emitted_cctp_update_messages: u64,

  /// Total CCTP payment messages received (burn + data message pairs).
  pub received_cctp_payment_messages: u64,

  /// Total CCTP payable-update data messages received.
  pub received_cctp_update_messages: u64,

  // ── Cross-chain registry counters ─────────────────────────────────────
  /// Count of registered foreign chains with has_cctp = true.
  /// Incremented by register_chain (if has_cctp). Adjusted by update_chain
  /// when has_cctp toggles. Used by broadcast_payable_update to validate
  /// that all CCTP chains are covered in remaining_accounts.
  pub registered_cctp_chain_count: u32,
}

impl Stats {
  /// AKA b"stats"
  pub const SEED_PREFIX: &'static [u8] = b"stats";
  // 8   discriminator
  // 13 × 8 = 104  (u64 counters)
  // 4           (registered_cctp_chain_count u32)
  /// Computed account byte space.
  pub const SPACE: usize = 8 + 13 * 8 + 4;

  // = 116

  // ── ChainStats increment helpers ─────────────────────────────────────────

  /// Increment total_users by 1.
  pub fn increment_total_users(&mut self) -> Result<()> {
    self.total_users = self
      .total_users
      .checked_add(1)
      .ok_or(ChainbillsError::MathOverflow)?;
    Ok(())
  }

  /// Increment total_payables by 1.
  pub fn increment_total_payables(&mut self) -> Result<()> {
    self.total_payables = self
      .total_payables
      .checked_add(1)
      .ok_or(ChainbillsError::MathOverflow)?;
    Ok(())
  }

  /// Increment total_foreign_payables by 1.
  pub fn increment_total_foreign_payables(&mut self) -> Result<()> {
    self.total_foreign_payables = self
      .total_foreign_payables
      .checked_add(1)
      .ok_or(ChainbillsError::MathOverflow)?;
    Ok(())
  }

  /// Increment total_user_payments by 1.
  pub fn increment_total_user_payments(&mut self) -> Result<()> {
    self.total_user_payments = self
      .total_user_payments
      .checked_add(1)
      .ok_or(ChainbillsError::MathOverflow)?;
    Ok(())
  }

  /// Increment total_payable_payments by 1.
  pub fn increment_total_payable_payments(&mut self) -> Result<()> {
    self.total_payable_payments = self
      .total_payable_payments
      .checked_add(1)
      .ok_or(ChainbillsError::MathOverflow)?;
    Ok(())
  }

  /// Increment total_withdrawals by 1.
  pub fn increment_total_withdrawals(&mut self) -> Result<()> {
    self.total_withdrawals = self
      .total_withdrawals
      .checked_add(1)
      .ok_or(ChainbillsError::MathOverflow)?;
    Ok(())
  }

  /// Increment total_activities by 1.
  pub fn increment_total_activities(&mut self) -> Result<()> {
    self.total_activities = self
      .total_activities
      .checked_add(1)
      .ok_or(ChainbillsError::MathOverflow)?;
    Ok(())
  }

  // ── WormholeStats increment helpers ──────────────────────────────────────

  /// Increment published_wormhole_messages by 1.
  pub fn increment_published_wormhole_messages(&mut self) -> Result<()> {
    self.published_wormhole_messages = self
      .published_wormhole_messages
      .checked_add(1)
      .ok_or(ChainbillsError::MathOverflow)?;
    Ok(())
  }

  /// Increment consumed_wormhole_messages by 1.
  pub fn increment_consumed_wormhole_messages(&mut self) -> Result<()> {
    self.consumed_wormhole_messages = self
      .consumed_wormhole_messages
      .checked_add(1)
      .ok_or(ChainbillsError::MathOverflow)?;
    Ok(())
  }

  // ── CctpStats increment helpers ───────────────────────────────────────────

  /// Increment emitted_cctp_payment_messages by 1.
  pub fn increment_emitted_cctp_payment_messages(&mut self) -> Result<()> {
    self.emitted_cctp_payment_messages = self
      .emitted_cctp_payment_messages
      .checked_add(1)
      .ok_or(ChainbillsError::MathOverflow)?;
    Ok(())
  }

  /// Increment emitted_cctp_update_messages by 1.
  pub fn increment_emitted_cctp_update_messages(&mut self) -> Result<()> {
    self.emitted_cctp_update_messages = self
      .emitted_cctp_update_messages
      .checked_add(1)
      .ok_or(ChainbillsError::MathOverflow)?;
    Ok(())
  }

  /// Increment received_cctp_payment_messages by 1.
  pub fn increment_received_cctp_payment_messages(&mut self) -> Result<()> {
    self.received_cctp_payment_messages = self
      .received_cctp_payment_messages
      .checked_add(1)
      .ok_or(ChainbillsError::MathOverflow)?;
    Ok(())
  }

  /// Increment received_cctp_update_messages by 1.
  pub fn increment_received_cctp_update_messages(&mut self) -> Result<()> {
    self.received_cctp_update_messages = self
      .received_cctp_update_messages
      .checked_add(1)
      .ok_or(ChainbillsError::MathOverflow)?;
    Ok(())
  }

  // ── Cross-chain registry counter helpers ──────────────────────────────

  /// Increment registered_cctp_chain_count by 1 (called from register_chain
  /// when has_cctp = true, and from update_chain when toggling has_cctp on).
  pub fn increment_registered_cctp_chain_count(&mut self) -> Result<()> {
    self.registered_cctp_chain_count = self
      .registered_cctp_chain_count
      .checked_add(1)
      .ok_or(ChainbillsError::MathOverflow)?;
    Ok(())
  }

  /// Decrement registered_cctp_chain_count by 1 (called from update_chain
  /// when toggling has_cctp off).
  pub fn decrement_registered_cctp_chain_count(&mut self) -> Result<()> {
    self.registered_cctp_chain_count = self
      .registered_cctp_chain_count
      .checked_sub(1)
      .ok_or(ChainbillsError::MathUnderflow)?;
    Ok(())
  }
}
