use anchor_lang::prelude::*;

#[account]
/// Keeps track of all activities on this chain.
pub struct ChainStats {
  /// Total number of users that have ever been initialized on this chain.
  pub users_count: u64, // 8 bytes

  /// Total number of payables that have ever been created on this chain.
  pub payables_count: u64, // 8 bytes

  /// Total number of foreign payables recorded on this chain.
  pub foreign_payables_count: u64, // 8 bytes

  /// Total number of payments that users have ever been made on this chain.
  pub user_payments_count: u64, // 8 bytes

  /// Total number of payments that payables have ever received on this chain.
  pub payable_payments_count: u64, // 8 bytes

  /// Total number of withdrawals that have ever been made on this chain.
  pub withdrawals_count: u64, // 8 bytes

  /// Total number of activities that have ever been made on this chain.
  pub activities_count: u64, // 8 bytes

  /// Total number of published Wormhole messages on this chain.
  pub published_wormhole_messages_count: u64, // 8 bytes

  /// Total number of consumed Wormhole messages on this chain.
  pub consumed_wormhole_messages_count: u64, // 8 bytes
}

impl ChainStats {
  // discriminator included
  pub const SPACE: usize = 10 * 8;

  /// AKA `b"chain"`.
  pub const SEED_PREFIX: &'static [u8] = b"chain";

  pub fn initialize(&mut self) {
    self.users_count = 0;
    self.payables_count = 0;
    self.user_payments_count = 0;
    self.withdrawals_count = 0;
    self.activities_count = 0;
  }

  pub fn next_user(&self) -> u64 {
    self.users_count.checked_add(1).unwrap()
  }

  pub fn next_payable(&self) -> u64 {
    self.payables_count.checked_add(1).unwrap()
  }

  pub fn next_foreign_payable(&self) -> u64 {
    self.foreign_payables_count.checked_add(1).unwrap()
  }

  pub fn next_user_payment(&self) -> u64 {
    self.user_payments_count.checked_add(1).unwrap()
  }

  pub fn next_payable_payment(&self) -> u64 {
    self.payable_payments_count.checked_add(1).unwrap()
  }

  pub fn next_withdrawal(&self) -> u64 {
    self.withdrawals_count.checked_add(1).unwrap()
  }

  pub fn next_activity(&self) -> u64 {
    self.activities_count.checked_add(1).unwrap()
  }

  pub fn next_published_wormhole_message(&self) -> u64 {
    self
      .published_wormhole_messages_count
      .checked_add(1)
      .unwrap()
  }

  pub fn next_consumed_wormhole_message(&self) -> u64 {
    self
      .consumed_wormhole_messages_count
      .checked_add(1)
      .unwrap()
  }
}
