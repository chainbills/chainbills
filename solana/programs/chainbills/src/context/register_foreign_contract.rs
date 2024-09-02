use crate::{error::ChainbillsError, state::*};
use anchor_lang::prelude::*;


#[derive(Accounts)]
#[instruction(chain: u16)]
/// Context used to register a foreign contract that will be emitting Wormhole
/// messages to this program from other chains.
pub struct RegisterForeignContract<'info> {
  #[account(
        init_if_needed,
        payer = owner,
        seeds = [
            ForeignContract::SEED_PREFIX,
            &chain.to_le_bytes()[..]
        ],
        bump,
        space = ForeignContract::SPACE
    )]
  /// Foreign Contract account. This account will be created if a contract has 
  /// not been registered yet for this Wormhole Chain ID. If there already is a 
  /// contract address saved in this account, its contents will be overwritted.
  pub foreign_contract: Account<'info, ForeignContract>,

  #[account(seeds = [Config::SEED_PREFIX], bump)]
  /// Config Account that stores important constant addresses that are used 
  /// across program instructions.
  pub config: AccountLoader<'info, Config>,

  #[account(mut, address = config.load()?.owner @ ChainbillsError::OwnerUnauthorized)]
  /// Signer for this instruction. Should be the account that holds
  /// the upgrade authority of this program.
  pub owner: Signer<'info>,

  /// System program.
  pub system_program: Program<'info, System>,
}
