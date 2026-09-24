//! # Chainbills — Solana Program
//!
//! Cross-chain payment gateway powered by Wormhole + Circle CCTP.
//! Users create payables (public invoices). Anyone on any supported chain pays.
//! Hosts withdraw funds. 2% fee on withdrawals. Full audit trail on-chain.
//!
//! ## Architecture
//! See `solana/DESIGN.md` for full design, PDA scheme, cross-chain flows,
//! wire format compatibility with EVM, and stack management strategies.
//!
//! ## Cross-chain compatibility
//! `PaymentPayload` (251 bytes) and `PayablePayload` (variable) are
//! byte-for-byte identical to EVM contracts. The same relayer processes VAAs
//! from any chain.
//!
//! ## Program IDs
//! - Devnet:  see `Anchor.toml`
//! - Mainnet: see `solana/DEPLOYED.md` after deployment

use anchor_lang::prelude::*;

pub mod constants;
pub mod cpi;
pub mod errors;
pub mod events;
pub mod instructions;
pub mod payload;
pub mod state;
pub mod utils;

// Re-export to crate root so Anchor's #[program] macro can find all
// generated __client_accounts_* types from each #[derive(Accounts)] struct.
// Must use explicit per-submodule exports — glob chains don't cascade
// the generated __client_accounts_* modules to the crate root.
pub use events::*;
// Instruction accounts structs — each submodule re-exported directly
pub use instructions::admin::*;
pub use instructions::{payable::*, payment::*, relay::*, withdraw::*};
pub use state::*; /* exports Config, Stats, SenderAuthority, and all
                   * other PDAs */

declare_id!("5w94LHNPj1UXDLdvRE4GeQQDNDfHGnVebmBD1hDTdGvX");

#[program]
pub mod chainbills {
  use super::*;

  // ── Admin ──────────────────────────────────────────────────────────────

  /// One-time initialization. Creates GlobalConfig. Only the program's
  /// upgrade authority may call this.
  #[inline(never)]
  pub fn initialize(ctx: Context<Initialize>) -> Result<()> {
    process_initialize(ctx)
  }

  /// Create or update a TokenConfig PDA marking a mint as allowed.
  #[inline(never)]
  pub fn allow_token(
    ctx: Context<AllowToken>,
    max_withdrawal_fee: u64,
  ) -> Result<()> {
    process_allow_token(ctx, max_withdrawal_fee)
  }

  /// Mark a previously allowed token as disallowed.
  #[inline(never)]
  pub fn disallow_token(ctx: Context<DisallowToken>) -> Result<()> {
    process_disallow_token(ctx)
  }

  /// Update global fee settings (fee_bps and fee_collector).
  #[inline(never)]
  pub fn update_fee_settings(
    ctx: Context<UpdateFeeSettings>,
    fee_bps: u16,
  ) -> Result<()> {
    process_update_fee_settings(ctx, fee_bps)
  }

  /// Register a foreign chain with its Wormhole and/or CCTP identifiers.
  #[inline(never)]
  pub fn register_chain(
    ctx: Context<RegisterChain>,
    cb_chain_id: [u8; 32],
    has_wormhole: bool,
    wormhole_chain_id: u16,
    has_cctp: bool,
    circle_domain: u32,
    registered_contract: [u8; 32],
  ) -> Result<()> {
    process_register_chain(
      ctx,
      cb_chain_id,
      has_wormhole,
      wormhole_chain_id,
      has_cctp,
      circle_domain,
      registered_contract,
    )
  }

  /// Update an existing ChainRegistry (add/change Wormhole or CCTP params).
  #[inline(never)]
  pub fn update_chain(
    ctx: Context<UpdateChain>,
    has_wormhole: bool,
    wormhole_chain_id: u16,
    has_cctp: bool,
    circle_domain: u32,
    registered_contract: [u8; 32],
  ) -> Result<()> {
    process_update_chain(
      ctx,
      has_wormhole,
      wormhole_chain_id,
      has_cctp,
      circle_domain,
      registered_contract,
    )
  }

