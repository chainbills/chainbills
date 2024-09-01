use crate::{context::*, error::ChainbillsError, events::*, state::*};
use anchor_lang::{prelude::*, solana_program::clock};
use anchor_spl::token::{self, Transfer as SplTransfer};
use std::cmp::min;

fn check_withdraw_inputs(
  amount: u64,
  mint: Pubkey,
  payable: &Account<Payable>,
) -> Result<()> {
  // Ensure that amount is greater than zero
  require!(amount > 0, ChainbillsError::ZeroAmountSpecified);

  // - Ensure that this payable has enough of the provided amount in its balance.
  // - Ensure that the specified token (mint) for withdrawal exists in the
  //   payable's balances.
  let mut bals_it = payable.balances.iter().peekable();
  while let Some(balance) = bals_it.next() {
    if balance.token == mint {
      if balance.amount < amount {
        return err!(ChainbillsError::InsufficientWithdrawAmount);
      } else {
        break;
      }
    }
    if bals_it.peek().is_none() {
      return err!(ChainbillsError::NoBalanceForWithdrawalToken);
    }
  }

  Ok(())
}

fn update_state_for_withdrawal(
  amount: u64,
  mint: Pubkey,
  chain_stats: &mut Account<ChainStats>,
  payable: &mut Account<Payable>,
  host: &mut Account<User>,
  withdrawal: &mut Account<Withdrawal>,
) -> Result<()> {
  // Increment the chain stats for payables_count.
  chain_stats.withdrawals_count = chain_stats.next_withdrawal();

  // Increment withdrawals_count in the host that just withdrew.
  host.withdrawals_count = host.next_withdrawal();

  // Increment withdrawals_count on the involved payable.
  payable.withdrawals_count = payable.next_withdrawal();

  // Deduct the balances on the involved payable.
  for balance in payable.balances.iter_mut() {
    if balance.token == mint {
      balance.amount = balance.amount.checked_sub(amount).unwrap();
      break;
    }
  }

  // Initialize the withdrawal.
  withdrawal.chain_count = chain_stats.payables_count;
  withdrawal.payable_id = payable.key();
  withdrawal.payable_count = payable.withdrawals_count;
  withdrawal.host = host.wallet_address;
  withdrawal.host_count = host.withdrawals_count;
  withdrawal.timestamp = clock::Clock::get()?.unix_timestamp as u64;
  withdrawal.details = TokenAndAmount {
    token: mint,
    amount,
  };

  // Emit log and event.
  msg!(
    "Withdrawal was made with chain_count: {}, payable_count: {}, and host_count: {}.",
    withdrawal.chain_count,
    withdrawal.payable_count,
    withdrawal.host_count
  );
  emit!(WithdrawalEvent {
    payable_id: payable.key(),
    host_wallet: host.wallet_address,
    withdrawal_id: withdrawal.key(),
    chain_count: withdrawal.chain_count,
    payable_count: withdrawal.payable_count,
    host_count: withdrawal.host_count,
  });
  Ok(())
}

/// Transfers the amount of tokens from a payable to a host
///
/// ### args
/// * amount<u64>: The amount to be withdrawn
pub fn withdraw(ctx: Context<Withdraw>, amount: u64) -> Result<()> {
  /* CHECKS */
  let payable = ctx.accounts.payable.as_mut();
  let mint = &ctx.accounts.mint;
  check_withdraw_inputs(amount, mint.key(), payable)?;

  /* TRANSFERS */
  // Prepare withdraw amounts and fees
  let max_withdrawal_fee_details =
    ctx.accounts.max_withdrawal_fee_details.as_ref();
  let two_percent = amount.checked_mul(2).unwrap().checked_div(100).unwrap();
  let fees = min(two_percent, max_withdrawal_fee_details.amount);
  let amount_minus_fees = amount.checked_sub(fees).unwrap();

  // Extract Accounts needed for transferring
  let host_ta = &ctx.accounts.host_token_account;
  let fees_ta = &ctx.accounts.fees_token_account;
  let source = &ctx.accounts.chain_token_account;
  let token_program = &ctx.accounts.token_program;
  let authority = &ctx.accounts.chain_stats;

  // Prepare accounts for withdrawing and for fees
  let cpi_accounts_host = SplTransfer {
    from: source.to_account_info().clone(),
    to: host_ta.to_account_info().clone(),
    authority: authority.to_account_info().clone(),
  };
  let cpi_accounts_fees = SplTransfer {
    from: source.to_account_info().clone(),
    to: fees_ta.to_account_info().clone(),
    authority: authority.to_account_info().clone(),
  };

  // Transfer the amount minus fees to the host.
  token::transfer(
    CpiContext::new_with_signer(
      token_program.to_account_info(),
      cpi_accounts_host,
      &[&[ChainStats::SEED_PREFIX, &[ctx.bumps.chain_stats]]],
    ),
    amount_minus_fees,
  )?;

  // Transfer the fees to the fees collector.
  token::transfer(
    CpiContext::new_with_signer(
      token_program.to_account_info(),
      cpi_accounts_fees,
      &[&[ChainStats::SEED_PREFIX, &[ctx.bumps.chain_stats]]],
    ),
    fees,
  )?;

  /* STATE CHANGES */
  let chain_stats = ctx.accounts.chain_stats.as_mut();
  let host = ctx.accounts.host.as_mut();
  let withdrawal = ctx.accounts.withdrawal.as_mut();
  update_state_for_withdrawal(
    amount,
    mint.key(),
    chain_stats,
    payable,
    host,
    withdrawal,
  )
}

/// Transfers the amount of native tokens (Solana) from a payable to a host
///
/// ### args
/// * amount<u64>: The amount to be withdrawn
pub fn withdraw_native(
  ctx: Context<WithdrawNative>,
  amount: u64,
) -> Result<()> {
  /* CHECKS */
  let payable = ctx.accounts.payable.as_mut();
  check_withdraw_inputs(amount, crate::ID, payable)?;

  /* TRANSFERS */
  // Prepare withdraw amounts and fees
  let max_withdrawal_fee_details =
    ctx.accounts.max_withdrawal_fee_details.as_ref();
  let two_percent = amount.checked_mul(2).unwrap().checked_div(100).unwrap();
  let fees = min(two_percent, max_withdrawal_fee_details.amount);
  let amount_minus_fees = amount.checked_sub(fees).unwrap();

  // Extract Accounts needed for transferring
  let chain_stats = ctx.accounts.chain_stats.to_account_info();
  let signer = ctx.accounts.signer.to_account_info();
  let fees_collector = ctx.accounts.fee_collector.to_account_info();

  // Transfer the amount minus fees to the host.
  chain_stats
    .try_borrow_mut_lamports()?
    .checked_sub(amount_minus_fees)
    .unwrap();
  signer
    .try_borrow_mut_lamports()?
    .checked_add(amount_minus_fees)
    .unwrap();

  // Transfer the fees to the fees collector.
  chain_stats
    .try_borrow_mut_lamports()?
    .checked_sub(fees)
    .unwrap();
  fees_collector
    .try_borrow_mut_lamports()?
    .checked_add(fees)
    .unwrap();

  /* STATE CHANGES */
  let chain_stats = ctx.accounts.chain_stats.as_mut();
  let host = ctx.accounts.host.as_mut();
  let withdrawal = ctx.accounts.withdrawal.as_mut();
  update_state_for_withdrawal(
    amount,
    crate::ID,
    chain_stats,
    payable,
    host,
    withdrawal,
  )
}
