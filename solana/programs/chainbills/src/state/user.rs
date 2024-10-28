use anchor_lang::prelude::*;

#[account]
/// A user is an entity that can create payables and make payments.
pub struct User {
  /// The nth count of users on this chain at the point this user was
  /// initialized.
  pub chain_count: u64, // 8 bytes

  /// Total number of payables that this user has ever created.
  pub payables_count: u64, // 8 bytes

  /// Total number of payments that this user has ever made.
  pub payments_count: u64, // 8 bytes

  /// Total number of withdrawals that this user has ever made.
  pub withdrawals_count: u64, // 8 bytes

  /// Total number of activities that this user has ever made.
  pub activities_count: u64, // 8 bytes
}

impl User {
  // discriminator (8) included
  pub const SPACE: usize = 6 * 8;

  pub fn next_payable(&self) -> u64 {
    self.payables_count.checked_add(1).unwrap()
  }

  pub fn next_payment(&self) -> u64 {
    self.payments_count.checked_add(1).unwrap()
  }

  pub fn next_withdrawal(&self) -> u64 {
    self.withdrawals_count.checked_add(1).unwrap()
  }

  pub fn next_activity(&self) -> u64 {
    self.activities_count.checked_add(1).unwrap()
  }
}
