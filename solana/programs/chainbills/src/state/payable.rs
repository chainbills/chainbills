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

  /// The allowed tokens (and their amounts) on this payable.
  /* TokenAndAmount::SPACE * MAX_PAYABLES_TOKENS */
  pub allowed_tokens_and_amounts: Vec<TokenAndAmount>,

  /// Records of how much is in this payable.
  /* TokenAndAmount::SPACE * MAX_PAYABLES_TOKENS */
  pub balances: Vec<TokenAndAmount>,

  /// The timestamp of when this payable was created.
  pub created_at: u64, // 8 bytes

  /// The total number of payments made to this payable.
  pub payments_count: u64, // 8 bytes

  /// The total number of withdrawals made from this payable.
  pub withdrawals_count: u64, // 8 bytes

  /// Whether this payable is currently accepting payments.
  pub is_closed: bool, // 1 byte
}

impl Payable {
  /// The maximum number of tokens a payable can hold balances in.
  /// Also the maximum number of tokens that a payable can specify
  /// that it can accept payments in.
  #[constant]
  pub const MAX_PAYABLES_TOKENS: usize = 10;

  // discriminator (8) included
  pub const SPACE: usize = 1
    + (6 * 8)
    + 32
    + (2 * Payable::MAX_PAYABLES_TOKENS * TokenAndAmount::SPACE);

  /// AKA `b"payable"`.
  #[constant]
  pub const SEED_PREFIX: &'static [u8] = b"payable";

  pub fn next_payment(&self) -> u64 {
    self.payments_count.checked_add(1).unwrap()
  }

  pub fn next_withdrawal(&self) -> u64 {
    self.withdrawals_count.checked_add(1).unwrap()
  }
}
