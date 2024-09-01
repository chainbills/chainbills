use anchor_lang::prelude::*;

#[account]
/// A counter for the PayablePayments per chain.
pub struct PayableChainCounter {
  /// The ID of the Payable to which this Payment was made.
  pub payable_id: Pubkey, // 32 bytes

  /// The Wormhole Chain ID of the chain from which the payment was made.
  pub chain_id: u16, // 2 bytes

  /// The nth count of payments to this payable from the payment source
  /// chain at the point this payment was recorded.
  pub payments_count: u64, // 8 bytes
}

impl PayableChainCounter {
  // discriminator (8) included
  pub const SPACE: usize = 2 + 32 + 2 + 8;

  pub fn next_payment(&self) -> u64 {
    self.payments_count.checked_add(1).unwrap()
  }
}
