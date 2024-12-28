use crate::{context::*, error::*, events::*};
use anchor_lang::prelude::*;

/// This instruction registers a new foreign contract (from another network)
/// and saves the contract information in a ForeignContract account. This
/// instruction is owner-only, meaning that only the owner of the program
/// (defined in the [Config] account) can add and update contracs.
///
/// ### Arguments
/// * `ctx`     - `RegisterForeignContract` context
/// * `chain_id`   - Wormhole Chain ID
/// * `emitter_address` - Wormhole Emitter Address
#[inline(never)]
pub fn register_foreign_contract_handler(
  ctx: Context<RegisterForeignContract>,
  chain_id: u16,
  emitter_address: [u8; 32],
) -> Result<()> {
  // Foreign contract cannot share the same Wormhole Chain ID as the
  // Solana Wormhole program's. And cannot register a zero address.
  require!(
    chain_id > 0
      && chain_id != ctx.accounts.config.load()?.chain_id
      && !emitter_address.iter().all(|&x| x == 0)
      && emitter_address != crate::ID.to_bytes(),
    ChainbillsError::InvalidForeignContract,
  );

  // Save the contract info into the ForeignContract account.
  let contract = &mut ctx.accounts.registered_foreign_contract;
  contract.chain_id = chain_id;
  contract.emitter_address = emitter_address;

  // Emit log and event.
  msg!("Registered Foreign Contract.");
  emit!(RegisteredForeignContractEvent {
    chain_id,
    emitter_address
  });
  Ok(())
}
