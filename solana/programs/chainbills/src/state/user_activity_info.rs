use anchor_lang::prelude::*;

#[account]
/// Holds reference to the nth activity in the chain.
pub struct UserActivityInfo {
  /// The nth count of all activities on this chain at the point this activity
  /// was recorded.
  pub chain_count: u64, // 8 bytes
}

impl UserActivityInfo {
  // discriminator (8) included
  pub const SPACE: usize = 8 + 8;
}
