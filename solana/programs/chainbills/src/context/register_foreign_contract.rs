use crate::{error::ChainbillsError, state::*};
use anchor_lang::prelude::*;
use wormhole_anchor_sdk::token_bridge;

#[derive(Accounts)]
#[instruction(chain: u16)]
pub struct RegisterForeignContract<'info> {
  #[account(mut, constraint = config.load()?.owner == owner.key() @ ChainbillsError::OwnerOnly)]
  /// Owner of the program set in the [`Config`] account. Signer for creating
  /// the [`ForeignContract`] account.
  pub owner: Signer<'info>,

  #[account(
        has_one = owner @ ChainbillsError::OwnerOnly,
        seeds = [Config::SEED_PREFIX],
        bump
    )]
  /// Config account. This program requires that the `owner` specified in the
  /// context equals the pubkey specified in this account. Read-only.
  pub config: AccountLoader<'info, Config>,

  #[account(
      init_if_needed,
      payer = owner,
      seeds = [ChainStats::SEED_PREFIX, &chain.to_le_bytes()[..]],
      bump,
      space = ChainStats::SPACE
  )]
  /// Keeps track of the counts of all entities (Users, Payables, Payments,
  /// and Withdrawals) initialized on this new Chain in Chainbills.
  pub chain_stats: Box<Account<'info, ChainStats>>,

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
  /// Foreign Contract account. Create this account if a contract has not been
  /// registered yet for this Wormhole chain ID. If there already is a contract
  /// address saved in this account, overwrite it.
  pub foreign_contract: Account<'info, ForeignContract>,

  #[account(
        seeds = [
            &chain.to_be_bytes(),
            token_bridge_foreign_endpoint.emitter_address.as_ref()
        ],
        bump,
        seeds::program = token_bridge_program
    )]
  /// Token Bridge foreign endpoint. This account should really be one
  /// endpoint per chain, but Token Bridge's PDA allows for multiple
  /// endpoints for each chain. We store the proper endpoint for the
  /// emitter chain.
  pub token_bridge_foreign_endpoint: Account<'info, token_bridge::EndpointRegistration>,

  /// Token Bridge program.
  pub token_bridge_program: Program<'info, token_bridge::program::TokenBridge>,

  /// System program.
  pub system_program: Program<'info, System>,
}
