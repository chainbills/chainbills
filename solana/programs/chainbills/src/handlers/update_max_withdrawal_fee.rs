use crate::{context::*, error::ChainbillsError, events::*};
use anchor_lang::prelude::*;

/// Updates the maximum withdrawal fees of the given token.
///
/// ### Args
/// * token<Pubkey>: The token mint for which its maximum withdrawal fees is
///                  been set.
/// * fee<u64>: The max fee to set.
pub fn update_max_withdrawal_fee(
  ctx: Context<UpdateMaxWithdrawalFee>,
  token: Pubkey,
  fee: u64,
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

  let max_withdrawal_fee_details =
    ctx.accounts.max_withdrawal_fee_details.as_mut();

  max_withdrawal_fee_details.token = token;
  max_withdrawal_fee_details.amount = fee;

  msg!("Updated Max Withdrawal Fee.");
  emit!(UpdatedMaxWithdrawalFeeEvent {
    token,
    max_fee: fee
  });
  Ok(())
}

/// Updates the maximum withdrawal fees of the native token (Solana).
///
/// ### Args
/// * fee<u64>: The max fee to set.
pub fn update_max_withdrawal_fee_native(
  ctx: Context<UpdateMaxWithdrawalFeeNative>,
  fee: u64,
) -> Result<()> {
  let max_withdrawal_fee_details =
    ctx.accounts.max_withdrawal_fee_details.as_mut();

  max_withdrawal_fee_details.token = crate::ID;
  max_withdrawal_fee_details.amount = fee;

  msg!("Updated Max Withdrawal Fee.");
  emit!(UpdatedMaxWithdrawalFeeEvent {
    token: crate::ID,
    max_fee: fee
  });
  Ok(())
}
