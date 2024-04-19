use crate::{context::Initialize, events::*};
use anchor_lang::prelude::*;
use wormhole_anchor_sdk::wormhole;

/// Initialize the Config and GlobalStats.
///
/// Should be run once by the deployer of the program
/// before other instructions in this program should be invoked.
pub fn initialize_handler(ctx: Context<Initialize>) -> Result<()> {
  // Initialize config account.
  let config = ctx.accounts.config.as_mut();
  config.owner = ctx.accounts.owner.key();
  config.wormhole_bridge = ctx.accounts.wormhole_bridge.key();
  config.token_bridge_config = ctx.accounts.token_bridge_config.key();
  config.emitter = ctx.accounts.emitter.key();
  config.fee_collector = ctx.accounts.fee_collector.key();
  config.sequence = ctx.accounts.sequence.key();
  config.mint_authority = ctx.accounts.mint_authority.key();
  config.custody_signer = ctx.accounts.custody_signer.key();
  config.authority_signer = ctx.accounts.authority_signer.key();
  config.batch_id = 0; // 0 means no batching
  config.finality = wormhole::Finality::Confirmed as u8;

  // Initialize global_stats account.
  let global_stats = ctx.accounts.global_stats.as_mut();
  global_stats.initialize();

  // Initialize Solana's chain_stats account.
  let chain_stats = ctx.accounts.chain_stats.as_mut();
  chain_stats.initialize(wormhole::CHAIN_ID_SOLANA);

  msg!("Initialized Config, GlobalStats, and Solana's ChainStats.");
  emit!(InitializedEvent {});
  Ok(())
}
