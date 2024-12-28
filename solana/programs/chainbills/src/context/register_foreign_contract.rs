use crate::{error::*, state::*};
use anchor_lang::prelude::*;

#[derive(Accounts)]
#[instruction(chain_id: u16)]
/// Context used to register a foreign contract that will be emitting Wormhole
/// messages to this program from other chains.
pub struct RegisterForeignContract<'info> {
  #[account(
        init_if_needed,
        payer = owner,
        seeds = [
            RegisteredForeignContract::SEED_PREFIX,
            &chain_id.to_le_bytes()[..]
        ],
        bump,
        space = RegisteredForeignContract::SPACE
    )]
  /// Foreign Contract account. This account will be created if a contract has
  /// not been registered yet for this Wormhole Chain ID. If there already is a
  /// contract address saved in this account, its contents will be overwritted.
  pub registered_foreign_contract: Account<'info, RegisteredForeignContract>,

  #[account(seeds = [ChainStats::SEED_PREFIX], bump)]
  /// Necessary for obtaining this chain's chain_id in the handler.
  pub chain_stats: Account<'info, ChainStats>,

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
