use crate::{
  context::*,
  error::ChainbillsError,
  events::*,
  state::{Payable, TokenAndAmount},
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
pub fn update_payable_allowed_tokens_and_amounts(
  ctx: Context<UpdatePayable>,
  allowed_tokens_and_amounts: Vec<TokenAndAmount>,
) -> Result<()> {
  require!(
    allowed_tokens_and_amounts.len() <= Payable::MAX_PAYABLES_TOKENS,
    ChainbillsError::MaxPayableTokensCapacityReached
  );
  for taa in allowed_tokens_and_amounts.iter() {
    require!(taa.amount > 0, ChainbillsError::ZeroAmountSpecified);
  }

  let payable = ctx.accounts.payable.as_mut();
  payable.allowed_tokens_and_amounts = allowed_tokens_and_amounts;

  msg!("Updated Payable's allowedTokensAndAmounts.");
  emit!(UpdatedPayableAllowedTokensAndAmountsEvent {
    payable_id: payable.key(),
    host_wallet: ctx.accounts.signer.key()
  });
  Ok(())
}
