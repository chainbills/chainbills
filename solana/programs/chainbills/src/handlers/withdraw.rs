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
  if payable.balances.is_empty() {
    return err!(ChainbillsError::NoBalanceForWithdrawalToken);
  }
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
  fees: u64,
  mint: Pubkey,
  signer: Pubkey,
  chain_stats: &mut Account<ChainStats>,
  payable: &mut Account<Payable>,
  host: &mut Account<User>,
  token_details: &mut Account<TokenDetails>,
  withdrawal: &mut Account<Withdrawal>,
  payable_withdrawal_counter: &mut Account<PayableWithdrawalCounter>,
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

  // Increase the supported token's totals from this withdrawal.
  token_details.add_withdrawn(amount);
  token_details.add_withdrawal_fees_collected(fees);

  // Initialize the withdrawal.
  withdrawal.chain_count = chain_stats.payables_count;
  withdrawal.payable_id = payable.key();
  withdrawal.payable_count = payable.withdrawals_count;
  withdrawal.host = signer;
  withdrawal.host_count = host.withdrawals_count;
  withdrawal.timestamp = clock::Clock::get()?.unix_timestamp as u64;
  withdrawal.details = TokenAndAmount {
    token: mint,
    amount,
  };

  // Initialize the payable withdrawal counter. Record the host_count in it
  // for the caller to use to get the main withdrawal account when retrieving
  // withdrawals in context of payables.
  payable_withdrawal_counter.host_count = host.withdrawals_count;

  // Emit log and event.
  msg!(
    "Withdrawal was made with chain_count: {}, payable_count: {}, and host_count: {}.",
    withdrawal.chain_count,
    withdrawal.payable_count,
    withdrawal.host_count
  );
  emit!(WithdrawalEvent {
    payable_id: payable.key(),
    host_wallet: signer,
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
  let config = ctx.accounts.config.load()?;
  let token_details = ctx.accounts.token_details.as_mut();
  let percent = amount
    .checked_mul(config.withdrawal_fee_percentage.into())
    .unwrap()
    .checked_div(10000) // 10000 is 100%
    .unwrap();
  let fees = min(percent, token_details.max_withdrawal_fees);
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
  update_state_for_withdrawal(
    amount,
    fees,
    mint.key(),
    ctx.accounts.signer.key(),
    ctx.accounts.chain_stats.as_mut(),
    payable,
    ctx.accounts.host.as_mut(),
    token_details,
    ctx.accounts.withdrawal.as_mut(),
    ctx.accounts.payable_withdrawal_counter.as_mut(),
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
  let config = ctx.accounts.config.load()?;
  let token_details = ctx.accounts.token_details.as_mut();
  let percent = amount
    .checked_mul(config.withdrawal_fee_percentage.into())
    .unwrap()
    .checked_div(10000) // 10000 is 100%
    .unwrap();
  let fees = min(percent, token_details.max_withdrawal_fees);
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
  update_state_for_withdrawal(
    amount,
    fees,
    crate::ID,
    ctx.accounts.signer.key(),
    ctx.accounts.chain_stats.as_mut(),
    payable,
    ctx.accounts.host.as_mut(),
    token_details,
    ctx.accounts.withdrawal.as_mut(),
    ctx.accounts.payable_withdrawal_counter.as_mut(),
  )
}
