//! `Payable` — the core on-chain invoice account. Dynamic size via realloc.
//! Seeds: `[b"payable", host: Pubkey, host_count_le: [u8;8]]`

use anchor_lang::prelude::*;

use crate::{errors::ChainbillsError, state::TokenAndAmount};

/// A public invoice that anyone can pay into. Created by a host.
///
/// Size is dynamic: the account is reallocated when
/// `allowed_tokens_and_amounts` or `balances` vecs change size. Max 255 ATAA
/// entries (wire format limit).
///
/// Seeds: `[Payable::SEED_PREFIX, host.key(), host_count.to_le_bytes()]`
/// where `host_count` is `user_record.payables_count` BEFORE incrementing
/// (this is the creation index, 0-based).
#[account]
pub struct Payable {
  /// The wallet of the payable's creator and owner.
  pub host: Pubkey,

  /// The value of `user_record.payables_count` at creation time.
  /// Used as part of the PDA seed to give each host a unique per-index
  /// payable.
  pub host_count: u64,

  /// Snapshot of `global_config.total_payables` at creation time.
  /// Used by the relayer to order payables globally.
  pub chain_count: u64,

  /// Unix timestamp when this payable was created.
  pub created_at: i64,

  /// Whether new payments are rejected. Set by `close_payable`.
  pub is_closed: bool,

  /// Whether each incoming payment should trigger an immediate withdrawal.
  pub is_auto_withdraw: bool,

  /// Total number of payments ever received by this payable.
  pub payments_count: u64,

  /// Total number of withdrawals ever performed from this payable.
  pub withdrawals_count: u64,

  /// Total number of activity records linked to this payable.
  pub activities_count: u64,

  /// List of (token, amount) pairs that this payable accepts.
  /// Empty = accepts any token in any amount.
  /// Max 255 entries (wire format uses 1-byte length field).
  pub allowed_tokens_and_amounts: Vec<TokenAndAmount>,

  /// Running balances per token in this payable's vault.
  /// Each entry represents the total accumulated but not yet withdrawn for a
  /// token.
  pub balances: Vec<TokenAndAmount>,
}

impl Payable {
  /// Fixed-size portion of the account (discriminator + all non-Vec fields).
  // 8  discriminator
  // 32 host
  // 8  host_count
  // 8  chain_count
  // 8  created_at
  // 1  is_closed
  // 1  is_auto_withdraw
  // 8  payments_count
  // 8  withdrawals_count
  // 8  activities_count
  // 4  Vec<TokenAndAmount> length prefix (allowed_tokens_and_amounts)
  // 4  Vec<TokenAndAmount> length prefix (balances)
  const FIXED_SPACE: usize = 8 + 32 + 8 + 8 + 8 + 1 + 1 + 8 + 8 + 8 + 4 + 4;
  /// AKA b"payable"
  pub const SEED_PREFIX: &'static [u8] = b"payable";
  /// AKA b"vault" — seed prefix for the PayableVaultAuthority PDA.
  pub const VAULT_SEED_PREFIX: &'static [u8] = b"vault";

  /// Compute the required byte space for a newly created payable with
  /// `ataa_len` ATAA entries. `balances` starts empty at creation.
  pub fn space_for_ataa(ataa_len: usize) -> usize {
    Self::FIXED_SPACE + ataa_len * TokenAndAmount::SPACE
  }

  /// Compute required space after updating both ATAA and balances vecs.
  pub fn space_for_update(ataa_len: usize, bal_len: usize) -> usize {
    Self::FIXED_SPACE + (ataa_len + bal_len) * TokenAndAmount::SPACE
  }

  /// Compute required space when adding one new balance entry.
  /// Called when a token is paid for the first time (vault ATA also created).
  pub fn space_for_new_balance(&self) -> usize {
    Self::FIXED_SPACE
      + self.allowed_tokens_and_amounts.len() * TokenAndAmount::SPACE
      + (self.balances.len() + 1) * TokenAndAmount::SPACE
  }

  /// Check whether a (token, amount) pair is accepted by this payable.
  ///
  /// Rules:
  /// - If ATAA list is empty → accept any token in any amount → returns true.
  /// - Otherwise → must find an entry with matching token and amount <=
  ///   entry.amount (entry.amount is the required minimum).
  ///
  /// # Arguments
  /// * `token`  — the token mint pubkey being offered
  /// * `amount` — the amount being offered
  pub fn is_token_amount_allowed(&self, token: Pubkey, amount: u64) -> bool {
    if self.allowed_tokens_and_amounts.is_empty() {
      return true;
    }
    self
      .allowed_tokens_and_amounts
      .iter()
      .any(|entry| entry.token == token && amount >= entry.amount)
  }

  /// Add `amount` to the balance for `token`. If no balance entry exists yet,
  /// push a new one (caller must have reallocated space first).
  ///
  /// # Arguments
  /// * `token`  — the token mint to credit
  /// * `amount` — the amount to add
  pub fn add_to_balance(&mut self, token: Pubkey, amount: u64) -> Result<()> {
    for entry in self.balances.iter_mut() {
      if entry.token == token {
        entry.amount = entry
          .amount
          .checked_add(amount)
          .ok_or(ChainbillsError::MathOverflow)?;
        return Ok(());
      }
    }
    // No existing entry — push new one (space must already be reallocated)
    self.balances.push(TokenAndAmount { token, amount });
    Ok(())
  }

