use crate::{
  context::RegisterForeignContract, error::ChainbillsError, events::*,
};
use anchor_lang::prelude::*;

/// This instruction registers a new foreign contract (from another network)
/// and saves the contract information in a ForeignContract account. This
/// instruction is owner-only, meaning that only the owner of the program
/// (defined in the [Config] account) can add and update contracs.
///
/// ### Arguments
/// * `ctx`     - `RegisterForeignContract` context
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
    chain > 0
      && chain != ctx.accounts.chain_stats.chain_id
      && !address.iter().all(|&x| x == 0),
    ChainbillsError::InvalidForeignContract,
  );

  // Save the contract info into the ForeignContract account.
  let contract = &mut ctx.accounts.foreign_contract;
  contract.address = address;

  // Emit log and event.
  msg!("Registered Foreign Contract and its ChainStats");
  emit!(RegisteredForeignContractEvent {
    chain_id: chain,
    emitter: address
  });
  Ok(())
}
