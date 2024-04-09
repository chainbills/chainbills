use crate::{context::OwnerWithdraw, error::ChainbillsError, events::*, state::GlobalStats};
use anchor_lang::prelude::*;
use anchor_spl::token::{self, Transfer as SplTransfer};

/// Withdraws fees from this program.
/// Should be called only by upgrade authority holder of this program.
///
/// ### args
/// * amount<u64>: The amount to be withdrawn
pub fn owner_withdraw_handler(ctx: Context<OwnerWithdraw>, amount: u64) -> Result<()> {
  require!(amount > 0, ChainbillsError::ZeroAmountSpecified);

  let destination = &ctx.accounts.admin_token_account;
  let source = &ctx.accounts.global_token_account;
  let token_program = &ctx.accounts.token_program;
  let authority = &ctx.accounts.global_stats;
  let cpi_accounts = SplTransfer {
    from: source.to_account_info().clone(),
    to: destination.to_account_info().clone(),
    authority: authority.to_account_info().clone(),
  };
  let cpi_program = token_program.to_account_info();
  token::transfer(
    CpiContext::new_with_signer(
      cpi_program,
      cpi_accounts,
      &[&[GlobalStats::SEED_PREFIX, &[ctx.bumps.global_stats]]],
    ),
    amount,
  )?;

  msg!("Owner made a withdrawal.");
  emit!(OwnerWithdrawalEvent {});
  Ok(())
}
