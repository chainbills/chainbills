//! `ForeignPayable` — synced state of a payable that lives on a foreign EVM
//! chain. Seeds: `[b"foreign_payable", payable_id: [u8;32]]`

use anchor_lang::prelude::*;

use crate::errors::ChainbillsError;

/// A (Wormhole-normalized token, amount) pair for foreign chain tokens.
/// Token is stored as 32-byte Wormhole format (left-padded for EVM addresses).
#[derive(AnchorSerialize, AnchorDeserialize, Clone, Copy, PartialEq, Eq)]
pub struct TokenAndAmountForeign {
  /// 32-byte Wormhole-normalized token address on the foreign chain.
  /// EVM: left-padded 20-byte address. Solana: pubkey bytes.
  pub token: [u8; 32],
  /// Required payment amount in token base units.
  pub amount: u64,
}

impl TokenAndAmountForeign {
  /// Byte size: 32 (token bytes) + 8 (u64 amount).
  pub const SPACE: usize = 32 + 8;
}

/// Represents the last-known state of a payable that lives on a foreign EVM
/// chain. Created and updated by `recv_payable_update_via_wormhole` and
/// `recv_payable_update_via_cctp`.
///
/// The `payable_id` is the foreign chain's identifier for the payable
/// (on EVM this is a `bytes32` derived from `keccak256(...)` or the contract
/// address).
///
/// Seeds: `[ForeignPayable::SEED_PREFIX, payable_id]`
#[account]
pub struct ForeignPayable {
  /// The foreign chain's identifier for this payable (32 bytes).
  /// EVM: result of `keccak256(abi.encodePacked(...))` or similar.
  pub payable_id: [u8; 32],

  /// cbChainId of the chain where this payable lives.
  pub cb_chain_id: [u8; 32],

  /// Whether this payable is currently closed on its home chain.
  pub is_closed: bool,

  /// Whether auto-withdraw is enabled on the foreign payable.
  pub is_auto_withdraw: bool,

  /// The payable_update_nonce of the last applied PayablePayload.
  /// New updates must have nonce > this value to prevent state regression.
  pub payable_update_nonce: u64,

  /// Total number of payments received by this foreign payable on Solana.
  pub payments_count: u64,

  /// Unix timestamp when this ForeignPayable record was first created on
  /// Solana.
  pub created_at: i64,

  /// Allowed tokens and amounts from the foreign chain (Wormhole-normalized).
  pub allowed_tokens_and_amounts: Vec<TokenAndAmountForeign>,
}

impl ForeignPayable {
  /// Fixed-size portion of the account.
  // 8  discriminator
  // 32 payable_id
  // 32 cb_chain_id
  // 1  is_closed
  // 1  is_auto_withdraw
  // 8  payable_update_nonce
  // 8  payments_count
  // 8  created_at
  // 4  Vec length prefix (allowed_tokens_and_amounts)
  const FIXED_SPACE: usize = 8 + 32 + 32 + 1 + 1 + 8 + 8 + 8 + 4;
  /// AKA b"foreign_payable"
  pub const SEED_PREFIX: &'static [u8] = b"foreign_payable";

  /// Compute space for a ForeignPayable with `ataa_len` ATAA entries.
  pub fn space_for_ataa(ataa_len: usize) -> usize {
    Self::FIXED_SPACE + ataa_len * TokenAndAmountForeign::SPACE
  }

  /// Check whether a foreign (token, amount) pair is accepted by this payable.
  ///
  /// Rules: empty ATAA = accept any. Otherwise token + amount must match an
  /// entry.
  ///
  /// # Arguments
  /// * `token`  — 32-byte Wormhole-normalized token address
  /// * `amount` — amount being paid
  pub fn is_token_amount_allowed(&self, token: [u8; 32], amount: u64) -> bool {
    if self.allowed_tokens_and_amounts.is_empty() {
      return true;
    }
    self
      .allowed_tokens_and_amounts
      .iter()
      .any(|entry| entry.token == token && amount >= entry.amount)
  }

  /// Increment payments_count by 1.
  pub fn increment_payments(&mut self) -> Result<()> {
    self.payments_count = self
      .payments_count
      .checked_add(1)
      .ok_or(ChainbillsError::MathOverflow)?;
    Ok(())
  }
}

#[cfg(test)]
mod tests {
  use super::*;

  fn empty_fp() -> ForeignPayable {
    ForeignPayable {
      payable_id: [0u8; 32],
      cb_chain_id: [1u8; 32],
      payable_update_nonce: 0,
      payments_count: 0,
      is_closed: false,
      is_auto_withdraw: false,
      created_at: 0,
      allowed_tokens_and_amounts: vec![],
    }
  }

  #[test]
  fn test_empty_ataa_allows_any() {
    let fp = empty_fp();
    assert!(fp.is_token_amount_allowed([2u8; 32], 1_000_000));
    assert!(fp.is_token_amount_allowed([0u8; 32], 0));
  }

  #[test]
  fn test_ataa_enforces_token_and_min_amount() {
    let token = [3u8; 32];
    let mut fp = empty_fp();
    fp.allowed_tokens_and_amounts =
      vec![TokenAndAmountForeign { token, amount: 1_000 }];

    assert!(fp.is_token_amount_allowed(token, 1_000));
    assert!(fp.is_token_amount_allowed(token, 5_000));
    assert!(!fp.is_token_amount_allowed(token, 999));
    assert!(!fp.is_token_amount_allowed([4u8; 32], 1_000));
  }

  #[test]
  fn test_increment_payments() {
    let mut fp = empty_fp();
    fp.increment_payments().unwrap();
    fp.increment_payments().unwrap();
    assert_eq!(fp.payments_count, 2);
  }
}
