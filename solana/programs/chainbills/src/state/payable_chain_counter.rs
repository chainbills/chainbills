use anchor_lang::prelude::*;

#[account]
/// A counter for the PayablePayments per chain.
pub struct PayableChainCounter {
  /// The nth count of payments to this payable from the payment source
  /// chain at the point this payment was recorded.
  pub payments_count: u64, // 8 bytes
}

impl PayableChainCounter {
  // discriminator (8) included
  pub const SPACE: usize = 8 + 8;

  pub fn next_payment(&self) -> u64 {
    self.payments_count.checked_add(1).unwrap()
  }
}
