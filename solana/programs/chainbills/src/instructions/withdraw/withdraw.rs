//! `withdraw` — SPL Token or Token-2022 withdrawal from a payable vault.

use anchor_lang::prelude::*;
use anchor_spl::{
  associated_token::AssociatedToken,
  token_interface::{
    transfer_checked, Mint, TokenAccount, TokenInterface, TransferChecked,
  },
};

use crate::{
  errors::ChainbillsError,
  events::Withdrew,
  state::{
    ActivityRecord, ActivityType, Config, Payable, PayableActivityPointer,
    Stats, TokenConfig, UserActivityPointer, UserRecord, Withdrawal,
  },
  utils::{compute_fee, get_current_timestamp},
};

/// Accounts for the `withdraw` instruction.
#[derive(Accounts)]
pub struct Withdraw<'info> {
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

  /// CHECK: PDA with no data; key validated by seeds.
  #[account(
        seeds = [Payable::VAULT_SEED_PREFIX, payable.key().as_ref()],
        bump,
    )]
  pub vault_authority: UncheckedAccount<'info>,

  /// Vault ATA — source of the tokens being withdrawn.
  #[account(
        mut,
        associated_token::mint = token_mint,
        associated_token::authority = vault_authority,
        associated_token::token_program = token_program,
    )]
  pub vault_token_account: Box<InterfaceAccount<'info, TokenAccount>>,

  /// Host's token ATA — receives the net amount after fee deduction.
  #[account(
        init_if_needed,
        payer = host,
        associated_token::mint = token_mint,
        associated_token::authority = host,
        associated_token::token_program = token_program,
    )]
  pub host_token_account: Box<InterfaceAccount<'info, TokenAccount>>,

  /// Fee collector's token ATA — receives the 2% fee.
  #[account(
        init_if_needed,
        payer = host,
        associated_token::mint = token_mint,
        associated_token::authority = fee_collector,
        associated_token::token_program = token_program,
    )]
  pub fee_collector_token_account: Box<InterfaceAccount<'info, TokenAccount>>,

  /// CHECK: fee_collector validated against config
  #[account(constraint = fee_collector.key() == config.fee_collector)]
  pub fee_collector: UncheckedAccount<'info>,

  /// The token mint being withdrawn.
  pub token_mint: Box<InterfaceAccount<'info, Mint>>,

  /// Config — provides fee_bps and fee_collector.
  #[account(seeds = [Config::SEED_PREFIX], bump)]
  pub config: Box<Account<'info, Config>>,

  /// Stats — counters incremented here.
  #[account(mut, seeds = [Stats::SEED_PREFIX], bump)]
  pub stats: Box<Account<'info, Stats>>,

  /// TokenConfig for the mint — ensures token is currently allowed.
  #[account(
        seeds = [TokenConfig::SEED_PREFIX, token_mint.key().as_ref()],
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

  pub token_program: Interface<'info, TokenInterface>,
  pub associated_token_program: Program<'info, AssociatedToken>,
  pub system_program: Program<'info, System>,
}

/// Handler for `withdraw`.
///
/// # Arguments
/// * `ctx`    — accounts
/// * `amount` — gross withdrawal amount in token base units
pub fn process_withdraw(ctx: Context<Withdraw>, amount: u64) -> Result<()> {
  require!(amount > 0, ChainbillsError::ZeroAmount);

  let token_mint_key = ctx.accounts.token_mint.key();
  let decimals = ctx.accounts.token_mint.decimals;
  let fee_bps = ctx.accounts.config.fee_bps;
  let max_fee = ctx.accounts.token_config.max_withdrawal_fee;

  let (fees, net_amount) = compute_fee(amount, fee_bps, max_fee)?;

  let balance = ctx
    .accounts
    .payable
    .balances
    .iter()
    .find(|b| b.token == token_mint_key)
    .map(|b| b.amount)
    .unwrap_or(0);
  require!(balance >= amount, ChainbillsError::InsufficientBalance);

  let payable_key = ctx.accounts.payable.key();
  let vault_bump = ctx.bumps.vault_authority;
  let vault_seeds: &[&[u8]] =
    &[Payable::VAULT_SEED_PREFIX, payable_key.as_ref(), &[
      vault_bump,
    ]];

  transfer_checked(
    CpiContext::new_with_signer(
      ctx.accounts.token_program.to_account_info(),
      TransferChecked {
        from: ctx.accounts.vault_token_account.to_account_info(),
        mint: ctx.accounts.token_mint.to_account_info(),
        to: ctx.accounts.host_token_account.to_account_info(),
        authority: ctx.accounts.vault_authority.to_account_info(),
      },
      &[vault_seeds],
    ),
    net_amount,
    decimals,
  )?;

  if fees > 0 {
    transfer_checked(
      CpiContext::new_with_signer(
        ctx.accounts.token_program.to_account_info(),
        TransferChecked {
          from: ctx.accounts.vault_token_account.to_account_info(),
          mint: ctx.accounts.token_mint.to_account_info(),
          to: ctx.accounts.fee_collector_token_account.to_account_info(),
          authority: ctx.accounts.vault_authority.to_account_info(),
        },
        &[vault_seeds],
      ),
      fees,
      decimals,
    )?;
  }

  ctx
    .accounts
    .payable
    .deduct_balance(token_mint_key, amount)?;
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
  w.token_mint = token_mint_key;
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
    token: token_mint_key,
    amount,
    fees,
    net_amount,
    timestamp: now,
  });
  msg!(
    "Withdrew: payable={} host={} token={} amount={} fees={} net={} \
     chain_count={} timestamp={}",
    payable_key,
    host_key,
    token_mint_key,
    amount,
    fees,
    net_amount,
    w.chain_count,
    now,
  );

  Ok(())
}
