//! `UserPayment` — the payer's receipt for a payment. Lives on the payer's
//! chain. Seeds: `[b"up", payer: Pubkey, payment_count_le: [u8;8]]`

use anchor_lang::prelude::*;

/// Immutable record of a payment from the payer's perspective.
/// Created in both same-chain and cross-chain outbound payment flows.
///
/// Seeds: `[UserPayment::SEED_PREFIX, payer.key(),
/// user_record.payments_count.to_le_bytes()]` where `payments_count` is the
/// value BEFORE incrementing (0-based index).
#[account]
pub struct UserPayment {
  /// The payer's wallet.
  pub payer: Pubkey,

  /// The target payable. For same-chain: local Payable PDA.
  /// For cross-chain outbound: the foreign payable_id as a Pubkey (bytes).
  pub payable: Pubkey,

  /// This payment's index within the payer's payment history (0-based).
  pub payer_count: u64,

  /// Snapshot of `global_config.total_user_payments` at time of payment.
  pub chain_count: u64,

  /// The token mint used. `system_program::ID` for native SOL.
  pub token_mint: Pubkey,

  /// Amount paid in token base units.
  pub amount: u64,

  /// cbChainId of the chain where the payable lives.
  pub payable_chain_id: [u8; 32],

  /// cbChainId of the chain where the payer lives (this chain = Solana).
  pub payer_chain_id: [u8; 32],

  /// Unix timestamp of the payment.
  pub created_at: i64,
}

impl UserPayment {
  /// AKA b"user_payment"
  pub const SEED_PREFIX: &'static [u8] = b"user_payment";
  // 8  discriminator
  // 32 payer
  // 32 payable
  // 8  payer_count
  // 8  chain_count
  // 32 token_mint
  // 8  amount
  // 32 payable_chain_id
  // 32 payer_chain_id
  // 8  created_at
  /// Computed account byte space based on all fields.
  pub const SPACE: usize = 8 + 32 + 32 + 8 + 8 + 32 + 8 + 32 + 32 + 8;
}
