use crate::{error::ChainbillsError, state::*};
use anchor_lang::prelude::*;

#[derive(Accounts)]
#[instruction(token: [u8; 32], fee: u64)]
pub struct UpdateMaxFee<'info> {
  #[account(mut, constraint = config.load()?.owner == owner.key() @ ChainbillsError::OwnerOnly)]
  /// Owner of the program set in the [`Config`] account.
  pub owner: Signer<'info>,

  #[account(
        has_one = owner @ ChainbillsError::OwnerOnly,
        seeds = [Config::SEED_PREFIX],
        bump
    )]
  /// Config account in which we are updating the fee.
  #[account(mut)]
  pub config: AccountLoader<'info, Config>,
}
