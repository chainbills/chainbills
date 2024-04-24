use crate::{context::UpdateMaxFee, error::*, events::*, state::TokenAndAmount};
use anchor_lang::prelude::*;

/// Updates the maximum fees of the given token.
///
/// ### Args
/// * token<[u8; 32]>: The Wormhole-normalized address of the token for which
///     its maximum withdrawal fees is been set.
/// * fee<u64>: The max fee to set.
pub fn update_max_fee_handler(ctx: Context<UpdateMaxFee>, token: [u8; 32], fee: u64) -> Result<()> {
  let config = &mut ctx.accounts.config.load_mut()?;

  // Search through existing set max fees and update a token's fee if found.
  // Otherwise, add the token and its fee as a new record.
  //
  // This boolean and the following two scopes was used (instead of peekable)
  // to solve the borrowing twice bug with rust on the payable variable.
  // let mut was_matching_token_updated = false;
  // {
  //   for i in 1..config.max_fees_per_token.len() {
  //     let mut taa = config.max_fees_per_token[i];
  //     if taa.token == token {
  //       taa.amount = fee;
  //       was_matching_token_updated = true;
  //       break;
  //     }
  //     // Hardcoded 100 as max length here.
  //     if i == config.max_fees_per_token.len() - 1 && config.max_fees_per_token.len() >= 100 {
  //       // Intentionally didn't create a new error for this condition.
  //       return err!(ChainbillsError::MaxPayableTokensCapacityReached);
  //     }
  //   }
  // }
  // {
  //   if !was_matching_token_updated {
  //     config
  //       .max_fees_per_token
  //       .push(TokenAndAmount { token, amount: fee });
  //   }
  // }

  msg!("Updated Max Fee.");
  emit!(UpdatedMaxFeeEvent {});
  Ok(())
}
