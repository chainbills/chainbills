use crate::{error::ChainbillsError, state::*};
use anchor_lang::prelude::*;

#[derive(Accounts)]
#[instruction(token: [u8; 32], fee: u64)]
pub struct UpdateMaxWithdrawalFee<'info> {
  #[account(mut, constraint = config.load()?.owner == owner.key() @ ChainbillsError::OwnerOnly)]
  /// Owner of the program set in the [`Config`] account.
  pub owner: Signer<'info>,

  #[account(
        has_one = owner @ ChainbillsError::OwnerOnly,
        seeds = [Config::SEED_PREFIX],
        bump
    )]
  /// Config account to confirm owner status.
  pub config: AccountLoader<'info, Config>,

  #[account(init_if_needed, payer = owner, seeds = [MaxFeeDetails::SEED_PREFIX, &token], bump, space = MaxFeeDetails::SPACE)]
  /// Account that stores the max withdrawal fee details.
  pub max_withdrawal_fee_details: Box<Account<'info, MaxFeeDetails>>,

  pub system_program: Program<'info, System>,
}
