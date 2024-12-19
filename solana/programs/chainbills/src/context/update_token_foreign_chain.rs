use crate::{error::ChainbillsError, state::*};
use anchor_lang::prelude::*;

#[derive(Accounts)]
#[instruction(chain: u16)]
pub struct UpdateTokenForeignChain<'info> {
  #[account(init_if_needed, payer = owner, seeds = [TokenForeignChain::SEED_PREFIX, &chain.to_le_bytes()[..]], bump, space = TokenForeignChain::SPACE)]
  /// Account that stores the address of the foreign chain token and the
  /// equivalent/corresponding mint on this chain.
  pub token_foreign_chain: Box<Account<'info, TokenForeignChain>>,

  #[account(seeds = [Config::SEED_PREFIX], bump)]
  pub config: AccountLoader<'info, Config>,

  #[account(mut, address = config.load()?.owner @ ChainbillsError::OwnerUnauthorized)]
  /// Signer for this instruction. Should be the account that holds
  /// the upgrade authority of this program.
  pub owner: Signer<'info>,

  pub system_program: Program<'info, System>,
}
