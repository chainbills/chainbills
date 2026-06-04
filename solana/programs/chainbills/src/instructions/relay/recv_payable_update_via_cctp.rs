//! `recv_payable_update_via_cctp` — EVM → Solana payable state sync via CCTP
//! data message.
//!
//! ## `remaining_accounts` layout (5 accounts — data receive_message)
//! ```text
//! [0] message_transmitter_program
//! [1] message_transmitter_state  (mut)
//! [2] used_nonce                 (PDA in MessageTransmitter, init)
//! [3] authority_pda              (PDA [b"message_transmitter_authority",
//!                                      chainbills_program] in MT)
//! [4] chainbills_program         (receiver — CCTP calls handle_receive_message)
//! ```

use anchor_lang::prelude::*;

use crate::{
  constants::*,
  errors::ChainbillsError,
  events::ReceivedPayableUpdate,
  payload::{
    decode::decode_payable_payload, encode::PayablePayload,
    wormhole::validate_cctp_transmitter,
  },
  state::{
    CctpDataNonce, ChainRegistry, ForeignPayable, Stats, TokenAndAmountForeign,
  },
  utils::get_current_timestamp,
};

const CCTP_V2_BODY_OFFSET: usize = 148;
const CCTP_SRC_DOMAIN_OFFSET: usize = 4;
const CCTP_NONCE_START: usize = 12;
const CCTP_NONCE_END: usize = 44;
const CCTP_SENDER_START: usize = 44;
const CCTP_SENDER_END: usize = 76;

/// Accounts for `recv_payable_update_via_cctp`.
#[derive(Accounts)]
#[instruction(src_domain: u32, cctp_nonce: [u8; 32])]
pub struct RecvPayableUpdateViaCctp<'info> {
  /// Relayer submitting this message. Must sign. Pays for new PDAs.
  #[account(mut)]
  pub relayer: Signer<'info>,

  /// CHECK: Key validated inside handler.
  pub cctp_program: UncheckedAccount<'info>,

  /// CHECK: Key verified inside handler after parsing message source domain.
  pub chain_registry: UncheckedAccount<'info>,

  /// CHECK: Key validated inside handler from decoded payload.payable_id.
  #[account(mut)]
  pub foreign_payable: UncheckedAccount<'info>,

  /// CctpDataNonce PDA — created here to prevent replay of this CCTP message.
  #[account(
        init,
        payer = relayer,
        space = CctpDataNonce::SPACE,
        seeds = [CctpDataNonce::SEED_PREFIX, &src_domain.to_le_bytes(), &cctp_nonce],
        bump,
    )]
  pub cctp_data_nonce: Account<'info, CctpDataNonce>,

  /// Stats — incremented for received_cctp_update_messages and optionally
  /// total_foreign_payables.
  #[account(mut, seeds = [Stats::SEED_PREFIX], bump)]
  pub stats: Account<'info, Stats>,

  pub system_program: Program<'info, System>,
}

/// Handler for `recv_payable_update_via_cctp`.
pub fn process_recv_payable_update_via_cctp<'info>(
  ctx: Context<'_, '_, '_, 'info, RecvPayableUpdateViaCctp<'info>>,
  src_domain: u32,
  cctp_nonce: [u8; 32],
  message: Vec<u8>,
  attestation: Vec<u8>,
) -> Result<()> {
  let now = get_current_timestamp()?;
  let program_id = ctx.program_id;

  validate_cctp_transmitter(ctx.accounts.cctp_program.key)?;

  require!(
    message.len() > CCTP_V2_BODY_OFFSET,
    ChainbillsError::InvalidPayloadLength
  );

  let parsed_src_domain = u32::from_be_bytes(
    message[CCTP_SRC_DOMAIN_OFFSET..CCTP_SRC_DOMAIN_OFFSET + 4]
      .try_into()
      .unwrap(),
  );
  require!(
    parsed_src_domain == src_domain,
    ChainbillsError::InvalidEmitter
  );

  let mut parsed_nonce = [0u8; 32];
  parsed_nonce.copy_from_slice(&message[CCTP_NONCE_START..CCTP_NONCE_END]);
  require!(parsed_nonce == cctp_nonce, ChainbillsError::InvalidEmitter);

  let mut sender = [0u8; 32];
  sender.copy_from_slice(&message[CCTP_SENDER_START..CCTP_SENDER_END]);

  let chain_registry = {
    let raw = ctx.accounts.chain_registry.try_borrow_data()?;
    ChainRegistry::try_deserialize(&mut &raw[..])?
  };
  require!(chain_registry.has_cctp, ChainbillsError::InvalidEmitter);
  require!(
    chain_registry.circle_domain == src_domain,
    ChainbillsError::InvalidEmitter
  );
  require!(
    chain_registry.registered_contract == sender,
    ChainbillsError::InvalidEmitter
  );

  let (expected_chain_reg, _) = Pubkey::find_program_address(
    &[ChainRegistry::SEED_PREFIX, &chain_registry.cb_chain_id],
    program_id,
  );
  require!(
    expected_chain_reg == ctx.accounts.chain_registry.key(),
    ChainbillsError::InvalidEmitter
  );
  let src_cb_chain_id = chain_registry.cb_chain_id;

  // CPI to CCTP receive_message — verifies attestation and marks Circle's
  // used_nonce PDA. Our program (Chainbills) is the receiver; CCTP will call
  // back into our handle_receive_message (no-op). remaining_accounts[0..5].
  #[cfg(not(feature = "skip-external-cpi"))]
  crate::cpi::cctp::receive_data_message(
    &message,
    &attestation,
    &ctx.accounts.relayer.to_account_info(),
    &ctx.accounts.relayer.to_account_info(), // caller = relayer (destinationCaller)
    &ctx.accounts.system_program.to_account_info(),
    ctx.remaining_accounts,
  )?;
  #[cfg(feature = "skip-external-cpi")]
  msg!("RecvPayableUpdateViaCctp: receive_message CPI skipped (skip-external-cpi)");
  let _ = attestation; // used by CPI above; suppress if cfg-skipped

  let body = &message[CCTP_V2_BODY_OFFSET..];
  require!(
    !body.is_empty() && body[0] == PAYLOAD_TYPE_PAYABLE,
    ChainbillsError::InvalidPayloadType
  );
  let payload = decode_payable_payload(body)?;

  let (expected_fp, fp_bump) = Pubkey::find_program_address(
    &[ForeignPayable::SEED_PREFIX, &payload.payable_id],
    program_id,
  );
  require!(
    expected_fp == ctx.accounts.foreign_payable.key(),
    ChainbillsError::ForeignPayableNotFound
  );

  let is_new_foreign_payable = apply_payable_payload_cctp(
    &ctx,
    &payload,
    src_cb_chain_id,
    expected_fp,
    fp_bump,
    now,
  )?;

  ctx
    .accounts
    .stats
    .increment_received_cctp_update_messages()?;
  if is_new_foreign_payable {
    ctx.accounts.stats.increment_total_foreign_payables()?;
  }

  let cdn = &mut ctx.accounts.cctp_data_nonce;
  cdn.circle_domain = src_domain;
  cdn.nonce = cctp_nonce;
  cdn.processed_at = now;

  emit!(ReceivedPayableUpdate {
    foreign_payable_id: payload.payable_id,
    src_cb_chain_id,
    nonce: payload.nonce,
    action_type: payload.action_type,
    timestamp: now,
  });
  msg!(
    "RecvPayableUpdateViaCctp: payable={:?} chain={:?} nonce={} action={} \
     src_domain={} received_total={} timestamp={}",
    payload.payable_id,
    src_cb_chain_id,
    payload.nonce,
    payload.action_type,
    src_domain,
    ctx.accounts.stats.received_cctp_update_messages,
    now,
  );

  Ok(())
}

