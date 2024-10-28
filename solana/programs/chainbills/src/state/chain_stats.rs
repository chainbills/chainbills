use anchor_lang::prelude::*;

#[account]
/// Keeps track of all activities on this chain.
pub struct ChainStats {
  /// Wormhole-Chain ID for this chain.
  pub chain_id: u16, // 2 bytes

  /// Total number of users that have ever been initialized on this chain.
  pub users_count: u64, // 8 bytes

  /// Total number of payables that have ever been created on this chain.
  pub payables_count: u64, // 8 bytes

  /// Total number of payments that users have ever been made on this chain.
  pub user_payments_count: u64, // 8 bytes

  /// Total number of payments that payables have ever received on this chain.
  pub payable_payments_count: u64, // 8 bytes

  /// Total number of withdrawals that have ever been made on this chain.
  pub withdrawals_count: u64, // 8 bytes
}

impl ChainStats {
  // discriminator included
  pub const SPACE: usize = 2 + (6 * 8);

  /// AKA `b"chain"`.
  #[constant]
  pub const SEED_PREFIX: &'static [u8] = b"chain";

  pub fn initialize(&mut self, chain_id: u16) {
    self.chain_id = chain_id;
    self.users_count = 0;
    self.payables_count = 0;
    self.user_payments_count = 0;
    self.withdrawals_count = 0;
  }

  pub fn next_user(&self) -> u64 {
    self.users_count.checked_add(1).unwrap()
  }

  pub fn next_payable(&self) -> u64 {
    self.payables_count.checked_add(1).unwrap()
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
}
