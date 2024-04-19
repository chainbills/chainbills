use anchor_lang::prelude::*;

#[account]
/// Keeps track of all activity accounts across Chainbills.
pub struct GlobalStats {
  /// Total number of users that have ever been initialized.
  pub users_count: u64, // 8 bytes

  /// Total number of payables that have ever been created.
  pub payables_count: u64, // 8 bytes

  /// Total number of payments that have ever been made.
  pub payments_count: u64, // 8 bytes

  /// Total number of withdrawals that have ever been made.
  pub withdrawals_count: u64, // 8 bytes
}

impl GlobalStats {
  // discriminator (8) included
  pub const SPACE: usize = 5 * 8;

  /// AKA `b"global"`.
  #[constant]
  pub const SEED_PREFIX: &'static [u8] = b"global";

  pub fn initialize(&mut self) {
    self.users_count = 0;
    self.payables_count = 0;
    self.payments_count = 0;
    self.withdrawals_count = 0;
  }

  pub fn next_user(&self) -> u64 {
    self.users_count.checked_add(1).unwrap()
  }

  pub fn next_payable(&self) -> u64 {
    self.payables_count.checked_add(1).unwrap()
  }

  pub fn next_payment(&self) -> u64 {
    self.payments_count.checked_add(1).unwrap()
  }

  pub fn next_withdrawal(&self) -> u64 {
    self.withdrawals_count.checked_add(1).unwrap()
  }
}
