//! `create_payable` — create a new payable (public invoice).

use anchor_lang::prelude::*;

use crate::{
  errors::ChainbillsError,
  events::{CreatedPayable, UserInitialized},
  state::{
    ActivityRecord, ActivityType, Config, Payable, PayableActivityPointer,
    Stats, TokenAndAmount, UserActivityPointer, UserRecord,
  },
  utils::get_current_timestamp,
};

/// Accounts for the `create_payable` instruction.
#[derive(Accounts)]
#[instruction(allowed_tokens_and_amounts: Vec<TokenAndAmount>)]
pub struct CreatePayable<'info> {
  /// The host creating the payable. Must sign. Pays for account rent.
  #[account(mut)]
  pub host: Signer<'info>,

  /// UserRecord for the host. Created if this is their first action.
  #[account(
        init_if_needed,
        payer = host,
        space = UserRecord::SPACE,
        seeds = [UserRecord::SEED_PREFIX, host.key().as_ref()],
        bump,
    )]
  pub user_record: Box<Account<'info, UserRecord>>,

  /// The new Payable PDA. Seeded with host + host's current payables_count.
  #[account(
        init,
        payer = host,
        space = Payable::space_for_ataa(allowed_tokens_and_amounts.len()),
        seeds = [
            Payable::SEED_PREFIX,
            host.key().as_ref(),
            &user_record.payables_count.to_le_bytes(),
        ],
        bump,
    )]
  pub payable: Box<Account<'info, Payable>>,

  /// Vault authority PDA. No data — pure PDA that owns vault ATAs for this
  /// payable. CHECK: PDA with no data, used as ATA authority. Seeds
  /// validated by constraint.
  #[account(
        mut,
        seeds = [Payable::VAULT_SEED_PREFIX, payable.key().as_ref()],
        bump,
    )]
  pub vault_authority: UncheckedAccount<'info>,

  /// Program config — owner not needed here, but stats are split.
  #[account(seeds = [Config::SEED_PREFIX], bump)]
  pub config: Box<Account<'info, Config>>,

  /// Stats — counters incremented here.
  #[account(mut, seeds = [Stats::SEED_PREFIX], bump)]
  pub stats: Box<Account<'info, Stats>>,

  /// Global activity record for this event.
  #[account(
        init,
        payer = host,
        space = ActivityRecord::SPACE,
        seeds = [
            ActivityRecord::SEED_PREFIX,
            ActivityRecord::GLOBAL_PREFIX,
            &stats.total_activities.to_le_bytes(),
        ],
        bump,
    )]
  pub activity_record: Box<Account<'info, ActivityRecord>>,

  /// User-scoped activity pointer.
  #[account(
        init,
        payer = host,
        space = UserActivityPointer::SPACE,
        seeds = [
            UserActivityPointer::SEED_PREFIX,
            UserActivityPointer::USER_PREFIX,
            host.key().as_ref(),
            &user_record.activities_count.to_le_bytes(),
        ],
        bump,
    )]
  pub user_activity_pointer: Box<Account<'info, UserActivityPointer>>,

  /// Payable-scoped activity pointer.
  #[account(
        init,
        payer = host,
        space = PayableActivityPointer::SPACE,
        seeds = [
            PayableActivityPointer::SEED_PREFIX,
            PayableActivityPointer::PAYABLE_PREFIX,
            payable.key().as_ref(),
            &0u64.to_le_bytes(),
        ],
        bump,
    )]
  pub payable_activity_pointer: Box<Account<'info, PayableActivityPointer>>,

  pub system_program: Program<'info, System>,
}

/// Handler for `create_payable`.
///
/// # Arguments
/// * `ctx`                       — accounts
/// * `allowed_tokens_and_amounts` — ATAA list (empty = accept any token/amount)
/// * `is_auto_withdraw`           — if true, each payment triggers immediate
///   withdrawal
pub fn process_create_payable(
  ctx: Context<CreatePayable>,
  allowed_tokens_and_amounts: Vec<TokenAndAmount>,
  is_auto_withdraw: bool,
) -> Result<()> {
  validate_ataa(&allowed_tokens_and_amounts)?;

  let now = get_current_timestamp()?;
  let host = ctx.accounts.host.key();
  let global_activity_index = ctx.accounts.stats.total_activities;

  let user_record = &mut ctx.accounts.user_record;
  if user_record.wallet == Pubkey::default() {
    user_record.wallet = host;
    user_record.created_at = now;
    ctx.accounts.stats.increment_total_users()?;
    // First time this wallet creates anything — record initialization.
    emit!(UserInitialized {
      user: host,
      timestamp: now,
    });
  }

  let payable = &mut ctx.accounts.payable;
  payable.host = host;
  payable.host_count = user_record.payables_count;
  payable.chain_count = ctx.accounts.stats.total_payables;
  payable.created_at = now;
  payable.is_closed = false;
  payable.is_auto_withdraw = is_auto_withdraw;
  payable.payments_count = 0;
  payable.withdrawals_count = 0;
  payable.activities_count = 1;
  payable.allowed_tokens_and_amounts = allowed_tokens_and_amounts;
  payable.balances = Vec::new();

  let payable_key = payable.key();
  let host_count = payable.host_count;
  let chain_count = payable.chain_count;

  let activity = &mut ctx.accounts.activity_record;
  activity.global_index = global_activity_index;
  activity.activity_type = ActivityType::PayableCreated;
  activity.entity = payable_key;
  activity.actor = host;
  activity.timestamp = now;

  ctx.accounts.user_activity_pointer.global_index = global_activity_index;
  ctx.accounts.payable_activity_pointer.global_index = global_activity_index;

  ctx.accounts.user_record.increment_payables()?;
  ctx.accounts.user_record.increment_activities()?;
  ctx.accounts.stats.increment_total_payables()?;
  ctx.accounts.stats.increment_total_activities()?;

  emit!(CreatedPayable {
    payable: payable_key,
    host,
    host_count,
    chain_count,
    timestamp: now,
  });
  msg!(
    "CreatedPayable: payable={} host={} host_count={} chain_count={} \
     ataa_len={} is_auto_withdraw={} timestamp={}",
    payable_key,
    host,
    host_count,
    chain_count,
    ctx.accounts.payable.allowed_tokens_and_amounts.len(),
    is_auto_withdraw,
    now,
  );

  Ok(())
}

fn validate_ataa(ataa: &[TokenAndAmount]) -> Result<()> {
  require!(
    ataa.len() <= crate::constants::MAX_ATAA_COUNT as usize,
    ChainbillsError::MaxAtaaExceeded
  );
  let mut seen = std::collections::HashSet::new();
  for entry in ataa {
    require!(entry.amount > 0, ChainbillsError::ZeroAmount);
    require!(
      seen.insert(entry.token),
      ChainbillsError::DuplicateTokenAndAmount
    );
  }
  Ok(())
}
