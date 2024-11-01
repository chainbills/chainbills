use anchor_lang::prelude::*;

#[account]
/// Holds reference to the nth activity in the chain.
pub struct PayableActivityInfo {
  /// The nth count of all activities on this chain at the point this activity
  /// was recorded.
  pub chain_count: u64, // 8 bytes
}

impl PayableActivityInfo {
  // discriminator (8) included
  pub const SPACE: usize = 8 + 8;
}

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

#[account]
/// A counter for the Withdrawals per Payable. This is used to track
/// the nth withdrawal made from a payable. It contains the host's
/// count of withdrawals and the time the withdrawal was made
/// on the involved payable. The caller should then use the retrieved
/// host count to get the main Withdrawal account.
pub struct PayableWithdrawalInfo {
  /// The host count of withdrawals at the point when the withdrawal was made.
  pub host_count: u64, // 8 bytes
}

impl PayableWithdrawalInfo {
  // discriminator (8) included
  pub const SPACE: usize = 8 + 8;

  /// AKA `b"payment"`.
  #[constant]
  pub const SEED_PREFIX: &'static [u8] = b"payable_withdrawal_info";
}
