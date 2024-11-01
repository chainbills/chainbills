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
  #[constant]
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
  #[constant]
  pub const SEED_PREFIX: &'static [u8] = b"chain_payable_id";
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
  #[constant]
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
  #[constant]
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
  #[constant]
  pub const SEED_PREFIX: &'static [u8] = b"chain_withdrawal_id";
}
