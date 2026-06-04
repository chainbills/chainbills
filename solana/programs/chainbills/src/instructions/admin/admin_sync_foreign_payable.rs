//! `admin_sync_foreign_payable` — owner-only escape hatch to apply a
//! PayablePayload without a Wormhole VAA. Used when no common messaging
//! protocol exists between chains, or as a manual fallback when relay
//! infrastructure is unavailable.

use anchor_lang::prelude::*;

use crate::{
  errors::ChainbillsError,
  events::ReceivedPayableUpdate,
  payload::decode::decode_payable_payload,
  state::{Config, ForeignPayable, Stats, TokenAndAmountForeign},
  utils::get_current_timestamp,
};

/// Accounts for the `admin_sync_foreign_payable` instruction.
#[derive(Accounts)]
#[instruction(payable_id: [u8; 32])]
pub struct AdminSyncForeignPayable<'info> {
  /// The program owner. Must sign.
  #[account(mut)]
  pub owner: Signer<'info>,

  /// Config — validates owner.
  #[account(
        seeds = [Config::SEED_PREFIX],
        bump,
        constraint = config.owner == owner.key() @ ChainbillsError::UnauthorizedOwner,
    )]
  pub config: Account<'info, Config>,

  /// Stats — incremented when a new ForeignPayable is created.
  #[account(mut, seeds = [Stats::SEED_PREFIX], bump)]
  pub stats: Account<'info, Stats>,

  /// ForeignPayable PDA for the given payable_id. Created if it doesn't exist.
  #[account(
        init_if_needed,
        payer = owner,
        space = ForeignPayable::space_for_ataa(0),
        seeds = [ForeignPayable::SEED_PREFIX, &payable_id],
        bump,
    )]
  pub foreign_payable: Account<'info, ForeignPayable>,

  pub system_program: Program<'info, System>,
}

/// Handler for `admin_sync_foreign_payable`.
///
/// Applies a payable update without requiring a Wormhole VAA or CCTP message.
/// Same nonce check as the Wormhole receive path — cannot regress state.
///
/// # Arguments
/// * `ctx`             — accounts
/// * `payable_id`      — the foreign chain's identifier for this payable (32
///   bytes)
/// * `src_cb_chain_id` — cbChainId of the chain where this payable lives
/// * `nonce`           — the update nonce (must be > stored nonce)
/// * `action_type`     — 1=Create, 2=Close, 3=Reopen, 4=UpdateATAA
/// * `ataa_data`       — raw encoded ATAA bytes (for action_type 1 or 4), or
///   empty
pub fn process_admin_sync_foreign_payable(
  ctx: Context<AdminSyncForeignPayable>,
  payable_id: [u8; 32],
  src_cb_chain_id: [u8; 32],
  nonce: u64,
  action_type: u8,
  ataa_data: Vec<u8>,
) -> Result<()> {
  let now = get_current_timestamp()?;
  let fp = &mut ctx.accounts.foreign_payable;
  let is_new = fp.payable_id == [0u8; 32];

  // Stale nonce check — same as Wormhole path
  require!(
    nonce > fp.payable_update_nonce,
    ChainbillsError::StalePayableUpdateNonce
  );

  // Initialize if first time
  if is_new {
    fp.payable_id = payable_id;
    fp.cb_chain_id = src_cb_chain_id;
    fp.created_at = now;
  }

  // Build a minimal synthetic payload to reuse decode logic
  let mut synthetic = Vec::with_capacity(51 + ataa_data.len());
  synthetic.push(0x01); // PAYLOAD_TYPE_PAYABLE
  synthetic.push(0x01); // PAYLOAD_VERSION
  synthetic.push(action_type);
  synthetic.extend_from_slice(&payable_id);
  synthetic.extend_from_slice(&nonce.to_be_bytes());
  synthetic.extend_from_slice(&(now as u64).to_be_bytes());
  synthetic.extend_from_slice(&ataa_data);

  let payload = decode_payable_payload(&synthetic)?;

  match action_type {
    1 | 4 => {
      let new_space = ForeignPayable::space_for_ataa(
        payload.allowed_tokens_and_amounts.len(),
      );
      let fp_account = ctx.accounts.foreign_payable.to_account_info();
      fp_account.resize(new_space)?;

      let fp = &mut ctx.accounts.foreign_payable;
      fp.allowed_tokens_and_amounts = payload
        .allowed_tokens_and_amounts
        .iter()
        .map(|(token, amount)| TokenAndAmountForeign {
          token: *token,
          amount: *amount,
        })
        .collect();
    }
    2 => {
      ctx.accounts.foreign_payable.is_closed = true;
    }
    3 => {
      ctx.accounts.foreign_payable.is_closed = false;
    }
    _ => return err!(ChainbillsError::InvalidPayloadType),
  }

  ctx.accounts.foreign_payable.payable_update_nonce = nonce;

  if is_new {
    ctx.accounts.stats.increment_total_foreign_payables()?;
  }

  emit!(ReceivedPayableUpdate {
    foreign_payable_id: payable_id,
    src_cb_chain_id,
    nonce,
    action_type,
    timestamp: now,
  });
  msg!(
    "AdminSyncForeignPayable: payable_id={:?} src_chain={:?} action={} \
     nonce={} owner={} timestamp={}",
    payable_id,
    src_cb_chain_id,
    action_type,
    nonce,
    ctx.accounts.owner.key(),
    now,
  );

  Ok(())
}
