//! Shared utility functions used across multiple instruction handlers.

use anchor_lang::prelude::*;

use crate::errors::ChainbillsError;

/// Compute the withdrawal fee and net amount for a given gross amount.
///
/// Formula: `fee = min(amount * fee_bps / 10_000, max_fee)`, `net = amount -
/// fee`.
///
/// Returns `(fees, net_amount)`. Both are guaranteed non-negative.
/// Returns `Err(MathOverflow)` if any intermediate value overflows u128.
///
/// # Arguments
/// * `amount`   — gross withdrawal amount in token base units
/// * `fee_bps`  — fee in basis points (200 = 2%)
/// * `max_fee`  — maximum fee cap in token base units (from TokenConfig)
pub fn compute_fee(
  amount: u64,
  fee_bps: u16,
  max_fee: u64,
) -> Result<(u64, u64)> {
  let amount_u128 = amount as u128;
  let fee_bps_u128 = fee_bps as u128;
  let max_fee_u128 = max_fee as u128;

  let percent = amount_u128
    .checked_mul(fee_bps_u128)
    .ok_or(ChainbillsError::MathOverflow)?
    .checked_div(10_000)
    .ok_or(ChainbillsError::MathOverflow)?;

  let fee_u128 = percent.min(max_fee_u128);
  let net_u128 = amount_u128
    .checked_sub(fee_u128)
    .ok_or(ChainbillsError::MathUnderflow)?;

  Ok((fee_u128 as u64, net_u128 as u64))
}

/// Convert a Solana `Pubkey` to its raw 32-byte representation.
///
/// Solana pubkeys are already 32 bytes, so this is a direct `to_bytes()`.
/// Matches EVM's `toWormholeFormat()` which left-pads 20-byte addresses to 32
/// bytes — on Solana no padding is needed.
///
/// # Arguments
/// * `pubkey` — the Solana public key to normalize
pub fn normalize_pubkey(pubkey: &Pubkey) -> [u8; 32] { pubkey.to_bytes() }

/// Assert that an amount is non-zero.
///
/// Returns `Err(ZeroAmount)` if `amount == 0`.
///
/// # Arguments
/// * `amount` — the value to check
pub fn assert_not_zero(amount: u64) -> Result<()> {
  require!(amount > 0, ChainbillsError::ZeroAmount);
  Ok(())
}

/// Get the current Unix timestamp from the Solana `Clock` sysvar.
///
/// Returns `i64` (signed, matching Solana's `UnixTimestamp` type).
/// Will fail if the Clock sysvar is unavailable (never happens on-chain).
pub fn get_current_timestamp() -> Result<i64> {
  Ok(Clock::get()?.unix_timestamp)
}

#[cfg(test)]
mod tests {
  use super::*;

  #[test]
  fn test_compute_fee_2pct() {
    // 2% of 10_000 = 200, max_fee = 1_000 → fee = 200
    let (fee, net) = compute_fee(10_000, 200, 1_000).unwrap();
    assert_eq!(fee, 200);
    assert_eq!(net, 9_800);
  }

  #[test]
  fn test_compute_fee_cap_applied() {
    // 2% of 1_000_000 = 20_000, max_fee = 5_000 → fee = 5_000
    let (fee, net) = compute_fee(1_000_000, 200, 5_000).unwrap();
    assert_eq!(fee, 5_000);
    assert_eq!(net, 995_000);
  }

  #[test]
  fn test_compute_fee_zero_max() {
    // max_fee = 0 → fee always 0
    let (fee, net) = compute_fee(100_000, 200, 0).unwrap();
    assert_eq!(fee, 0);
    assert_eq!(net, 100_000);
  }

  #[test]
  fn test_normalize_pubkey_is_32_bytes() {
    let pk = Pubkey::default();
    let bytes = normalize_pubkey(&pk);
    assert_eq!(bytes.len(), 32);
    assert_eq!(bytes, [0u8; 32]);
  }

  #[test]
  fn test_assert_not_zero_passes() {
    assert!(assert_not_zero(1).is_ok());
    assert!(assert_not_zero(u64::MAX).is_ok());
  }

  #[test]
  fn test_assert_not_zero_rejects() {
    assert!(assert_not_zero(0).is_err());
  }
}
