use crate::state::TokenAndAmount;
use anchor_lang::prelude::*;

#[account]
/// A payable is like a public invoice through which anybody can pay to.
pub struct Payable {
  /// The nth count of payables on this chain at the point this payable
  /// was created.
  pub chain_count: u64, // 8 bytes

  /// The wallet address of that created this Payable.
  pub host: Pubkey, // 32 bytes

  /// The nth count of payables that the host has created at the point of
  /// this payable's creation.
  pub host_count: u64, // 8 bytes

  /// The timestamp of when this payable was created.
  pub created_at: u64, // 8 bytes

  /// The total number of payments made to this payable.
  pub payments_count: u64, // 8 bytes

  /// The total number of withdrawals made from this payable.
  pub withdrawals_count: u64, // 8 bytes

  /// The total number of activities made on this payable.
  pub activities_count: u64, // 8 bytes

  /// Whether this payable is currently accepting payments.
  pub is_closed: bool, // 1 byte

  /// The allowed tokens (and their amounts) on this payable.
  /* TokenAndAmount::SPACE * len() */
  pub allowed_tokens_and_amounts: Vec<TokenAndAmount>,

  /// Records of how much is in this payable.
  /* TokenAndAmount::SPACE * len() */
  pub balances: Vec<TokenAndAmount>,
}

impl Payable {
  /// AKA `b"payable"`.
  #[constant]
  pub const SEED_PREFIX: &'static [u8] = b"payable";

  pub fn next_payment(&self) -> u64 {
    self.payments_count.checked_add(1).unwrap()
  }

  pub fn next_withdrawal(&self) -> u64 {
    self.withdrawals_count.checked_add(1).unwrap()
  }

  pub fn next_activity(&self) -> u64 {
    self.activities_count.checked_add(1).unwrap()
  }

  pub fn space_new(ataa_len: usize) -> usize {
    // discriminator (8) included
    1 + (7 * 8) + 32 + (ataa_len * TokenAndAmount::SPACE)
  }

  pub fn space_update_ataa(&self, ataa_len: usize) -> usize {
    1 + (6 * 8) // discriminator (8) included
      + 32
      + (ataa_len * TokenAndAmount::SPACE)
      + (self.balances.len() * TokenAndAmount::SPACE)
  }

  pub fn space_update_balance(&self, token: Pubkey) -> usize {
    let will_add_new_balance = !self.balances.iter().any(|t| t.token == token);

    let new_bals_len =
      self.balances.len() + if will_add_new_balance { 1 } else { 0 };

    1 + (6 * 8) // discriminator (8) included
      + 32
      + (self.allowed_tokens_and_amounts.len() * TokenAndAmount::SPACE)
      + (new_bals_len * TokenAndAmount::SPACE)
  }
}
