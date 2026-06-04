//! `pay_native` — same-chain native SOL payment to a local payable.

use anchor_lang::prelude::*;

use crate::{
  constants::native_sol_mint,
  errors::ChainbillsError,
  events::{PayableReceived, UserInitialized, UserPaid},
  state::{
    ActivityRecord, ActivityType, Config, Payable, PayableActivityPointer,
    PayablePayment, Stats, TokenConfig, UserActivityPointer, UserPayment,
    UserRecord,
  },
  utils::{get_current_timestamp, normalize_pubkey},
};

/// Accounts for the `pay_native` instruction.
#[derive(Accounts)]
pub struct PayNative<'info> {
  /// The payer making the SOL payment. Must sign. Pays for new PDAs.
  #[account(mut)]
  pub payer: Signer<'info>,

  /// UserRecord for the payer. Created on first interaction.
  #[account(
        init_if_needed,
        payer = payer,
        space = UserRecord::SPACE,
        seeds = [UserRecord::SEED_PREFIX, payer.key().as_ref()],
        bump,
    )]
  pub user_record: Box<Account<'info, UserRecord>>,

  /// The target payable. Must not be closed.
  #[account(
        mut,
        constraint = !payable.is_closed @ ChainbillsError::PayableClosed,
    )]
  pub payable: Box<Account<'info, Payable>>,

  /// CHECK: PDA accumulates lamports; key validated by seeds.
  #[account(
        mut,
        seeds = [Payable::VAULT_SEED_PREFIX, payable.key().as_ref()],
        bump,
    )]
  pub vault_authority: UncheckedAccount<'info>,

  /// Config — provides cb_chain_id.
  #[account(seeds = [Config::SEED_PREFIX], bump)]
  pub config: Box<Account<'info, Config>>,

  /// Stats — counters incremented here.
  #[account(mut, seeds = [Stats::SEED_PREFIX], bump)]
  pub stats: Box<Account<'info, Stats>>,

  /// TokenConfig for native SOL — ensures SOL payments are currently allowed.
  #[account(
        seeds = [TokenConfig::SEED_PREFIX, &native_sol_mint().to_bytes()],
        bump,
        constraint = token_config.is_allowed @ ChainbillsError::TokenNotAllowed,
    )]
  pub token_config: Box<Account<'info, TokenConfig>>,

  /// UserPayment receipt PDA for the payer.
  #[account(
        init, payer = payer, space = UserPayment::SPACE,
        seeds = [UserPayment::SEED_PREFIX, payer.key().as_ref(), &user_record.payments_count.to_le_bytes()],
        bump,
    )]
  pub user_payment: Box<Account<'info, UserPayment>>,

  /// PayablePayment receipt PDA for the payable.
  #[account(
        init, payer = payer, space = PayablePayment::SPACE,
        seeds = [PayablePayment::SEED_PREFIX, payable.key().as_ref(), &payable.payments_count.to_le_bytes()],
        bump,
    )]
  pub payable_payment: Box<Account<'info, PayablePayment>>,

  /// ActivityRecord PDA for this payment event.
  #[account(
        init, payer = payer, space = ActivityRecord::SPACE,
        seeds = [
            ActivityRecord::SEED_PREFIX,
            ActivityRecord::GLOBAL_PREFIX,
            &stats.total_activities.to_le_bytes(),
        ],
        bump,
    )]
  pub activity_record: Box<Account<'info, ActivityRecord>>,

  /// User-scoped activity pointer — links this activity to the payer's history.
  #[account(
        init, payer = payer, space = UserActivityPointer::SPACE,
        seeds = [
            UserActivityPointer::SEED_PREFIX,
            UserActivityPointer::USER_PREFIX,
            payer.key().as_ref(),
            &user_record.activities_count.to_le_bytes(),
        ],
        bump,
    )]
  pub user_activity_pointer: Box<Account<'info, UserActivityPointer>>,

  /// Payable-scoped activity pointer — links this activity to the payable's history.
  #[account(
        init, payer = payer, space = PayableActivityPointer::SPACE,
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