  /// Admin escape hatch: apply a PayablePayload without a VAA.
  /// Used when no common protocol exists between two chains.
  #[inline(never)]
  pub fn admin_sync_foreign_payable(
    ctx: Context<AdminSyncForeignPayable>,
    payable_id: [u8; 32],
    src_cb_chain_id: [u8; 32],
    nonce: u64,
    action_type: u8,
    ataa_data: Vec<u8>,
  ) -> Result<()> {
    process_admin_sync_foreign_payable(
      ctx,
      payable_id,
      src_cb_chain_id,
      nonce,
      action_type,
      ataa_data,
    )
  }

  // ── Payable ────────────────────────────────────────────────────────────

  /// Create a new payable (public invoice). Records PayableCreated activity.
  /// Broadcasts PayablePayload to all registered foreign chains.
  #[inline(never)]
  pub fn create_payable(
    ctx: Context<CreatePayable>,
    allowed_tokens_and_amounts: Vec<TokenAndAmount>,
    is_auto_withdraw: bool,
  ) -> Result<()> {
    process_create_payable(ctx, allowed_tokens_and_amounts, is_auto_withdraw)
  }

  /// Replace the payable's allowed tokens and amounts list. Reallocates
  /// the Payable account if the new list is larger. Broadcasts update.
  #[inline(never)]
  pub fn update_payable_ataa(
    ctx: Context<UpdatePayableAtaa>,
    allowed_tokens_and_amounts: Vec<TokenAndAmount>,
  ) -> Result<()> {
    process_update_payable_ataa(ctx, allowed_tokens_and_amounts)
  }

  /// Flip the auto-withdraw flag. No cross-chain broadcast (local flag only).
  #[inline(never)]
  pub fn update_payable_auto_withdraw(
    ctx: Context<UpdatePayableAutoWithdraw>,
    is_auto_withdraw: bool,
  ) -> Result<()> {
    process_update_payable_auto_withdraw(ctx, is_auto_withdraw)
  }

  /// Close a payable. Broadcasts close to all foreign chains.
  #[inline(never)]
  pub fn close_payable(ctx: Context<ClosePayable>) -> Result<()> {
    process_close_payable(ctx)
  }

  /// Reopen a previously closed payable. Broadcasts reopen to all foreign
  /// chains.
  #[inline(never)]
  pub fn reopen_payable(ctx: Context<ReopenPayable>) -> Result<()> {
    process_reopen_payable(ctx)
  }

  // ── Payment ────────────────────────────────────────────────────────────

  /// Pay a local payable with an SPL Token or Token-2022 token.
  /// If is_auto_withdraw is set, triggers immediate withdrawal.
  #[inline(never)]
  pub fn pay(ctx: Context<Pay>, amount: u64) -> Result<()> {
    process_pay(ctx, amount)
  }

  /// Pay a local payable with native SOL.
  #[inline(never)]
  pub fn pay_native(ctx: Context<PayNative>, amount: u64) -> Result<()> {
    process_pay_native(ctx, amount)
  }

