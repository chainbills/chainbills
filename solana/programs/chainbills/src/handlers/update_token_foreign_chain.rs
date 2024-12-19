use crate::{context::*, events::*};
use anchor_lang::prelude::*;

/// Updates the local token mint and the foreign token address for a given
/// token against a foreign chain.
///
/// ### Args
/// * chain<u16>: The foreign chain ID.
/// * foreign_token<[u8; 32]>: The foreign token address.
/// * token<Pubkey>: The token mint to update.
pub fn update_token_foreign_chain_handler(
  ctx: Context<UpdateTokenForeignChain>,
  chain: u16,
  foreign_token: [u8; 32],
  token: Pubkey,
) -> Result<()> {
  let token_foreign_chain = ctx.accounts.token_foreign_chain.as_mut();
  token_foreign_chain.foreign_token = foreign_token;
  token_foreign_chain.token = token;

  msg!("Registered Matching Token For Foreign Chain.");
  emit!(RegisteredMatchingTokenForForeignChain {
    chain_id: chain,
    foreign_token,
    token,
  });
  Ok(())
}