/// Handler for `pay_native`.
///
/// # Arguments
/// * `ctx`    — accounts
/// * `amount` — lamports to pay
pub fn process_pay_native(ctx: Context<PayNative>, amount: u64) -> Result<()> {
  require!(amount > 0, ChainbillsError::ZeroAmount);

  let sol_mint = native_sol_mint();

  if !ctx.accounts.payable.allowed_tokens_and_amounts.is_empty() {
    let valid = ctx
      .accounts
      .payable
      .allowed_tokens_and_amounts
      .iter()
      .any(|e| e.token == sol_mint && amount >= e.amount);
    require!(valid, ChainbillsError::TokenAmountMismatch);
  }

  let ix = anchor_lang::solana_program::system_instruction::transfer(
    &ctx.accounts.payer.key(),
    &ctx.accounts.vault_authority.key(),
    amount,
  );
  anchor_lang::solana_program::program::invoke(&ix, &[
    ctx.accounts.payer.to_account_info(),
    ctx.accounts.vault_authority.to_account_info(),
    ctx.accounts.system_program.to_account_info(),
  ])?;

  let now = get_current_timestamp()?;
  let payer_key = ctx.accounts.payer.key();
  let payable_key = ctx.accounts.payable.key();
  let cb_chain_id = ctx.accounts.config.cb_chain_id;
  let global_idx = ctx.accounts.stats.total_activities;

  let has_sol = ctx
    .accounts
    .payable
    .balances
    .iter()
    .any(|b| b.token == sol_mint);
  if !has_sol {
    let new_space = ctx.accounts.payable.space_for_new_balance();
    let rent = Rent::get()?;
    let new_min_lamports = rent.minimum_balance(new_space);
    let current_lamports = ctx.accounts.payable.get_lamports();
    if new_min_lamports > current_lamports {
      let diff = new_min_lamports - current_lamports;
      anchor_lang::solana_program::program::invoke(
        &anchor_lang::solana_program::system_instruction::transfer(
          &ctx.accounts.payer.key(),
          &ctx.accounts.payable.key(),
          diff,
        ),
        &[
          ctx.accounts.payer.to_account_info(),
          ctx.accounts.payable.to_account_info(),
          ctx.accounts.system_program.to_account_info(),
        ],
      )?;
    }
    ctx.accounts.payable.to_account_info().resize(new_space)?;
  }

  ctx.accounts.payable.add_to_balance(sol_mint, amount)?;
  ctx.accounts.payable.increment_payments()?;
  ctx.accounts.payable.increment_activities()?;

  let user_record = &mut ctx.accounts.user_record;
  if user_record.wallet == Pubkey::default() {
    user_record.wallet = payer_key;
    user_record.created_at = now;
    ctx.accounts.stats.increment_total_users()?;
    // First time this wallet pays native SOL — record initialization.
    emit!(UserInitialized {
      user: payer_key,
      timestamp: now,
    });
  }
  let payer_count = user_record.payments_count;
  user_record.increment_payments()?;
  user_record.increment_activities()?;

  let payable_count = ctx.accounts.payable.payments_count - 1;
  let payment_pda_key = ctx.accounts.user_payment.key();

  let up = &mut ctx.accounts.user_payment;
  up.payer = payer_key;
  up.payable = payable_key;
  up.payer_count = payer_count;
  up.chain_count = ctx.accounts.stats.total_user_payments;
  up.token_mint = sol_mint;
  up.amount = amount;
  up.payable_chain_id = cb_chain_id;
  up.payer_chain_id = cb_chain_id;
  up.created_at = now;

  let pp = &mut ctx.accounts.payable_payment;
  pp.payable = payable_key;
  pp.payer = normalize_pubkey(&payer_key);
  pp.payable_count = payable_count;
  pp.chain_count = ctx.accounts.stats.total_payable_payments;
  pp.token_mint = sol_mint;
  pp.amount = amount;
  pp.payer_chain_id = cb_chain_id;
  pp.payer_payment_id = normalize_pubkey(&payment_pda_key);
  pp.created_at = now;

  let activity = &mut ctx.accounts.activity_record;
  activity.global_index = global_idx;
  activity.activity_type = ActivityType::UserPaid;
  activity.entity = payment_pda_key;
  activity.actor = payer_key;
  activity.timestamp = now;

  ctx.accounts.user_activity_pointer.global_index = global_idx;
  ctx.accounts.payable_activity_pointer.global_index = global_idx;

  ctx.accounts.stats.increment_total_user_payments()?;
  ctx.accounts.stats.increment_total_payable_payments()?;
  ctx.accounts.stats.increment_total_activities()?;

  emit!(UserPaid {
    payment: payment_pda_key,
    payer: payer_key,
    payable: payable_key,
    token: sol_mint,
    amount,
    timestamp: now,
  });
  emit!(PayableReceived {
    payment: ctx.accounts.payable_payment.key(),
    payable: payable_key,
    payer: normalize_pubkey(&payer_key),
    token: sol_mint,
    amount,
    timestamp: now,
  });
  msg!(
    "PayNative: payer={} payable={} amount={} lamports payer_count={} \
     chain_count={} timestamp={}",
    payer_key,
    payable_key,
    amount,
    payer_count,
    up.chain_count,
    now,
  );

  Ok(())
}