  /// Cross-chain outbound payment (Solana → EVM). Burns USDC via CCTP,
  /// publishes PaymentPayload via Wormhole shim.
  #[inline(never)]
  pub fn pay_foreign_via_cctp<'info>(
    ctx: Context<'_, '_, '_, 'info, PayForeignViaCctp<'info>>,
    foreign_payable_id: [u8; 32],
    dest_cb_chain_id: [u8; 32],
    amount: u64,
    max_fee: u64,
  ) -> Result<()> {
    process_pay_foreign_via_cctp(
      ctx,
      foreign_payable_id,
      dest_cb_chain_id,
      amount,
      max_fee,
    )
  }

  // ── Withdrawal ─────────────────────────────────────────────────────────

  /// Withdraw SPL Token or Token-2022 from a payable. 2% fee (capped per
  /// token).
  #[inline(never)]
  pub fn withdraw(ctx: Context<Withdraw>, amount: u64) -> Result<()> {
    process_withdraw(ctx, amount)
  }

  /// Withdraw native SOL from a payable.
  #[inline(never)]
  pub fn withdraw_native(
    ctx: Context<WithdrawNative>,
    amount: u64,
  ) -> Result<()> {
    process_withdraw_native(ctx, amount)
  }

  // ── Relay ──────────────────────────────────────────────────────────────

  /// EVM → Solana payment receipt via Wormhole VAA + Circle CCTP.
  #[inline(never)]
  pub fn recv_payment_via_cctp_wormhole<'info>(
    ctx: Context<'_, '_, '_, 'info, RecvPaymentViaCctpWormhole<'info>>,
    vaa_hash: [u8; 32],
    payer_chain_id: [u8; 32],
    payer: [u8; 32],
    payment_nonce: u64,
    cctp_burn_nonce: [u8; 32],
    src_domain: u32,
    burn_message: Vec<u8>,
    circle_attestation: Vec<u8>,
  ) -> Result<()> {
    process_recv_payment_via_cctp_wormhole(
      ctx,
      vaa_hash,
      payer_chain_id,
      payer,
      payment_nonce,
      cctp_burn_nonce,
      src_domain,
      burn_message,
      circle_attestation,
    )
  }

  /// EVM → Solana payment receipt via CCTP only (no Wormhole).
  #[inline(never)]
  pub fn recv_payment_via_cctp_only<'info>(
    ctx: Context<'_, '_, '_, 'info, RecvPaymentViaCctpOnly<'info>>,
    src_domain: u32,
    data_nonce: [u8; 32],
    burn_nonce: [u8; 32],
    payer_chain_id: [u8; 32],
    payer: [u8; 32],
    payment_nonce: u64,
    data_message: Vec<u8>,
    data_attestation: Vec<u8>,
    burn_message: Vec<u8>,
    burn_attestation: Vec<u8>,
  ) -> Result<()> {
    process_recv_payment_via_cctp_only(
      ctx,
      src_domain,
      data_nonce,
      burn_nonce,
      payer_chain_id,
      payer,
      payment_nonce,
      data_message,
      data_attestation,
      burn_message,
      burn_attestation,
    )
  }

  /// EVM → Solana payable state sync via Wormhole VAA.
  #[inline(never)]
  pub fn recv_payable_update_via_wormhole(
    ctx: Context<RecvPayableUpdateViaWormhole>,
    vaa_hash: [u8; 32],
  ) -> Result<()> {
    process_recv_payable_update_via_wormhole(ctx, vaa_hash)
  }

  /// EVM → Solana payable state sync via CCTP data message (no Wormhole).
  #[inline(never)]
  pub fn recv_payable_update_via_cctp<'info>(
    ctx: Context<'_, '_, '_, 'info, RecvPayableUpdateViaCctp<'info>>,
    src_domain: u32,
    cctp_nonce: [u8; 32],
    message: Vec<u8>,
    attestation: Vec<u8>,
  ) -> Result<()> {
    process_recv_payable_update_via_cctp(
      ctx,
      src_domain,
      cctp_nonce,
      message,
      attestation,
    )
  }

  /// Broadcast this payable's current state to all registered foreign chains.
  #[inline(never)]
  pub fn broadcast_payable_update<'info>(
    ctx: Context<'_, '_, '_, 'info, BroadcastPayableUpdate<'info>>,
    action_type: u8,
  ) -> Result<()> {
    process_broadcast_payable_update(ctx, action_type)
  }

  /// CCTP MessageTransmitter receiver callback (no-op).
  ///
  /// Called by Circle's MessageTransmitter at the end of `receive_message`
  /// when Chainbills is the designated receiver in a CCTP data message.
  /// State was already recorded before the `receive_message` CPI was issued;
  /// this handler exists solely to satisfy the CCTP callback ABI.
  #[inline(never)]
  pub fn handle_receive_message(
    ctx: Context<HandleReceiveMessage>,
    params: HandleReceiveMessageParams,
  ) -> Result<()> {
    process_handle_receive_message(ctx, params)
  }
}
