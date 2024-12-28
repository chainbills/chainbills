use anchor_lang::prelude::*;

#[account]
/// Holds the wallet address of the nth user on the chain.
pub struct ChainUserAddress {
  /// The wallet address of the nth user on this chain at the point this user
  /// was initialized.
  pub user_address: Pubkey, // 32 bytes
}

impl ChainUserAddress {
  // discriminator (8) included
  pub const SPACE: usize = 8 + 32;

  /// AKA `b"chain_user_address`.
  pub const SEED_PREFIX: &'static [u8] = b"chain_user_address";
}

#[account]
/// Holds reference to the nth payable in the chain.
pub struct ChainPayableId {
  /// The Pubkey of the nth payable ID created when this PDA was initialized.
  pub payable_id: Pubkey, // 32 bytes
}

impl ChainPayableId {
  // discriminator (8) included
  pub const SPACE: usize = 8 + 32;

  /// AKA `b"chain_payable_id`.
  pub const SEED_PREFIX: &'static [u8] = b"chain_payable_id";
}

#[account]
/// Holds reference to the nth foreign payable in the chain.
pub struct ChainForeignPayableId {
  /// The ID of the nth foreign payable created when this PDA was initialized.
  pub payable_id: [u8; 32], // 32 bytes
}

impl ChainForeignPayableId {
  // discriminator (8) included
  pub const SPACE: usize = 8 + 32;

  /// AKA `b"chain_foreign_payable_id"`.
  pub const SEED_PREFIX: &'static [u8] = b"chain_foreign_payable_id";
}

#[account]
/// Holds reference to the nth user payment in the chain.
pub struct ChainUserPaymentId {
  /// The Pubkey of the nth user payment ID created when this PDA was
  /// initialized.
  pub user_payment_id: Pubkey, // 32 bytes
}

impl ChainUserPaymentId {
  // discriminator (8) included
  pub const SPACE: usize = 8 + 32;

  /// AKA `b"chain_user_payment_id`.
  pub const SEED_PREFIX: &'static [u8] = b"chain_user_payment_id";
}

#[account]
/// Holds reference to the nth payable payment in the chain.
pub struct ChainPayablePaymentId {
  /// The Pubkey of the nth payable payment ID created when this PDA was
  /// initialized.
  pub payable_payment_id: Pubkey, // 32 bytes
}

impl ChainPayablePaymentId {
  // discriminator (8) included
  pub const SPACE: usize = 8 + 32;

  /// AKA `b"chain_payable_payment_id`.
  pub const SEED_PREFIX: &'static [u8] = b"chain_payable_payment_id";
}

#[account]
/// Holds reference to the nth withdrawal in the chain.
pub struct ChainWithdrawalId {
  /// The Pubkey of the nth withdrawal ID created when this PDA was initialized.
  pub withdrawal_id: Pubkey, // 32 bytes
}

impl ChainWithdrawalId {
  // discriminator (8) included
  pub const SPACE: usize = 8 + 32;

  /// AKA `b"chain_withdrawal_id`.
  pub const SEED_PREFIX: &'static [u8] = b"chain_withdrawal_id";
}

#[account]
/// Holds reference to the matching chain_id and message_sequence of the
/// nth consumed wormhole message in this chain. The stored id and count
/// can now be used to retrieve the PDA that has the consumed message hash.
pub struct ChainConsumedWormholeMessageId {
  /// The chain_id of the consumed wormhole message.
  pub chain_id: u16, // 2 bytes

  /// The Wormhole Message Sequence as of the time the VAA was consumed.
  /// It also matches the local chain count of the VAA.
  pub message_sequence: u64, // 8 bytes
}

impl ChainConsumedWormholeMessageId {
  // discriminator (8) included
  pub const SPACE: usize = 8 + 2 + 8;

  /// AKA `b"chain_consumed_wormhole_message_id"`.
  pub const SEED_PREFIX: &'static [u8] = b"chain_consumed_wormhole_message_id";
}
