use anchor_lang::prelude::*;

#[account]
/// A counter for the PayablePayments per chain.
pub struct PayablePerChainPaymentsCounter {
  /// The total count of payments to a payable from a payment source
  /// chain.
  pub payments_count: u64, // 8 bytes
}

impl PayablePerChainPaymentsCounter {
  // discriminator (8) included
  pub const SPACE: usize = 8 + 8;

  pub fn next_payment(&self) -> u64 {
    self.payments_count.checked_add(1).unwrap()
  }
}
