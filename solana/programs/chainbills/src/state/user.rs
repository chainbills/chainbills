use anchor_lang::prelude::*;

#[account]
pub struct User {
  /// The Wormhole-normalized address of the person who owns this User account.
  pub owner_wallet: [u8; 32], // 32 bytes

  /// The Wormhole Chain Id of the owner_wallet
  pub chain_id: u16, // 2 bytes

  /// The nth count of global users at the point this user was initialized.
  pub global_count: u64, // 8 bytes

  /// Total number of payables that this user has ever created.
  pub payables_count: u64, // 8 bytes

  /// Total number of payments that this user has ever made.
  pub payments_count: u64, // 8 bytes

  /// Total number of withdrawals that this user has ever made.
  pub withdrawals_count: u64, // 8 bytes
}

impl User {
  pub const SPACE: usize = 32 + 2 + (4 * 8);

  pub fn next_payable(&self) -> u64 {
    self.payables_count.checked_add(1).unwrap()
  }

  pub fn next_payment(&self) -> u64 {
    self.payables_count.checked_add(1).unwrap()
  }

  pub fn next_withdrawal(&self) -> u64 {
    self.payables_count.checked_add(1).unwrap()
  }
}
