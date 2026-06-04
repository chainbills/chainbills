//! `recv_payable_update_via_wormhole` — EVM → Solana payable state sync via
//! Wormhole VAA.

use anchor_lang::prelude::*;

use crate::{
  constants::*,
  errors::ChainbillsError,
  events::ReceivedPayableUpdate,
  payload::{
    decode::decode_payable_payload,
    wormhole::{
      parse_posted_vaa, validate_wormhole_program, verify_posted_vaa_pda,
    },
  },
  state::{
    ChainRegistry, ConsumedVaa, ForeignPayable, Stats, TokenAndAmountForeign,
  },
  utils::get_current_timestamp,
};

/// Accounts for `recv_payable_update_via_wormhole`.
#[derive(Accounts)]
#[instruction(vaa_hash: [u8; 32])]
pub struct RecvPayableUpdateViaWormhole<'info> {
  /// Relayer submitting this VAA. Must sign. Pays for new PDAs.
  #[account(mut)]
  pub relayer: Signer<'info>,

  /// CHECK: Key validated against known program IDs inside handler.
  pub wormhole_program: UncheckedAccount<'info>,

  /// CHECK: Owned by wormhole_program. PDA verified via vaa_hash inside
  /// handler.
  #[account(
        constraint = posted_vaa.owner == wormhole_program.key
            @ ChainbillsError::InvalidEmitter
    )]
  pub posted_vaa: UncheckedAccount<'info>,

  /// CHECK: Key verified inside handler after parsing VAA emitter chain.
  pub chain_registry: UncheckedAccount<'info>,

  /// CHECK: Key validated inside handler from decoded payload.payable_id.
  #[account(mut)]
  pub foreign_payable: UncheckedAccount<'info>,

  /// ConsumedVaa PDA — created here to prevent replay of this VAA hash.
  #[account(
        init,
        payer = relayer,
        space = ConsumedVaa::SPACE,
        seeds = [ConsumedVaa::SEED_PREFIX, &vaa_hash],
        bump,
    )]
  pub consumed_vaa: Account<'info, ConsumedVaa>,

  /// Stats — incremented for consumed_wormhole_messages and optionally
  /// total_foreign_payables.
  #[account(mut, seeds = [Stats::SEED_PREFIX], bump)]
  pub stats: Account<'info, Stats>,

  pub system_program: Program<'info, System>,
}

/// Handler for `recv_payable_update_via_wormhole`.
///
/// # Arguments
/// * `vaa_hash` — keccak256 of the VAA body; seeds the ConsumedVaa PDA.
pub fn process_recv_payable_update_via_wormhole(
  ctx: Context<RecvPayableUpdateViaWormhole>,
  vaa_hash: [u8; 32],
) -> Result<()> {
  let now = get_current_timestamp()?;
  let program_id = ctx.program_id;

  let wormhole_key = ctx.accounts.wormhole_program.key();
  validate_wormhole_program(&wormhole_key)?;

  verify_posted_vaa_pda(ctx.accounts.posted_vaa.key, &vaa_hash, &wormhole_key)?;

  let vaa_data = {
    let raw = ctx.accounts.posted_vaa.try_borrow_data()?;
    parse_posted_vaa(&raw)?
  };

  let chain_registry = {
    let raw = ctx.accounts.chain_registry.try_borrow_data()?;
    ChainRegistry::try_deserialize(&mut &raw[..])?
  };
  require!(chain_registry.has_wormhole, ChainbillsError::InvalidEmitter);
  require!(
    chain_registry.wormhole_chain_id == vaa_data.emitter_chain,
    ChainbillsError::InvalidVaaEmitterChain
  );
  require!(
    chain_registry.registered_contract == vaa_data.emitter_address,
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

  require!(
    !vaa_data.payload.is_empty() && vaa_data.payload[0] == PAYLOAD_TYPE_PAYABLE,
    ChainbillsError::InvalidPayloadType
  );
  let payload = decode_payable_payload(&vaa_data.payload)?;

  let (expected_fp, fp_bump) = Pubkey::find_program_address(
    &[ForeignPayable::SEED_PREFIX, &payload.payable_id],
    program_id,
  );
  require!(
    expected_fp == ctx.accounts.foreign_payable.key(),
    ChainbillsError::ForeignPayableNotFound
  );

  let is_new_foreign_payable = apply_payable_payload(
    &ctx,
    &payload,
    src_cb_chain_id,
    expected_fp,
    fp_bump,
    now,
  )?;

  ctx.accounts.stats.increment_consumed_wormhole_messages()?;
  if is_new_foreign_payable {
    ctx.accounts.stats.increment_total_foreign_payables()?;
  }

  let cv = &mut ctx.accounts.consumed_vaa;
  cv.vaa_hash = vaa_hash;
  cv.emitter_chain = vaa_data.emitter_chain;
  cv.sequence = vaa_data.sequence;
  cv.payload_type = PAYLOAD_TYPE_PAYABLE;
  cv.processed_at = now;

  emit!(ReceivedPayableUpdate {
    foreign_payable_id: payload.payable_id,
    src_cb_chain_id,
    nonce: payload.nonce,
    action_type: payload.action_type,
    timestamp: now,
  });
  msg!(
    "RecvPayableUpdateViaWormhole: payable={:?} chain={:?} nonce={} \
     action={} vaa_seq={} consumed_total={} timestamp={}",
    payload.payable_id,
    src_cb_chain_id,
    payload.nonce,
    payload.action_type,
    vaa_data.sequence,
    ctx.accounts.stats.consumed_wormhole_messages,
    now,
  );

  Ok(())
}

use crate::payload::encode::PayablePayload;

fn apply_payable_payload(
  ctx: &Context<RecvPayableUpdateViaWormhole>,
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
