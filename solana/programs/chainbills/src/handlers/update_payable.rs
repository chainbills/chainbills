use crate::{
  context::*,
  error::ChainbillsError,
  events::*,
  state::{
    ActivityRecord, ActivityType, ChainStats, Payable, PayableActivityInfo,
    TokenAndAmount, TokenDetails, User, UserActivityInfo,
  },
};
use anchor_lang::prelude::*;

fn record_update_payable_activity(
  chain_stats: &mut Account<ChainStats>,
  host: &mut Account<User>,
  payable: &mut Account<Payable>,
  activity: &mut Account<ActivityRecord>,
  user_activity_info: &mut Account<UserActivityInfo>,
  payable_activity_info: &mut Account<PayableActivityInfo>,
  activity_type: ActivityType,
) -> Result<()> {
  // Increment the chain stats for activities count.
  chain_stats.activities_count = chain_stats.next_activity();

  // Increment the host's activities count.
  host.activities_count = host.next_activity();

  // Increment the payable's activities count.
  payable.activities_count = payable.next_activity();

  // Initialize the activity.
  activity.chain_count = chain_stats.activities_count;
  activity.user_count = host.activities_count;
  activity.payable_count = payable.activities_count;
  activity.timestamp = Clock::get()?.unix_timestamp as u64;
  activity.reference = payable.key();
  activity.activity_type = activity_type;

  // Initialize the user activity info.
  user_activity_info.chain_count = chain_stats.activities_count;

  // Initialize the payable activity info.
  payable_activity_info.chain_count = chain_stats.activities_count;

  Ok(())
}

/// Stop a payable from accepting payments. Can be called only
/// by the host (user) that owns the payable.
#[inline(never)]
pub fn close_payable(ctx: Context<UpdatePayable>) -> Result<()> {
  // Ensure that the payable is not already closed.
  let payable = ctx.accounts.payable.as_mut();
  require!(!payable.is_closed, ChainbillsError::PayableIsAlreadyClosed);

  // Close the payable.
  payable.is_closed = true;

  // Record the activity.
  record_update_payable_activity(
    ctx.accounts.chain_stats.as_mut(),
    ctx.accounts.host.as_mut(),
    payable,
    ctx.accounts.activity.as_mut(),
    ctx.accounts.user_activity_info.as_mut(),
    ctx.accounts.payable_activity_info.as_mut(),
    ActivityType::ClosedPayable,
  )?;

  // Emit log and event.
  msg!("Closed Payable.");
  emit!(ClosedPayable {
    payable_id: payable.key(),
    host_wallet: ctx.accounts.signer.key()
  });
  Ok(())
}

/// Allow a closed payable to continue accepting payments.
/// Can be called only by the host (user) that owns the payable.
#[inline(never)]
pub fn reopen_payable(ctx: Context<UpdatePayable>) -> Result<()> {
  // Ensure that the payable is not closed.
  let payable = ctx.accounts.payable.as_mut();
  require!(payable.is_closed, ChainbillsError::PayableIsNotClosed);

  // Reopen the payable.
  payable.is_closed = false;

  // Record the activity.
  record_update_payable_activity(
    ctx.accounts.chain_stats.as_mut(),
    ctx.accounts.host.as_mut(),
    payable,
    ctx.accounts.activity.as_mut(),
    ctx.accounts.user_activity_info.as_mut(),
    ctx.accounts.payable_activity_info.as_mut(),
    ActivityType::ReopenedPayable,
  )?;

  // Emit log and event.
  msg!("Reopened Payable.");
  emit!(ReopenedPayable {
    payable_id: payable.key(),
    host_wallet: ctx.accounts.signer.key()
  });
  Ok(())
}

/// Allows a payable's host to update the payable's allowed_tokens_and_amounts.
///
/// ### args
/// * allowed_tokens_and_amounts: the new set of tokens and amounts that the payable
/// will accept.
#[inline(never)]
pub fn update_payable_allowed_tokens_and_amounts<'info>(
  ctx: Context<'_, '_, 'info, 'info, UpdatePayableAllowedTokensAndAmounts>,
  allowed_tokens_and_amounts: Vec<TokenAndAmount>,
) -> Result<()> {
  /* CHECKS */
  // Ensure that length of remaining_accounts in context matches that of the
  // allowed_tokens_and_amounts (ataas) vector. This is necessary inorder to
  // use remaining_accounts to get the token details.
  require!(
    ctx.remaining_accounts.len() == allowed_tokens_and_amounts.len(),
    ChainbillsError::InvalidRemainingAccountsLength
  );

  for (i, taa) in allowed_tokens_and_amounts.iter().enumerate() {
    // Get the token details for the specified token.
    let token_details =
      Account::<'info, TokenDetails>::try_from(&ctx.remaining_accounts[i])
        .map_err(|_| ChainbillsError::NonTokenDetailsAccountProvided)?;

    // Ensure that the token is supported.
    require!(
      taa.token == token_details.mint,
      ChainbillsError::InvalidTokenDetailsAccount
    );
    require!(
      token_details.is_supported,
      ChainbillsError::UnsupportedToken
    );

    // Ensure that all specified acceptable amounts are greater than zero.
    require!(taa.amount > 0, ChainbillsError::ZeroAmountSpecified);
  }

  /* STATE CHANGES */
  // Update the payable's allowed_tokens_and_amounts.
  let payable = ctx.accounts.payable.as_mut();
  payable.allowed_tokens_and_amounts = allowed_tokens_and_amounts;

  // Record the activity.
  record_update_payable_activity(
    ctx.accounts.chain_stats.as_mut(),
    ctx.accounts.host.as_mut(),
    payable,
    ctx.accounts.activity.as_mut(),
    ctx.accounts.user_activity_info.as_mut(),
    ctx.accounts.payable_activity_info.as_mut(),
    ActivityType::UpdatedPayableAllowedTokensAndAmounts,
  )?;

  // Emit log and event.
  msg!("Updated Payable's allowedTokensAndAmounts.");
  emit!(UpdatedPayableAllowedTokensAndAmounts {
    payable_id: payable.key(),
    host_wallet: ctx.accounts.signer.key()
  });
  Ok(())
}
