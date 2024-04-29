use crate::{context::UpdateMaxWithdrawalFee, events::*};
use anchor_lang::prelude::*;

/// Updates the maximum withdrawal fees of the given token.
///
/// ### Args
/// * token<[u8; 32]>: The Wormhole-normalized address of the token for which
///     its maximum withdrawal fees is been set.
/// * fee<u64>: The max fee to set.
pub fn update_max_withdrawal_fee_handler(
  ctx: Context<UpdateMaxWithdrawalFee>,
  token: [u8; 32],
  fee: u64,
) -> Result<()> {
  let max_withdrawal_fee_details = ctx.accounts.max_withdrawal_fee_details.as_mut();

  max_withdrawal_fee_details.token = token;
  max_withdrawal_fee_details.amount = fee;

  msg!("Updated Max Withdrawal Fee.");
  emit!(UpdatedMaxWithdrawalFeeEvent {});
  Ok(())
}
