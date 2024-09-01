use crate::{error::ChainbillsError, state::*};
use anchor_lang::prelude::*;


#[derive(Accounts)]
pub struct UpdateMaxWithdrawalFeeNative<'info> {
  #[account(init_if_needed, payer = owner, seeds = [MaxFeeDetails::SEED_PREFIX, crate::ID.as_ref()], bump, space = MaxFeeDetails::SPACE)]
  /// Account that stores the max withdrawal fee details.
  pub max_withdrawal_fee_details: Box<Account<'info, MaxFeeDetails>>,

  #[account(seeds = [Config::SEED_PREFIX], bump)]
  pub config: AccountLoader<'info, Config>,

  #[account(mut, address = config.load()?.owner @ ChainbillsError::OwnerUnauthorized)]
  /// Signer for this instruction. Should be the account that holds
  /// the upgrade authority of this program.
  pub owner: Signer<'info>,

  pub system_program: Program<'info, System>,
}
