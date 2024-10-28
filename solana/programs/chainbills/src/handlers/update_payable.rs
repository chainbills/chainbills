use crate::{
  context::*,
  error::ChainbillsError,
  events::*,
  state::{TokenAndAmount, TokenDetails},
};
use anchor_lang::prelude::*;

/// Stop a payable from accepting payments. Can be called only
/// by the host (user) that owns the payable.
pub fn close_payable(ctx: Context<UpdatePayable>) -> Result<()> {
  let payable = ctx.accounts.payable.as_mut();
  require!(!payable.is_closed, ChainbillsError::PayableIsAlreadyClosed);
  payable.is_closed = true;

  msg!("Closed Payable.");
  emit!(ClosePayableEvent {
    payable_id: payable.key(),
    host_wallet: ctx.accounts.signer.key()
  });
  Ok(())
}

/// Allow a closed payable to continue accepting payments.
/// Can be called only by the host (user) that owns the payable.
pub fn reopen_payable(ctx: Context<UpdatePayable>) -> Result<()> {
  let payable = ctx.accounts.payable.as_mut();
  require!(payable.is_closed, ChainbillsError::PayableIsNotClosed);
  payable.is_closed = false;

  msg!("Reopened Payable.");
  emit!(ReopenPayableEvent {
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
      ChainbillsError::UnsupportedToken
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

  // Emit log and event.
  msg!("Updated Payable's allowedTokensAndAmounts.");
  emit!(UpdatedPayableAllowedTokensAndAmountsEvent {
    payable_id: payable.key(),
    host_wallet: ctx.accounts.signer.key()
  });
  Ok(())
}
