//! Activity tracking accounts — global audit trail with per-entity pointer
//! indexes. Follows the same pattern as
//! `rebelorcs/programs/nft_marketplace/src/state/activity.rs`.

use anchor_lang::prelude::*;

/// All possible activity types. Mirrors EVM's `ActivityType` enum.
#[derive(AnchorSerialize, AnchorDeserialize, Clone, PartialEq, Eq)]
pub enum ActivityType {
  /// A new UserRecord was created (user's first action).
  UserInitialized,
  /// A payable was created.
  PayableCreated,
  /// A payable was closed by its host.
  PayableClosed,
  /// A previously closed payable was reopened.
  PayableReopened,
  /// A payable's allowed tokens and amounts list was updated.
  PayableAtaaUpdated,
  /// A payable's auto-withdraw flag was changed.
  PayableAutoWithdrawUpdated,
  /// A payment was made (same-chain or cross-chain outbound).
  UserPaid,
  /// A payable received a payment (same-chain or cross-chain inbound).
  PayableReceived,
  /// A host withdrew funds from a payable.
  Withdrew,
  /// A foreign payable's state was synced from a foreign chain (first time).
  ForeignPayableCreated,
  /// A foreign payable's state was updated from a foreign chain.
  ForeignPayableUpdated,
}

/// A single activity event in the global audit trail.
/// Globally indexed; pointer accounts provide per-entity access.
///
/// Seeds: `[ActivityRecord::SEED_PREFIX, ActivityRecord::GLOBAL_PREFIX,
/// global_index.to_le_bytes()]`
#[account]
pub struct ActivityRecord {
  /// The global sequence index of this event (0-based, monotonically
  /// increasing).
  pub global_index: u64,

  /// The type of activity that occurred.
  pub activity_type: ActivityType,

  /// The primary entity involved (payable PDA, user_payment PDA, etc.).
  pub entity: Pubkey,

  /// The actor who triggered this activity (payer, host, relayer, etc.).
  pub actor: Pubkey,

  /// Unix timestamp when this activity occurred.
  pub timestamp: i64,
}

impl ActivityRecord {
  /// AKA b"global" — secondary seed distinguishing global records from pointer
  /// records.
  pub const GLOBAL_PREFIX: &'static [u8] = b"global";
  /// AKA b"activity"
  pub const SEED_PREFIX: &'static [u8] = b"activity";
  // 8  discriminator
  // 8  global_index
  // 2  activity_type (1 byte discriminator + max 1 byte variant data = Anchor
  // enum max)    Actually Anchor enums serialize as u8 discriminator, so: 1
  // byte for unit variants    To be safe we use 2 bytes (discriminator byte +
  // potential future data byte) 32 entity
  // 32 actor
  // 8  timestamp
  // +8 safety padding for enum serialization variance
  /// Computed account byte space. Includes padding for enum variant
  /// serialization.
  pub const SPACE: usize = 8 + 8 + 2 + 32 + 32 + 8 + 8;
}

/// Pointer linking a user's nth activity to the global ActivityRecord.
///
/// Seeds: `[UserActivityPointer::SEED_PREFIX, UserActivityPointer::USER_PREFIX,
/// user.key(), user_index.to_le_bytes()]`
#[account]
pub struct UserActivityPointer {
  /// Index into the global ActivityRecord sequence.
  pub global_index: u64,
}

impl UserActivityPointer {
  /// AKA b"activity"
  pub const SEED_PREFIX: &'static [u8] = b"activity";
  // 8 discriminator + 8 global_index
  /// Computed account byte space.
  pub const SPACE: usize = 8 + 8;
  /// AKA b"user"
  pub const USER_PREFIX: &'static [u8] = b"user";
}

/// Pointer linking a payable's nth activity to the global ActivityRecord.
///
/// Seeds: `[PayableActivityPointer::SEED_PREFIX,
/// PayableActivityPointer::PAYABLE_PREFIX, payable.key(),
/// payable_index.to_le_bytes()]`
#[account]
pub struct PayableActivityPointer {
  /// Index into the global ActivityRecord sequence.
  pub global_index: u64,
}

impl PayableActivityPointer {
  /// AKA b"payable"
  pub const PAYABLE_PREFIX: &'static [u8] = b"payable";
  /// AKA b"activity"
  pub const SEED_PREFIX: &'static [u8] = b"activity";
  // 8 discriminator + 8 global_index
  /// Computed account byte space.
  pub const SPACE: usize = 8 + 8;
}
