use crate::{error::ChainbillsError, state::*};
use anchor_lang::prelude::*;

#[derive(Accounts)]
pub struct UpdateMaxWithdrawalFeesNative<'info> {
  #[account(init_if_needed, payer = owner, seeds = [TokenDetails::SEED_PREFIX, crate::ID.as_ref()], bump, space = TokenDetails::SPACE)]
  /// Account that stores the details of the token to updates its max withdrawal fees.
  pub token_details: Box<Account<'info, TokenDetails>>,

  #[account(seeds = [Config::SEED_PREFIX], bump)]
  pub config: AccountLoader<'info, Config>,

  #[account(mut, address = config.load()?.owner @ ChainbillsError::OwnerUnauthorized)]
  /// Signer for this instruction. Should be the account that holds
  /// the upgrade authority of this program.
  pub owner: Signer<'info>,

  pub system_program: Program<'info, System>,
}
