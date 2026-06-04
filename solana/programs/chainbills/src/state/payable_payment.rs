//! `PayablePayment` — the payable's receipt for a payment. Lives on the
//! payable's chain. Seeds: `[b"pp", payable: Pubkey, payment_count_le: [u8;8]]`

use anchor_lang::prelude::*;

/// Immutable record of a payment from the payable's perspective.
/// Created in both same-chain and cross-chain inbound payment flows.
///
/// `payer` is stored as `[u8; 32]` (Wormhole-normalized) to support cross-chain
/// payers:
/// - Solana payer: `pubkey.to_bytes()`
/// - EVM payer: `address.to_wormhole_format()` (left-padded 32 bytes)
///
/// Seeds: `[PayablePayment::SEED_PREFIX, payable.key(),
/// payable.payments_count.to_le_bytes()]` where `payments_count` is the value
/// BEFORE incrementing (0-based index).
#[account]
pub struct PayablePayment {
  /// The payable that received this payment.
  pub payable: Pubkey,

  /// Wormhole-normalized payer address (32 bytes).
  /// Solana: `pubkey.to_bytes()`. EVM: left-padded 20-byte address.
  pub payer: [u8; 32],

  /// This payment's index within the payable's payment history (0-based).
  pub payable_count: u64,

  /// Snapshot of `global_config.total_payable_payments` at time of payment.
  pub chain_count: u64,

  /// The token mint credited. `system_program::ID` for native SOL.
  pub token_mint: Pubkey,

  /// Amount received in token base units.
  pub amount: u64,

  /// cbChainId of the payer's chain.
  pub payer_chain_id: [u8; 32],

  /// The UserPayment PDA address on the payer's chain (or cross-chain payment
  /// ID). Stored as bytes for cross-chain compatibility.
  pub payer_payment_id: [u8; 32],

  /// Unix timestamp of the payment.
  pub created_at: i64,
}

impl PayablePayment {
  /// AKA b"payable_payment"
  pub const SEED_PREFIX: &'static [u8] = b"payable_payment";
  // 8  discriminator
  // 32 payable
  // 32 payer (normalized bytes)
  // 8  payable_count
  // 8  chain_count
  // 32 token_mint
  // 8  amount
  // 32 payer_chain_id
  // 32 payer_payment_id
  // 8  created_at
  /// Computed account byte space based on all fields.
  pub const SPACE: usize = 8 + 32 + 32 + 8 + 8 + 32 + 8 + 32 + 32 + 8;
}
