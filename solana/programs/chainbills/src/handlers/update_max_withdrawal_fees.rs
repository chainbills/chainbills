use crate::{context::*, error::ChainbillsError, events::*};
use anchor_lang::prelude::*;

/// Updates the maximum withdrawal fees of the given token.
///
/// ### Args
/// * token<Pubkey>: The token mint for which its maximum withdrawal fees is
///                  been set.
/// * max_withdrawal_fees<u64>: The maximum withdrawal fees to set.
#[inline(never)]
pub fn update_max_withdrawal_fees(
  ctx: Context<UpdateMaxWithdrawalFees>,
  token: Pubkey,
  max_withdrawal_fees: u64,
) -> Result<()> {
  // Carrying out these checks here and not in the context constraints
  // to bypass stack offset errors.
  let config = ctx.accounts.config.load()?;
  if config.owner != *ctx.accounts.owner.to_account_info().key {
    return Err(ChainbillsError::OwnerUnauthorized.into());
  }
  if config.chainbills_fee_collector
    != *ctx.accounts.fee_collector.to_account_info().key
  {
    return Err(ChainbillsError::WrongFeeCollectorAddress.into());
  }

  let token_details = ctx.accounts.token_details.as_mut();
  token_details.mint = token;
  token_details.is_supported = true;
  token_details.max_withdrawal_fees = max_withdrawal_fees;

  msg!("Updated Max Withdrawal Fees.");
  emit!(UpdatedMaxWithdrawalFees {
    token,
    max_withdrawal_fees
  });
  Ok(())
}

/// Updates the maximum withdrawal fees of the native token (Solana).
///
/// ### Args
/// * max_withdrawal_fees<u64>: The maximum withdrawal fees to set.
pub fn update_max_withdrawal_fees_native(
  ctx: Context<UpdateMaxWithdrawalFeesNative>,
  max_withdrawal_fees: u64,
) -> Result<()> {
  let token_details = ctx.accounts.token_details.as_mut();
  token_details.mint = crate::ID;
  token_details.is_supported = true;
  token_details.max_withdrawal_fees = max_withdrawal_fees;

  msg!("Updated Max Withdrawal Fees.");
  emit!(UpdatedMaxWithdrawalFees {
    token: crate::ID,
    max_withdrawal_fees
  });
  Ok(())
}
