//! `broadcast_payable_update` — push a payable's current state to all
//! registered foreign chains.
//!
//! Mirrors EVM `_broadcastPayableUpdate`: dispatches via both Wormhole (if
//! `config.has_wormhole`) and CCTP (if `config.has_cctp`). Single Wormhole VAA
//! covers all Wormhole chains; one CCTP `sendMessage` per registered CCTP chain
//! (including Wormhole chains, for redundancy).
//!
//! ## `remaining_accounts` layout
//!
//! ```text
//! [wh_start .. wh_start+8]   — 8 Wormhole shim accounts (if config.has_wormhole)
//!                               see cpi::wormhole module for account order
//!
//! [cctp_start .. end]        — N × 3 per-chain CCTP accounts (if config.has_cctp)
//!   per chain chunk [n]:
//!     [cctp_start + n*3 + 0]  chain_registry PDA (read — provides circle_domain +
//!                              registered_contract; program validates PDA key)
//!     [cctp_start + n*3 + 1]  message_sent_event_data (new Keypair, signer)
//!     [cctp_start + n*3 + 2]  message_transmitter_state (CCTP MT state, mut)
//!
//! Where:
//!   wh_start   = 0
//!   cctp_start = 8 if config.has_wormhole else 0
//! ```
//!
//! N must equal `stats.registered_cctp_chain_count`. The program validates
//! each chain_registry is the canonical PDA for its cb_chain_id.

use anchor_lang::prelude::*;

use crate::{
  constants::*,
  errors::ChainbillsError,
  events::PayableUpdateBroadcasted,
  payload::encode::{encode_payable_payload, PayablePayload},
  state::{Config, Payable, SenderAuthority, Stats},
  utils::{get_current_timestamp, normalize_pubkey},
};

#[cfg(not(feature = "skip-external-cpi"))]
use crate::state::ChainRegistry;

/// Accounts for `broadcast_payable_update`.
#[derive(Accounts)]
pub struct BroadcastPayableUpdate<'info> {
  /// The host or program owner calling the broadcast. Must sign. Pays rent
  /// for Wormhole fee and CCTP event accounts.
  #[account(mut)]
  pub authority: Signer<'info>,

  /// The payable to broadcast. Authority must be host or owner.
  #[account(
        constraint = (
            payable.host == authority.key() || config.owner == authority.key()
        ) @ ChainbillsError::UnauthorizedHost,
    )]
  pub payable: Box<Account<'info, Payable>>,

  /// Config — provides has_wormhole/has_cctp flags and nonce counter.
  #[account(mut, seeds = [Config::SEED_PREFIX], bump)]
  pub config: Box<Account<'info, Config>>,

  /// Stats — incremented on successful broadcasts + used to validate
  /// that all CCTP chains are covered in remaining_accounts.
  #[account(mut, seeds = [Stats::SEED_PREFIX], bump)]
  pub stats: Box<Account<'info, Stats>>,

  /// Sender authority PDA — signs Wormhole post_message and CCTP send_message.
  #[account(seeds = [SenderAuthority::SEED_PREFIX], bump)]
  pub sender_authority: Box<Account<'info, SenderAuthority>>,

  /// CCTP MessageTransmitter program — used for send_message CPIs.
  /// CHECK: key validated against known CCTP program IDs at CPI call time.
  pub message_transmitter_program: UncheckedAccount<'info>,

  /// Chainbills program itself — passed as sender_program to CCTP send_message
  /// so Circle can verify the sender_authority_pda derivation.
  /// CHECK: caller provides correct program ID; sender_authority seeds enforce correctness.
  pub chainbills_program: UncheckedAccount<'info>,

  pub system_program: Program<'info, System>,
  // remaining_accounts: Wormhole shim accounts + per-chain CCTP accounts
}

