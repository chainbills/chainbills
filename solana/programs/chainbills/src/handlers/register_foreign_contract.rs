use crate::{context::RegisterForeignContract, error::ChainbillsError, events::*};
use anchor_lang::prelude::*;
use wormhole_anchor_sdk::wormhole;

/// This instruction registers a new foreign contract (from another network)
/// and saves the contract information in a ForeignContract account. This
/// instruction is owner-only, meaning that only the owner of the program
/// (defined in the [Config] account) can add and update contracs.
///
/// ### Arguments
/// * `ctx`     - `RegisterForeignEmitter` context
/// * `chain`   - Wormhole Chain ID
/// * `address` - Wormhole Emitter Address
pub fn register_foreign_contract_handler(
  ctx: Context<RegisterForeignContract>,
  chain: u16,
  address: [u8; 32],
) -> Result<()> {
  // Foreign contract cannot share the same Wormhole Chain ID as the
  // Solana Wormhole program's. And cannot register a zero address.
  require!(
    chain > 0 && chain != wormhole::CHAIN_ID_SOLANA && !address.iter().all(|&x| x == 0),
    ChainbillsError::InvalidForeignContract,
  );

  // Save the contract info into the ForeignContract account.
  let contract = &mut ctx.accounts.foreign_contract;
  contract.chain = chain;
  contract.address = address;
  contract.token_bridge_foreign_endpoint = ctx.accounts.token_bridge_foreign_endpoint.key();

  let chain_stats = ctx.accounts.chain_stats.as_mut();
  if chain_stats.to_account_info().data_is_empty() {
    // Initialize the chain_stats for this new contract's chain if not done b4.
    chain_stats.initialize(chain);
  } else {
    // Else, Ensure the right chain_stats was provided
    require!(
      chain_stats.chain_id == chain,
      ChainbillsError::WrongChainStatsProvided
    );
  }

  msg!("Registered Foreign Contract and its ChainStats");
  emit!(RegisteredForeignContractEvent {});
  Ok(())
}
