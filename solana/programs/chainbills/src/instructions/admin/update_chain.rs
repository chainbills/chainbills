//! `update_chain` — update an existing ChainRegistry's protocol parameters.

use anchor_lang::prelude::*;

use crate::{
  errors::ChainbillsError,
  events::ChainUpdated,
  state::{ChainRegistry, Config, Stats},
  utils::get_current_timestamp,
};

/// Accounts for the `update_chain` instruction.
#[derive(Accounts)]
pub struct UpdateChain<'info> {
  /// The program owner. Must sign.
  pub owner: Signer<'info>,

  /// Config — validates owner.
  #[account(
        seeds = [Config::SEED_PREFIX],
        bump,
        constraint = config.owner == owner.key() @ ChainbillsError::UnauthorizedOwner,
    )]
  pub config: Account<'info, Config>,

  /// The ChainRegistry to update. Must already exist.
  #[account(
        mut,
        seeds = [ChainRegistry::SEED_PREFIX, chain_registry.cb_chain_id.as_ref()],
        bump,
    )]
  pub chain_registry: Account<'info, ChainRegistry>,

  /// Stats — registered_cctp_chain_count adjusted when has_cctp toggles.
  #[account(mut, seeds = [Stats::SEED_PREFIX], bump)]
  pub stats: Account<'info, Stats>,
}

/// Handler for `update_chain`.
///
/// # Arguments
/// * `ctx`                 — accounts
/// * `has_wormhole`        — new Wormhole flag
/// * `wormhole_chain_id`   — new Wormhole chain ID
/// * `has_cctp`            — new CCTP flag
/// * `circle_domain`       — new Circle domain
/// * `registered_contract` — new registered contract address (32 bytes
///   normalized)
pub fn process_update_chain(
  ctx: Context<UpdateChain>,
  has_wormhole: bool,
  wormhole_chain_id: u16,
  has_cctp: bool,
  circle_domain: u32,
  registered_contract: [u8; 32],
) -> Result<()> {
  require!(
    has_wormhole || has_cctp,
    ChainbillsError::ChainHasNoProtocol
  );

  let now = get_current_timestamp()?;
  let owner = ctx.accounts.owner.key();
  let cb_chain_id = ctx.accounts.chain_registry.cb_chain_id;
  let old_has_cctp = ctx.accounts.chain_registry.has_cctp;

  let registry = &mut ctx.accounts.chain_registry;
  registry.has_wormhole = has_wormhole;
  registry.wormhole_chain_id = wormhole_chain_id;
  registry.has_cctp = has_cctp;
  registry.circle_domain = circle_domain;
  registry.registered_contract = registered_contract;

  // Adjust the CCTP chain count when has_cctp toggles.
  if has_cctp && !old_has_cctp {
    ctx.accounts.stats.increment_registered_cctp_chain_count()?;
  } else if !has_cctp && old_has_cctp {
    ctx.accounts.stats.decrement_registered_cctp_chain_count()?;
  }

  emit!(ChainUpdated {
    cb_chain_id,
    has_wormhole,
    wormhole_chain_id,
    has_cctp,
    circle_domain,
    registered_contract,
    timestamp: now,
  });
  msg!(
    "UpdateChain: cb_chain_id={:?} has_wormhole={} wormhole_chain_id={} \
     has_cctp={} circle_domain={} registered_contract={:?} owner={} timestamp={}",
    cb_chain_id,
    has_wormhole,
    wormhole_chain_id,
    has_cctp,
    circle_domain,
    registered_contract,
    owner,
    now,
  );
  Ok(())
}