/// Handler for `broadcast_payable_update`.
///
/// # Arguments
/// * `ctx`         — accounts
/// * `action_type` — 1=Create/snapshot, 2=Close, 3=Reopen, 4=UpdateATAA
pub fn process_broadcast_payable_update<'info>(
  ctx: Context<'_, '_, '_, 'info, BroadcastPayableUpdate<'info>>,
  action_type: u8,
) -> Result<()> {
  require!(
    action_type >= 1 && action_type <= 4,
    ChainbillsError::InvalidPayloadType
  );

  let now = get_current_timestamp()?;
  let payable = &ctx.accounts.payable;
  let payable_key = payable.key();

  // Assign monotonically increasing nonce.
  let nonce = ctx.accounts.config.next_payable_update_nonce()?;

  // ── Build PayablePayload ──────────────────────────────────────────────────
  let (ataa, is_closed) = match action_type {
    ACTION_CREATE | ACTION_UPDATE_ATAA => {
      let foreign_ataa: Vec<([u8; 32], u64)> = payable
        .allowed_tokens_and_amounts
        .iter()
        .map(|entry| (normalize_pubkey(&entry.token), entry.amount))
        .collect();
      (foreign_ataa, payable.is_closed)
    }
    ACTION_CLOSE => (Vec::new(), true),
    ACTION_REOPEN => (Vec::new(), false),
    _ => return err!(ChainbillsError::InvalidPayloadType),
  };

  let encoded_payload = encode_payable_payload(&PayablePayload {
    action_type,
    payable_id: payable_key.to_bytes(),
    nonce,
    initiated_at: now,
    allowed_tokens_and_amounts: ataa,
    is_closed,
  })?;

  #[cfg(not(feature = "skip-external-cpi"))]
  let sender_authority_bump = ctx.bumps.sender_authority;

  // ── Protocol dispatch (mirrors EVM _broadcastPayableUpdate) ──────────────
  //
  // Wormhole: single post_message reaches ALL Wormhole-capable chains at once.
  // CCTP:     one send_message per chain (even Wormhole chains receive a CCTP
  //           copy for redundancy).

  // rem_idx tracks where CCTP chunks start in remaining_accounts.
  // In skip-external-cpi mode, no Wormhole accounts are consumed so CCTP
  // chunks start at [0]; in production they start at [8].
  #[cfg(not(feature = "skip-external-cpi"))]
  let mut rem_idx: usize = 0;

  if ctx.accounts.config.has_wormhole {
    #[cfg(not(feature = "skip-external-cpi"))]
    {
      require!(
        ctx.remaining_accounts.len() >= 8,
        ChainbillsError::MissingRemainingAccounts
      );
      crate::cpi::wormhole::post_message(
        0,
        &encoded_payload,
        &ctx.accounts.authority.to_account_info(),
        &ctx.accounts.sender_authority.to_account_info(),
        &ctx.accounts.system_program.to_account_info(),
        &ctx.remaining_accounts[0..8],
        sender_authority_bump,
      )?;
      rem_idx = 8;
    }
    #[cfg(feature = "skip-external-cpi")]
    msg!("BroadcastPayableUpdate: post_message CPI skipped (skip-external-cpi)");
    ctx.accounts.stats.increment_published_wormhole_messages()?;
  }

  if ctx.accounts.config.has_cctp {
    let chain_count = ctx.accounts.stats.registered_cctp_chain_count as usize;

    #[cfg(not(feature = "skip-external-cpi"))]
    {
      let expected_rem = rem_idx + chain_count * 3;
      require!(
        ctx.remaining_accounts.len() >= expected_rem,
        ChainbillsError::MissingRemainingAccounts
      );

      let program_id = ctx.program_id;

      for i in 0..chain_count {
        let chunk_start = rem_idx + i * 3;
        let chain_reg_info = &ctx.remaining_accounts[chunk_start];
        let event_data_info = &ctx.remaining_accounts[chunk_start + 1];
        let mt_state_info = &ctx.remaining_accounts[chunk_start + 2];

        let chain_reg: ChainRegistry =
          ChainRegistry::try_deserialize(&mut &chain_reg_info.try_borrow_data()?[..])?;
        require!(chain_reg.has_cctp, ChainbillsError::InvalidRemainingAccount);
        let (expected_pda, _) = Pubkey::find_program_address(
          &[ChainRegistry::SEED_PREFIX, &chain_reg.cb_chain_id],
          program_id,
        );
        require!(
          expected_pda == chain_reg_info.key(),
          ChainbillsError::InvalidRemainingAccount
        );

        crate::cpi::cctp::send_message(
          chain_reg.circle_domain,
          chain_reg.registered_contract,
          chain_reg.registered_contract,
          0,
          &encoded_payload,
          &ctx.accounts.authority.to_account_info(),
          &ctx.accounts.sender_authority.to_account_info(),
          &ctx.accounts.system_program.to_account_info(),
          mt_state_info,
          event_data_info,
          &ctx.accounts.chainbills_program.to_account_info(),
          &ctx.accounts.message_transmitter_program.to_account_info(),
          sender_authority_bump,
        )?;

        ctx.accounts.stats.increment_emitted_cctp_update_messages()?;
      }
    }

    // In skip-external-cpi mode just increment counters for all registered chains.
    #[cfg(feature = "skip-external-cpi")]
    for _ in 0..chain_count {
      ctx.accounts.stats.increment_emitted_cctp_update_messages()?;
      msg!("BroadcastPayableUpdate: send_message CPI skipped (skip-external-cpi)");
    }
  }

  let _ = encoded_payload; // used above; suppress if both cfg-skipped

  emit!(PayableUpdateBroadcasted {
    payable: payable_key,
    nonce,
    action_type,
    timestamp: now,
  });
  msg!(
    "BroadcastPayableUpdate: payable={} action={} nonce={} \
     has_wormhole={} has_cctp={} timestamp={}",
    payable_key,
    action_type,
    nonce,
    ctx.accounts.config.has_wormhole,
    ctx.accounts.config.has_cctp,
    now,
  );
  Ok(())
}
