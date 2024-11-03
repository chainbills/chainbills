use crate::{context::*, error::*, events::*, payload::*, state::*};
use anchor_lang::prelude::*;
use wormhole_anchor_sdk::wormhole;

fn record_update_payable_activity(
  chain_stats: &mut Account<ChainStats>,
  host: &mut Account<User>,
  payable: &mut Account<Payable>,
  activity: &mut Account<ActivityRecord>,
  user_activity_info: &mut Account<UserActivityInfo>,
  payable_activity_info: &mut Account<PayableActivityInfo>,
  activity_type: ActivityType,
) -> Result<()> {
  // Increment the chain stats for activities count and 
  // published_wormhole_messages_count.
  chain_stats.activities_count = chain_stats.next_activity();
  chain_stats.published_wormhole_messages_count =
    chain_stats.next_published_wormhole_message();

  // Increment the host's activities count.
  host.activities_count = host.next_activity();

  // Increment the payable's activities count.
  payable.activities_count = payable.next_activity();

  // Initialize the activity.
  activity.chain_count = chain_stats.activities_count;
  activity.user_count = host.activities_count;
  activity.payable_count = payable.activities_count;
  activity.timestamp = Clock::get()?.unix_timestamp as u64;
  activity.entity = payable.key();
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

  // If there is a fee for message sending, transfer it.
  let fee = ctx.accounts.wormhole_bridge.fee();
  if fee > 0 {
    solana_program::program::invoke(
      &solana_program::system_instruction::transfer(
        &ctx.accounts.signer.key(),
        &ctx.accounts.wormhole_fee_collector.key(),
        fee,
      ),
      &ctx.accounts.to_account_infos(),
    )?;
  }

  // Publish Message through Wormhole.
  wormhole::post_message(
    CpiContext::new_with_signer(
      ctx.accounts.wormhole_program.to_account_info(),
      wormhole::PostMessage {
        config: ctx.accounts.wormhole_bridge.to_account_info(),
        message: ctx.accounts.wormhole_message.to_account_info(),
        emitter: ctx.accounts.wormhole_emitter.to_account_info(),
        sequence: ctx.accounts.wormhole_sequence.to_account_info(),
        payer: ctx.accounts.signer.to_account_info(),
        fee_collector: ctx.accounts.wormhole_fee_collector.to_account_info(),
        clock: ctx.accounts.clock.to_account_info(),
        rent: ctx.accounts.rent.to_account_info(),
        system_program: ctx.accounts.system_program.to_account_info(),
      },
      &[
        &[
          SEED_PREFIX_SENT,
          &ctx.accounts.wormhole_sequence.next_value().to_le_bytes()[..],
          &[ctx.bumps.wormhole_message],
        ],
        &[wormhole::SEED_PREFIX_EMITTER, &[ctx.bumps.wormhole_emitter]],
      ],
    ),
    0, // Zero means no batching.
    PayablePayload {
      version: 1,
      action_type: 2, // Close Payable
      payable_id: ctx.accounts.payable.key().to_bytes(),
      is_closed: true,
      allowed_tokens_and_amounts: vec![],
    }
    .try_to_vec()?,
    wormhole::Finality::Confirmed,
  )?;

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

  // If there is a fee for message sending, transfer it.
  let fee = ctx.accounts.wormhole_bridge.fee();
  if fee > 0 {
    solana_program::program::invoke(
      &solana_program::system_instruction::transfer(
        &ctx.accounts.signer.key(),
        &ctx.accounts.wormhole_fee_collector.key(),
        fee,
      ),
      &ctx.accounts.to_account_infos(),
    )?;
  }

  // Publish Message through Wormhole.
  wormhole::post_message(
    CpiContext::new_with_signer(
      ctx.accounts.wormhole_program.to_account_info(),
      wormhole::PostMessage {
        config: ctx.accounts.wormhole_bridge.to_account_info(),
        message: ctx.accounts.wormhole_message.to_account_info(),
        emitter: ctx.accounts.wormhole_emitter.to_account_info(),
        sequence: ctx.accounts.wormhole_sequence.to_account_info(),
        payer: ctx.accounts.signer.to_account_info(),
        fee_collector: ctx.accounts.wormhole_fee_collector.to_account_info(),
        clock: ctx.accounts.clock.to_account_info(),
        rent: ctx.accounts.rent.to_account_info(),
        system_program: ctx.accounts.system_program.to_account_info(),
      },
      &[
        &[
          SEED_PREFIX_SENT,
          &ctx.accounts.wormhole_sequence.next_value().to_le_bytes()[..],
          &[ctx.bumps.wormhole_message],
        ],
        &[wormhole::SEED_PREFIX_EMITTER, &[ctx.bumps.wormhole_emitter]],
      ],
    ),
    0, // Zero means no batching.
    PayablePayload {
      version: 1,
      action_type: 3, // Reopen Payable
      payable_id: ctx.accounts.payable.key().to_bytes(),
      is_closed: false,
      allowed_tokens_and_amounts: vec![],
    }
    .try_to_vec()?,
    wormhole::Finality::Confirmed,
  )?;

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

  let mut ataa_foreign: Vec<TokenAndAmountForeign> = vec![];
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

    // Set the foreign ATAA in the same loop
    ataa_foreign.push(TokenAndAmountForeign {
      token: taa.token.to_bytes(),
      amount: taa.amount,
    });
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

  // If there is a fee for message sending, transfer it.
  let fee = ctx.accounts.wormhole_bridge.fee();
  if fee > 0 {
    solana_program::program::invoke(
      &solana_program::system_instruction::transfer(
        &ctx.accounts.signer.key(),
        &ctx.accounts.wormhole_fee_collector.key(),
        fee,
      ),
      &ctx.accounts.to_account_infos(),
    )?;
  }

  // Publish Message through Wormhole.
  wormhole::post_message(
    CpiContext::new_with_signer(
      ctx.accounts.wormhole_program.to_account_info(),
      wormhole::PostMessage {
        config: ctx.accounts.wormhole_bridge.to_account_info(),
        message: ctx.accounts.wormhole_message.to_account_info(),
        emitter: ctx.accounts.wormhole_emitter.to_account_info(),
        sequence: ctx.accounts.wormhole_sequence.to_account_info(),
        payer: ctx.accounts.signer.to_account_info(),
        fee_collector: ctx.accounts.wormhole_fee_collector.to_account_info(),
        clock: ctx.accounts.clock.to_account_info(),
        rent: ctx.accounts.rent.to_account_info(),
        system_program: ctx.accounts.system_program.to_account_info(),
      },
      &[
        &[
          SEED_PREFIX_SENT,
          &ctx.accounts.wormhole_sequence.next_value().to_le_bytes()[..],
          &[ctx.bumps.wormhole_message],
        ],
        &[wormhole::SEED_PREFIX_EMITTER, &[ctx.bumps.wormhole_emitter]],
      ],
    ),
    0, // Zero means no batching.
    PayablePayload {
      version: 1,
      action_type: 4, // Update Payable Allowed Tokens And Amounts
      payable_id: ctx.accounts.payable.key().to_bytes(),
      is_closed: false,
      allowed_tokens_and_amounts: ataa_foreign,
    }
    .try_to_vec()?,
    wormhole::Finality::Confirmed,
  )?;

  Ok(())
}
