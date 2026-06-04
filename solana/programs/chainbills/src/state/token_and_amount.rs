//! `TokenAndAmount` — shared value type for payable allowed-tokens list and
//! balances.

use anchor_lang::prelude::*;

/// A (token_mint, amount) pair used in payable ATAA lists and balance tracking.
///
/// In ATAA lists: if amount > 0, payer must pay exactly this amount.
/// If the entire ATAA list is empty, the payable accepts any token in any
/// amount.
///
/// In balance tracking: represents the total accumulated balance for a token.
#[derive(AnchorSerialize, AnchorDeserialize, Clone, Copy, PartialEq, Eq)]
pub struct TokenAndAmount {
  /// The token mint pubkey. Use `system_program::ID` for native SOL.
  pub token: Pubkey,
  /// Amount in token base units. Must be > 0 in ATAA entries.
  pub amount: u64,
}

impl TokenAndAmount {
  /// Byte size of one TokenAndAmount entry: 32 (Pubkey) + 8 (u64).
  pub const SPACE: usize = 32 + 8;
}
