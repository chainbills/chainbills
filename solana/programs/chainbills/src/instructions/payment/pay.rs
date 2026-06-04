//! `pay` — same-chain SPL Token or Token-2022 payment to a local payable.

use anchor_lang::prelude::*;
use anchor_spl::{
  associated_token::AssociatedToken,
  token_interface::{
    transfer_checked, Mint, TokenAccount, TokenInterface, TransferChecked,
  },
};

use crate::{
  errors::ChainbillsError,
  events::{PayableReceived, UserInitialized, UserPaid},
  state::{
    ActivityRecord, ActivityType, Config, Payable, PayableActivityPointer,
    PayablePayment, Stats, TokenConfig, UserActivityPointer, UserPayment,
    UserRecord,
  },
  utils::{get_current_timestamp, normalize_pubkey},
};

/// Accounts for the `pay` instruction.
#[derive(Accounts)]
pub struct Pay<'info> {
  /// The payer making the payment. Must sign. Pays for new PDAs.
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

  /// Payer's token account for the token being paid.
  #[account(
        mut,
        constraint = payer_token_account.owner == payer.key(),
        constraint = payer_token_account.mint == token_mint.key(),
    )]
  pub payer_token_account: Box<InterfaceAccount<'info, TokenAccount>>,

  /// CHECK: PDA with no data; key validated by seeds.
  #[account(
        seeds = [Payable::VAULT_SEED_PREFIX, payable.key().as_ref()],
        bump,
    )]
  pub vault_authority: UncheckedAccount<'info>,

  /// Vault ATA owned by vault_authority — receives the tokens.
  #[account(
        init_if_needed,
        payer = payer,
        associated_token::mint = token_mint,
        associated_token::authority = vault_authority,
        associated_token::token_program = token_program,
    )]
  pub vault_token_account: Box<InterfaceAccount<'info, TokenAccount>>,

  /// The token mint being paid.
  pub token_mint: Box<InterfaceAccount<'info, Mint>>,

  /// Config — provides cb_chain_id for payment records.
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

  /// UserPayment receipt PDA for the payer.
  #[account(
        init,
        payer = payer,
        space = UserPayment::SPACE,
        seeds = [UserPayment::SEED_PREFIX, payer.key().as_ref(), &user_record.payments_count.to_le_bytes()],
        bump,
    )]
  pub user_payment: Box<Account<'info, UserPayment>>,

  /// PayablePayment receipt PDA for the payable.
  #[account(
        init,
        payer = payer,
        space = PayablePayment::SPACE,
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

  pub token_program: Interface<'info, TokenInterface>,
  pub associated_token_program: Program<'info, AssociatedToken>,
  pub system_program: Program<'info, System>,
}

/// Handler for `pay`.
///
/// # Arguments
/// * `ctx`    — accounts
/// * `amount` — amount to pay in token base units
pub fn process_pay(ctx: Context<Pay>, amount: u64) -> Result<()> {
  require!(amount > 0, ChainbillsError::ZeroAmount);

  let payer_key = ctx.accounts.payer.key();
  let payable_key = ctx.accounts.payable.key();
  let token_mint_key = ctx.accounts.token_mint.key();
  let decimals = ctx.accounts.token_mint.decimals;

  validate_payment(
    &ctx.accounts.payable.allowed_tokens_and_amounts,
    token_mint_key,
    amount,
  )?;

  execute_transfer(&ctx, amount, decimals)?;

  // Grow payable if this is the first payment of this token; fund the extra
  // rent.
  let has_existing = ctx
    .accounts
    .payable
    .balances
    .iter()
    .any(|b| b.token == token_mint_key);
  if !has_existing {
    let new_space = ctx.accounts.payable.space_for_new_balance();
    let rent = Rent::get()?;
    let new_min_lamports = rent.minimum_balance(new_space);
    let current_lamports = ctx.accounts.payable.get_lamports();
    if new_min_lamports > current_lamports {
      let diff = new_min_lamports - current_lamports;
      anchor_lang::system_program::transfer(
        CpiContext::new(
          ctx.accounts.system_program.to_account_info(),
          anchor_lang::system_program::Transfer {
            from: ctx.accounts.payer.to_account_info(),
            to: ctx.accounts.payable.to_account_info(),
          },
        ),
        diff,
      )?;
    }
    ctx.accounts.payable.to_account_info().resize(new_space)?;
  }

  record_payment(ctx, payer_key, payable_key, token_mint_key, amount)?;

  Ok(())
}

fn validate_payment(
  ataa: &[crate::state::TokenAndAmount],
  token_mint: Pubkey,
  amount: u64,
) -> Result<()> {
  if ataa.is_empty() {
    return Ok(());
  }
  let valid = ataa
    .iter()
    .any(|e| e.token == token_mint && amount >= e.amount);
  require!(valid, ChainbillsError::TokenAmountMismatch);
  Ok(())
}

fn execute_transfer(
  ctx: &Context<Pay>,
  amount: u64,
  decimals: u8,
) -> Result<()> {
  transfer_checked(
    CpiContext::new(
      ctx.accounts.token_program.to_account_info(),
      TransferChecked {
        from: ctx.accounts.payer_token_account.to_account_info(),
        mint: ctx.accounts.token_mint.to_account_info(),
        to: ctx.accounts.vault_token_account.to_account_info(),
        authority: ctx.accounts.payer.to_account_info(),
      },
    ),
    amount,
    decimals,
  )
}

fn record_payment(
  ctx: Context<Pay>,
  payer_key: Pubkey,
  payable_key: Pubkey,
  token_mint_key: Pubkey,
  amount: u64,
) -> Result<()> {
  let now = get_current_timestamp()?;
  let cb_chain_id = ctx.accounts.config.cb_chain_id;
  let global_idx = ctx.accounts.stats.total_activities;

  // Realloc + lamport funding already done in process_pay before this call.
  ctx
    .accounts
    .payable
    .add_to_balance(token_mint_key, amount)?;
  ctx.accounts.payable.increment_payments()?;
  ctx.accounts.payable.increment_activities()?;

  let user_record = &mut ctx.accounts.user_record;
  if user_record.wallet == Pubkey::default() {
    user_record.wallet = payer_key;
    user_record.created_at = now;
    ctx.accounts.stats.increment_total_users()?;
    // First time this wallet pays — record initialization.
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
  up.token_mint = token_mint_key;
  up.amount = amount;
  up.payable_chain_id = cb_chain_id;
  up.payer_chain_id = cb_chain_id;
  up.created_at = now;

  let pp = &mut ctx.accounts.payable_payment;
  pp.payable = payable_key;
  pp.payer = normalize_pubkey(&payer_key);
  pp.payable_count = payable_count;
  pp.chain_count = ctx.accounts.stats.total_payable_payments;
  pp.token_mint = token_mint_key;
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
    token: token_mint_key,
    amount,
    timestamp: now,
  });
  emit!(PayableReceived {
    payment: ctx.accounts.payable_payment.key(),
    payable: payable_key,
    payer: normalize_pubkey(&payer_key),
    token: token_mint_key,
    amount,
    timestamp: now,
  });
  msg!(
    "Pay: payer={} payable={} token={} amount={} payer_count={} \
     chain_count={} timestamp={}",
    payer_key,
    payable_key,
    token_mint_key,
    amount,
    payer_count,
    up.chain_count,
    now,
  );

  Ok(())
}
