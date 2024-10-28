use anchor_lang::prelude::*;

#[account]
/// Holds reference to the nth payment to a payable.
pub struct PayablePerChainPaymentInfo {
  /// The nth count of all payments to this payable at the point this payment
  /// was recorded.
  pub payable_count: u64, // 8 bytes
}

impl PayablePerChainPaymentInfo {
  // discriminator (8) included
  pub const SPACE: usize = 8 + 8;
}