  /// Deduct `amount` from the balance for `token`.
  ///
  /// Returns `Err(InsufficientBalance)` if the token has no balance or balance
  /// < amount.
  ///
  /// # Arguments
  /// * `token`  — the token mint to deduct from
  /// * `amount` — the amount to deduct
  pub fn deduct_balance(&mut self, token: Pubkey, amount: u64) -> Result<()> {
    for entry in self.balances.iter_mut() {
      if entry.token == token {
        require!(entry.amount >= amount, ChainbillsError::InsufficientBalance);
        entry.amount = entry
          .amount
          .checked_sub(amount)
          .ok_or(ChainbillsError::MathUnderflow)?;
        return Ok(());
      }
    }
    err!(ChainbillsError::InsufficientBalance)
  }

  /// Increment payments_count by 1.
  pub fn increment_payments(&mut self) -> Result<()> {
    self.payments_count = self
      .payments_count
      .checked_add(1)
      .ok_or(ChainbillsError::MathOverflow)?;
    Ok(())
  }

  /// Increment withdrawals_count by 1.
  pub fn increment_withdrawals(&mut self) -> Result<()> {
    self.withdrawals_count = self
      .withdrawals_count
      .checked_add(1)
      .ok_or(ChainbillsError::MathOverflow)?;
    Ok(())
  }

  /// Increment activities_count by 1.
  pub fn increment_activities(&mut self) -> Result<()> {
    self.activities_count = self
      .activities_count
      .checked_add(1)
      .ok_or(ChainbillsError::MathOverflow)?;
    Ok(())
  }
}

#[cfg(test)]
mod tests {
  use super::*;

  fn mint_a() -> Pubkey {
    Pubkey::new_unique()
  }

  fn empty_payable() -> Payable {
    Payable {
      host: Pubkey::default(),
      host_count: 0,
      chain_count: 0,
      created_at: 0,
      is_closed: false,
      is_auto_withdraw: false,
      payments_count: 0,
      withdrawals_count: 0,
      activities_count: 0,
      allowed_tokens_and_amounts: vec![],
      balances: vec![],
    }
  }

  #[test]
  fn test_empty_ataa_allows_any_token_any_amount() {
    let p = empty_payable();
    let token = mint_a();
    assert!(p.is_token_amount_allowed(token, 1));
    assert!(p.is_token_amount_allowed(token, u64::MAX));
    assert!(p.is_token_amount_allowed(Pubkey::default(), 0));
  }

  #[test]
  fn test_ataa_enforces_exact_token_and_min_amount() {
    let token = mint_a();
    let mut p = empty_payable();
    p.allowed_tokens_and_amounts = vec![TokenAndAmount { token, amount: 1_000 }];

    assert!(p.is_token_amount_allowed(token, 1_000));
    assert!(p.is_token_amount_allowed(token, 2_000));
    assert!(!p.is_token_amount_allowed(token, 999));
    assert!(!p.is_token_amount_allowed(Pubkey::new_unique(), 1_000));
  }

  #[test]
  fn test_add_to_balance_new_entry() {
    let token = mint_a();
    let mut p = empty_payable();
    p.add_to_balance(token, 500).unwrap();
    assert_eq!(p.balances.len(), 1);
    assert_eq!(p.balances[0].amount, 500);
  }

  #[test]
  fn test_add_to_balance_accumulates() {
    let token = mint_a();
    let mut p = empty_payable();
    p.add_to_balance(token, 500).unwrap();
    p.add_to_balance(token, 300).unwrap();
    assert_eq!(p.balances.len(), 1);
    assert_eq!(p.balances[0].amount, 800);
  }

  #[test]
  fn test_deduct_balance_success() {
    let token = mint_a();
    let mut p = empty_payable();
    p.balances.push(TokenAndAmount { token, amount: 1_000 });
    p.deduct_balance(token, 400).unwrap();
    assert_eq!(p.balances[0].amount, 600);
  }

  #[test]
  fn test_deduct_balance_full() {
    let token = mint_a();
    let mut p = empty_payable();
    p.balances.push(TokenAndAmount { token, amount: 1_000 });
    p.deduct_balance(token, 1_000).unwrap();
    assert_eq!(p.balances[0].amount, 0);
  }

  #[test]
  fn test_deduct_balance_insufficient_errors() {
    let token = mint_a();
    let mut p = empty_payable();
    p.balances.push(TokenAndAmount { token, amount: 100 });
    assert!(p.deduct_balance(token, 101).is_err());
  }

  #[test]
  fn test_deduct_balance_no_entry_errors() {
    let mut p = empty_payable();
    assert!(p.deduct_balance(mint_a(), 1).is_err());
  }

  #[test]
  fn test_increment_counters() {
    let mut p = empty_payable();
    p.increment_payments().unwrap();
    p.increment_payments().unwrap();
    p.increment_withdrawals().unwrap();
    p.increment_activities().unwrap();
    assert_eq!(p.payments_count, 2);
    assert_eq!(p.withdrawals_count, 1);
    assert_eq!(p.activities_count, 1);
  }

  #[test]
  fn test_space_for_ataa_zero() {
    let base = Payable::space_for_ataa(0);
    assert!(base > 8);
  }

  #[test]
  fn test_space_for_ataa_grows_with_entries() {
    let s0 = Payable::space_for_ataa(0);
    let s3 = Payable::space_for_ataa(3);
    assert!(s3 > s0);
  }
}
