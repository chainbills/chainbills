use anchor_lang::prelude::*;

/// Keeps track of details about supported tokens.
#[account]
pub struct TokenDetails {
  /// The token's mint. Normally shouldn't have being stored but this is to
  /// help with verifying token details at creating payables.
  pub mint: Pubkey, // 32 bytes

  /// Whether payments are currently accepted in this token.
  pub is_supported: bool, // 1 byte

  /// The maximum fees for withdrawal (with its decimals).
  pub max_withdrawal_fees: u64, // 8 bytes

  /// The total amount of user payments in this token.
  pub total_user_paid: u64, // 8 bytes

  /// The total amount of payable payments in this token.
  pub total_payable_received: u64, // 8 bytes

  /// The total amount of withdrawals in this token.
  pub total_withdrawn: u64, // 8 bytes

  /// The total amount of fees collected from withdrawals in this token.
  pub total_withdrawal_fees_collected: u64, // 8 bytes
}

impl TokenDetails {
  // discriminator (8) included
  pub const SPACE: usize = 1 + 6 * 8 + 32;

  /// AKA `b"token_details`.
  pub const SEED_PREFIX: &'static [u8] = b"token_details";

  pub fn add_user_paid(&mut self, amount: u64) {
    self.total_user_paid = self.total_user_paid.checked_add(amount).unwrap()
  }

  pub fn add_payable_received(&mut self, amount: u64) {
    self.total_payable_received =
      self.total_payable_received.checked_add(amount).unwrap()
  }

  pub fn add_withdrawn(&mut self, amount: u64) {
    self.total_withdrawn = self.total_withdrawn.checked_add(amount).unwrap()
  }

  pub fn add_withdrawal_fees_collected(&mut self, amount: u64) {
    self.total_withdrawal_fees_collected = self
      .total_withdrawal_fees_collected
      .checked_add(amount)
      .unwrap()
  }
}
