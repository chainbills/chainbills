use anchor_lang::prelude::*;

#[account]
/// A counter for the Withdrawals per Payable. This is used to track
/// the nth withdrawal made from a payable. It contains the host's
/// count of withdrawals and the time the withdrawal was made
/// on the involved payable. The caller should then use the retrieved
/// host count to get the main Withdrawal account.
pub struct PayableWithdrawalCounter {
  /// The host count of withdrawals at the point when the withdrawal was made.
  pub host_count: u64, // 8 bytes
}

impl PayableWithdrawalCounter {
  // discriminator (8) included
  pub const SPACE: usize = 8 + 8;

  /// AKA `b"payment"`.
  #[constant]
  pub const SEED_PREFIX: &'static [u8] = b"payable_withdrawal_counter";
}
