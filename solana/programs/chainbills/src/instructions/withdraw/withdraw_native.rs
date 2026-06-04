//! `withdraw_native` — native SOL withdrawal from a payable vault.

use anchor_lang::prelude::*;

use crate::{
  constants::native_sol_mint,
  errors::ChainbillsError,
  events::Withdrew,
  state::{
    ActivityRecord, ActivityType, Config, Payable, PayableActivityPointer,
    Stats, TokenConfig, UserActivityPointer, UserRecord, Withdrawal,
  },
  utils::{compute_fee, get_current_timestamp},
};

/// Accounts for the `withdraw_native` instruction.
#[derive(Accounts)]
pub struct WithdrawNative<'info> {
  /// The payable host making the withdrawal. Must sign. Pays for new PDAs.
  #[account(mut)]
  pub host: Signer<'info>,

  /// UserRecord for the host — activities_count used for pointer seed.
  #[account(mut, seeds = [UserRecord::SEED_PREFIX, host.key().as_ref()], bump)]
  pub user_record: Box<Account<'info, UserRecord>>,

  /// The payable to withdraw from. Must be owned by host.
  #[account(
        mut,
        constraint = payable.host == host.key() @ ChainbillsError::UnauthorizedHost,
        constraint = !payable.is_closed @ ChainbillsError::PayableClosed,
    )]
  pub payable: Box<Account<'info, Payable>>,

  /// CHECK: PDA holds SOL lamports; key validated by seeds.
  #[account(
        mut,
        seeds = [Payable::VAULT_SEED_PREFIX, payable.key().as_ref()],
        bump,
    )]
  pub vault_authority: UncheckedAccount<'info>,

  /// CHECK: fee_collector validated against config
  #[account(mut, constraint = fee_collector.key() == config.fee_collector)]
  pub fee_collector: UncheckedAccount<'info>,

  /// Config — provides fee_bps and fee_collector.
  #[account(seeds = [Config::SEED_PREFIX], bump)]
  pub config: Box<Account<'info, Config>>,

  /// Stats — counters incremented here.
  #[account(mut, seeds = [Stats::SEED_PREFIX], bump)]
  pub stats: Box<Account<'info, Stats>>,

  /// TokenConfig for native SOL — ensures SOL withdrawals are currently allowed.
  #[account(
        seeds = [TokenConfig::SEED_PREFIX, &native_sol_mint().to_bytes()],
        bump,
        constraint = token_config.is_allowed @ ChainbillsError::TokenNotAllowed,
    )]
  pub token_config: Box<Account<'info, TokenConfig>>,

  /// Withdrawal receipt PDA for this withdrawal.
  #[account(
        init, payer = host, space = Withdrawal::SPACE,
        seeds = [Withdrawal::SEED_PREFIX, payable.key().as_ref(), &payable.withdrawals_count.to_le_bytes()],
        bump,
    )]
  pub withdrawal: Box<Account<'info, Withdrawal>>,

  /// ActivityRecord PDA for this withdrawal event.
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

/// Handler for `withdraw_native`.
///
/// # Arguments
/// * `ctx`    — accounts
/// * `amount` — gross lamport amount to withdraw
pub fn process_withdraw_native(
  ctx: Context<WithdrawNative>,
  amount: u64,
) -> Result<()> {
  require!(amount > 0, ChainbillsError::ZeroAmount);

  let sol_mint = native_sol_mint();
  let fee_bps = ctx.accounts.config.fee_bps;
  let max_fee = ctx.accounts.token_config.max_withdrawal_fee;
  let (fees, net_amount) = compute_fee(amount, fee_bps, max_fee)?;

  let balance = ctx
    .accounts
    .payable
    .balances
    .iter()
    .find(|b| b.token == sol_mint)
    .map(|b| b.amount)
    .unwrap_or(0);
  require!(balance >= amount, ChainbillsError::InsufficientBalance);

  let payable_key = ctx.accounts.payable.key();
  let vault_bump = ctx.bumps.vault_authority;
  let vault_seeds: &[&[&[u8]]] =
    &[&[Payable::VAULT_SEED_PREFIX, payable_key.as_ref(), &[
      vault_bump,
    ]]];

  let transfer_net = anchor_lang::solana_program::system_instruction::transfer(
    &ctx.accounts.vault_authority.key(),
    &ctx.accounts.host.key(),
    net_amount,
  );
  anchor_lang::solana_program::program::invoke_signed(
    &transfer_net,
    &[
      ctx.accounts.vault_authority.to_account_info(),
      ctx.accounts.host.to_account_info(),
      ctx.accounts.system_program.to_account_info(),
    ],
    vault_seeds,
  )?;

  if fees > 0 {
    let transfer_fee =
      anchor_lang::solana_program::system_instruction::transfer(
        &ctx.accounts.vault_authority.key(),
        &ctx.accounts.fee_collector.key(),
        fees,
      );
    anchor_lang::solana_program::program::invoke_signed(
      &transfer_fee,
      &[
        ctx.accounts.vault_authority.to_account_info(),
        ctx.accounts.fee_collector.to_account_info(),
        ctx.accounts.system_program.to_account_info(),
      ],
      vault_seeds,
    )?;
  }

  ctx.accounts.payable.deduct_balance(sol_mint, amount)?;
  ctx.accounts.payable.increment_withdrawals()?;
  ctx.accounts.payable.increment_activities()?;

  let now = get_current_timestamp()?;
  let host_key = ctx.accounts.host.key();
  let global_idx = ctx.accounts.stats.total_activities;
  let withdrawal_count = ctx.accounts.payable.withdrawals_count - 1;
  let withdrawal_pda_key = ctx.accounts.withdrawal.key();

  let w = &mut ctx.accounts.withdrawal;
  w.payable = payable_key;
  w.host = host_key;
  w.token_mint = sol_mint;
  w.amount = amount;
  w.fees = fees;
  w.net_amount = net_amount;
  w.withdrawal_count = withdrawal_count;
  w.chain_count = ctx.accounts.stats.total_withdrawals;
  w.created_at = now;

  let activity = &mut ctx.accounts.activity_record;
  activity.global_index = global_idx;
  activity.activity_type = ActivityType::Withdrew;
  activity.entity = withdrawal_pda_key;
  activity.actor = host_key;
  activity.timestamp = now;

  ctx.accounts.user_activity_pointer.global_index = global_idx;
  ctx.accounts.payable_activity_pointer.global_index = global_idx;
  ctx.accounts.user_record.increment_withdrawals()?;
  ctx.accounts.user_record.increment_activities()?;
  ctx.accounts.stats.increment_total_withdrawals()?;
  ctx.accounts.stats.increment_total_activities()?;

  emit!(Withdrew {
    withdrawal: withdrawal_pda_key,
    payable: payable_key,
    host: host_key,
    token: sol_mint,
    amount,
    fees,
    net_amount,
    timestamp: now,
  });
  msg!(
    "WithdrewNative: payable={} host={} amount={} fees={} net={} \
     chain_count={} timestamp={}",
    payable_key,
    host_key,
    amount,
    fees,
    net_amount,
    w.chain_count,
    now,
  );

  Ok(())
}