fn apply_payable_payload_cctp(
  ctx: &Context<RecvPayableUpdateViaCctp>,
  payload: &PayablePayload,
  src_cb_chain_id: [u8; 32],
  fp_pda: Pubkey,
  fp_bump: u8,
  now: i64,
) -> Result<bool> {
  let fp_info = &ctx.accounts.foreign_payable;
  let program_id = ctx.program_id;
  let relayer_info = &ctx.accounts.relayer;
  let system_program_info = &ctx.accounts.system_program;

  let fp_exists = fp_info.lamports() > 0 && !fp_info.data_is_empty();

  if !fp_exists {
    let ataa_len = payload.allowed_tokens_and_amounts.len();
    let space = ForeignPayable::space_for_ataa(ataa_len);
    let rent = Rent::get()?.minimum_balance(space);

    anchor_lang::solana_program::program::invoke_signed(
      &anchor_lang::solana_program::system_instruction::create_account(
        relayer_info.key,
        &fp_pda,
        rent,
        space as u64,
        program_id,
      ),
      &[
        relayer_info.to_account_info(),
        fp_info.to_account_info(),
        system_program_info.to_account_info(),
      ],
      &[&[ForeignPayable::SEED_PREFIX, &payload.payable_id, &[fp_bump]]],
    )?;

    let fp = ForeignPayable {
      payable_id: payload.payable_id,
      cb_chain_id: src_cb_chain_id,
      is_closed: false,
      is_auto_withdraw: false,
      payable_update_nonce: 0,
      payments_count: 0,
      created_at: now,
      allowed_tokens_and_amounts: Vec::new(),
    };
    let mut data = fp_info.try_borrow_mut_data()?;
    fp.try_serialize(&mut &mut data[..])?;
  }

  let mut fp: ForeignPayable =
    ForeignPayable::try_deserialize(&mut &fp_info.try_borrow_data()?[..])?;

  require!(
    payload.nonce > fp.payable_update_nonce,
    ChainbillsError::StalePayableUpdateNonce
  );

  match payload.action_type {
    ACTION_CREATE | ACTION_UPDATE_ATAA => {
      let new_ataa: Vec<TokenAndAmountForeign> = payload
        .allowed_tokens_and_amounts
        .iter()
        .map(|(token, amount)| TokenAndAmountForeign {
          token: *token,
          amount: *amount,
        })
        .collect();

      if payload.action_type == ACTION_CREATE {
        fp.is_closed = payload.is_closed;
      }

      let new_space = ForeignPayable::space_for_ataa(new_ataa.len());
      let old_space = fp_info.data_len();
      if new_space > old_space {
        let extra_rent = Rent::get()?.minimum_balance(new_space - old_space);
        anchor_lang::solana_program::program::invoke(
          &anchor_lang::solana_program::system_instruction::transfer(
            relayer_info.key,
            &fp_pda,
            extra_rent,
          ),
          &[
            relayer_info.to_account_info(),
            fp_info.to_account_info(),
            system_program_info.to_account_info(),
          ],
        )?;
        fp_info.resize(new_space)?;
      }

      fp.allowed_tokens_and_amounts = new_ataa;
    }
    ACTION_CLOSE => {
      fp.is_closed = payload.is_closed;
    }
    ACTION_REOPEN => {
      fp.is_closed = payload.is_closed;
    }
    _ => return err!(ChainbillsError::InvalidPayloadType),
  }

  fp.payable_update_nonce = payload.nonce;

  let mut data = fp_info.try_borrow_mut_data()?;
  fp.try_serialize(&mut &mut data[..])?;

  Ok(!fp_exists)
}
