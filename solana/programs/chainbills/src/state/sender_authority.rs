//! `SenderAuthority` — keyless PDA that authorizes CCTP `deposit_for_burn`
//! CPIs. Seeds: `[b"sender_authority"]`. One per deployment.
//!
//! Owns `program_usdc_ata` (the intermediate USDC account used in
//! `pay_foreign_via_cctp` before CCTP burns it). No lamports stored; just a PDA
//! signer.
//!
//! Mirrors Circle's own CCTP Solana reference implementation seed convention.

use anchor_lang::prelude::*;

/// Keyless PDA that the program uses to sign CCTP `deposit_for_burn` calls.
///
/// Owns the intermediate `program_usdc_ata` token account. The PDA itself holds
/// no user funds — USDC passes through transiently and is burned atomically.
///
/// Seeds: `[SenderAuthority::SEED_PREFIX]`
#[account]
pub struct SenderAuthority {
  // No data fields — pure PDA signer authority.
}

impl SenderAuthority {
  /// AKA b"sender_authority"
  pub const SEED_PREFIX: &'static [u8] = b"sender_authority";
  // 8  discriminator (only)
  /// Computed account byte space.
  pub const SPACE: usize = 8;
}
