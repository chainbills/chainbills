use anchor_lang::prelude::*;

#[derive(AnchorSerialize, AnchorDeserialize, Clone, Copy)]
/// Variants of activities.
pub enum ActivityType {
  /// A user was initialized.
  InitializedUser,

  /// A payable was created.
  CreatedPayable,

  /// A payment was made by a user.
  UserPaid,

  /// A payment was made to the payable.
  PayableReceived,

  /// A withdrawal was made by a payable.
  Withdrew,

  /// The payable was closed and is no longer accepting payments.
  ClosedPayable,

  /// The payable was reopened and is now accepting payments.
  ReopenedPayable,

  /// The payable's allowed tokens and amounts were updated.
  UpdatedPayableAllowedTokensAndAmounts,
}

#[account]
/// A record of an activity.
pub struct ActivityRecord {
  /// The nth count of activities on this chain at the point this activity
  /// was recorded.
  pub chain_count: u64, // 8 bytes

  /// The nth count of activities that the user has made at the point
  /// of this activity.
  pub user_count: u64, // 8 bytes

  /// The nth count of activities on the related payable at the point
  /// of this activity.
  pub payable_count: u64, // 8 bytes

  /// The timestamp of when this activity was recorded.
  pub timestamp: u64, // 8 bytes

  /// The ID of the entity (Payable, Payment, or Withdrawal) that is relevant
  /// to this activity.
  pub entity: Pubkey, // 32 bytes

  /// The type of activity.
  pub activity_type: ActivityType, // 1 byte
}

impl ActivityRecord {
  // discriminator (8) included
  pub const SPACE: usize = 1 + (5 * 8) + 32;

  /// AKA `b"activity"`.
  pub const SEED_PREFIX: &'static [u8] = b"activity";
}
