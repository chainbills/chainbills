use crate::state::TokenAndAmount;
use anchor_lang::prelude::*;

#[account]
/// A receipt of a withdrawal made by a Host from a Payable.
pub struct Withdrawal {
  /// The address of the Payable from which this Withdrawal was made.
  pub payable_id: Pubkey, // 32 bytes

  /// The wallet address (payable's owner) that made this Withdrawal.
  pub host: Pubkey, // 32 bytes

  /// The nth count of withdrawals on this chain at the point
  /// this withdrawal was made.
  pub chain_count: u64, // 8 bytes

  /// The nth count of withdrawals that the host has made
  /// at the point of making this withdrawal.
  pub host_count: u64, // 8 bytes

  /// The nth count of withdrawals that has been made from
  /// this payable at the point when this withdrawal was made.
  pub payable_count: u64, // 8 bytes

  /// When this withdrawal was made.
  pub timestamp: u64, // 8 bytes

  /// The amount and token that the host withdrew
  pub details: TokenAndAmount, // TokenAndAmount::SPACE
}

impl Withdrawal {
  // discriminator (8) included
  pub const SPACE: usize = (5 * 8) + (2 * 32) + TokenAndAmount::SPACE;

  /// AKA `b"withdrawal"`.
  #[constant]
  pub const SEED_PREFIX: &'static [u8] = b"withdrawal";
}
