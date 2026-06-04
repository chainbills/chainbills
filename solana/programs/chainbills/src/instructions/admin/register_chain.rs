//! `register_chain` — register a foreign chain with Wormhole/CCTP parameters.

use anchor_lang::prelude::*;

use crate::{
  errors::ChainbillsError,
  events::ChainRegistered,
  state::{ChainRegistry, Config, Stats},
  utils::get_current_timestamp,
};

/// Accounts for the `register_chain` instruction.
#[derive(Accounts)]
#[instruction(cb_chain_id: [u8; 32])]
pub struct RegisterChain<'info> {
  /// The program owner. Must sign and pays for the new ChainRegistry account.
  #[account(mut)]
  pub owner: Signer<'info>,

  /// Config — validates owner.
  #[account(
        seeds = [Config::SEED_PREFIX],
        bump,
        constraint = config.owner == owner.key() @ ChainbillsError::UnauthorizedOwner,
    )]
  pub config: Account<'info, Config>,

  /// ChainRegistry PDA for this foreign chain. Created here (init).
  #[account(
        init,
        payer = owner,
        space = ChainRegistry::SPACE,
        seeds = [ChainRegistry::SEED_PREFIX, &cb_chain_id],
        bump,
    )]
  pub chain_registry: Account<'info, ChainRegistry>,

  /// Stats — registered_cctp_chain_count incremented when has_cctp = true.
  #[account(mut, seeds = [Stats::SEED_PREFIX], bump)]
  pub stats: Account<'info, Stats>,

  pub system_program: Program<'info, System>,
}

/// Handler for `register_chain`.
///
/// # Arguments
/// * `ctx`                  — accounts
/// * `cb_chain_id`          — the universal chain key (keccak256 of CAIP-2
///   string)
/// * `has_wormhole`         — whether this chain uses Wormhole
/// * `wormhole_chain_id`    — Wormhole's uint16 chain ID (0 if not applicable)
/// * `has_cctp`             — whether this chain uses Circle CCTP
/// * `circle_domain`        — Circle's uint32 domain (0 if not applicable)
/// * `registered_contract`  — 32-byte normalized address of Chainbills on this
///   chain
pub fn process_register_chain(
  ctx: Context<RegisterChain>,
  cb_chain_id: [u8; 32],
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

  let registry = &mut ctx.accounts.chain_registry;
  registry.cb_chain_id = cb_chain_id;
  registry.has_wormhole = has_wormhole;
  registry.wormhole_chain_id = wormhole_chain_id;
  registry.has_cctp = has_cctp;
  registry.circle_domain = circle_domain;
  registry.registered_contract = registered_contract;

  if has_cctp {
    ctx.accounts.stats.increment_registered_cctp_chain_count()?;
  }

  emit!(ChainRegistered {
    cb_chain_id,
    has_wormhole,
    wormhole_chain_id,
    has_cctp,
    circle_domain,
    registered_contract,
    timestamp: now,
  });
  msg!(
    "RegisterChain: cb_chain_id={:?} has_wormhole={} wormhole_chain_id={} \
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
