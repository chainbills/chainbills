//! `update_payable_ataa` — replace a payable's allowed tokens and amounts list.

use anchor_lang::prelude::*;

use crate::{
  errors::ChainbillsError,
  events::UpdatedPayableAtaa,
  state::{
    ActivityRecord, ActivityType, Payable, PayableActivityPointer, Stats,
    TokenAndAmount, UserActivityPointer, UserRecord,
  },
  utils::get_current_timestamp,
};

/// Accounts for the `update_payable_ataa` instruction.
#[derive(Accounts)]
#[instruction(allowed_tokens_and_amounts: Vec<TokenAndAmount>)]
pub struct UpdatePayableAtaa<'info> {
  /// The host that owns the payable. Must sign. Pays for activity accounts and realloc.
  #[account(mut)]
  pub host: Signer<'info>,

  /// UserRecord for the host — activities_count used for activity pointer seed.
  #[account(
        mut,
        seeds = [UserRecord::SEED_PREFIX, host.key().as_ref()],
        bump,
    )]
  pub user_record: Box<Account<'info, UserRecord>>,

  /// The payable to update. Reallocated to fit the new ATAA list.
  #[account(
        mut,
        seeds = [Payable::SEED_PREFIX, host.key().as_ref(), &payable.host_count.to_le_bytes()],
        bump,
        constraint = payable.host == host.key() @ ChainbillsError::UnauthorizedHost,
        realloc = Payable::space_for_update(
            allowed_tokens_and_amounts.len(),
            payable.balances.len()
        ),
        realloc::payer = host,
        realloc::zero = false,
    )]
  pub payable: Box<Account<'info, Payable>>,

  /// Stats — total_activities used for activity record seed; incremented.
  #[account(mut, seeds = [Stats::SEED_PREFIX], bump)]
  pub stats: Box<Account<'info, Stats>>,

  /// New ActivityRecord PDA for this ATAA update event.
  #[account(
        init, payer = host, space = ActivityRecord::SPACE,
        seeds = [
            ActivityRecord::SEED_PREFIX,
            ActivityRecord::GLOBAL_PREFIX,
            &stats.total_activities.to_le_bytes(),
        ],
        bump,
    )]
  pub activity_record: Box<Account<'info, ActivityRecord>>,

  /// User-scoped activity pointer — links this activity to the host's history.
  #[account(
        init, payer = host, space = UserActivityPointer::SPACE,
        seeds = [
            UserActivityPointer::SEED_PREFIX,
            UserActivityPointer::USER_PREFIX,
            host.key().as_ref(),
            &user_record.activities_count.to_le_bytes(),
        ],
        bump,
    )]
  pub user_activity_pointer: Box<Account<'info, UserActivityPointer>>,

  /// Payable-scoped activity pointer — links this activity to the payable's history.
  #[account(
        init, payer = host, space = PayableActivityPointer::SPACE,
        seeds = [
            PayableActivityPointer::SEED_PREFIX,
            PayableActivityPointer::PAYABLE_PREFIX,
            payable.key().as_ref(),
            &payable.activities_count.to_le_bytes(),
        ],
        bump,
    )]
  pub payable_activity_pointer: Box<Account<'info, PayableActivityPointer>>,

  pub system_program: Program<'info, System>,
}

/// Handler for `update_payable_ataa`.
///
/// # Arguments
/// * `ctx`                       — accounts
/// * `allowed_tokens_and_amounts` — new ATAA list (replaces existing)
pub fn process_update_payable_ataa(
  ctx: Context<UpdatePayableAtaa>,
  allowed_tokens_and_amounts: Vec<TokenAndAmount>,
) -> Result<()> {
  require!(
    allowed_tokens_and_amounts.len()
      <= crate::constants::MAX_ATAA_COUNT as usize,
    ChainbillsError::MaxAtaaExceeded
  );
  for entry in allowed_tokens_and_amounts.iter() {
    require!(entry.amount > 0, ChainbillsError::AtaaAmountZero);
  }

  let now = get_current_timestamp()?;
  let host = ctx.accounts.host.key();
  let payable_key = ctx.accounts.payable.key();
  let global_idx = ctx.accounts.stats.total_activities;

  ctx.accounts.payable.allowed_tokens_and_amounts = allowed_tokens_and_amounts;

  let activity = &mut ctx.accounts.activity_record;
  activity.global_index = global_idx;
  activity.activity_type = ActivityType::PayableAtaaUpdated;
  activity.entity = payable_key;
  activity.actor = host;
  activity.timestamp = now;

  ctx.accounts.user_activity_pointer.global_index = global_idx;
  ctx.accounts.payable_activity_pointer.global_index = global_idx;

  ctx.accounts.user_record.increment_activities()?;
  ctx.accounts.payable.increment_activities()?;
  ctx.accounts.stats.increment_total_activities()?;

  emit!(UpdatedPayableAtaa {
    payable: payable_key,
    host,
    timestamp: now
  });
  msg!("UpdatedPayableATAA: payable={} host={}", payable_key, host);
  Ok(())
}
