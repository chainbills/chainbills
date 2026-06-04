//! `update_fee_settings` — update global fee_bps and fee_collector.

use anchor_lang::prelude::*;

use crate::{
  errors::ChainbillsError,
  events::FeeSettingsUpdated,
  state::Config,
  utils::get_current_timestamp,
};

/// Accounts for the `update_fee_settings` instruction.
#[derive(Accounts)]
pub struct UpdateFeeSettings<'info> {
  /// The program owner. Must sign.
  pub owner: Signer<'info>,

  /// Config — validated and mutated.
  #[account(
        mut,
        seeds = [Config::SEED_PREFIX],
        bump,
        constraint = config.owner == owner.key() @ ChainbillsError::UnauthorizedOwner,
    )]
  pub config: Account<'info, Config>,

  /// The new fee collector wallet. Receives the fee portion on withdrawals.
  /// CHECK: any pubkey is valid as a fee collector
  pub fee_collector: UncheckedAccount<'info>,
}

/// Handler for `update_fee_settings`.
///
/// # Arguments
/// * `ctx`     — accounts
/// * `fee_bps` — new fee in basis points (must be <= 10_000)
pub fn process_update_fee_settings(
  ctx: Context<UpdateFeeSettings>,
  fee_bps: u16,
) -> Result<()> {
  require!(fee_bps <= 10_000, ChainbillsError::InvalidFeeSettings);

  let now = get_current_timestamp()?;
  let fee_collector = ctx.accounts.fee_collector.key();
  let owner = ctx.accounts.owner.key();

  let cfg = &mut ctx.accounts.config;
  cfg.fee_bps = fee_bps;
  cfg.fee_collector = fee_collector;

  emit!(FeeSettingsUpdated {
    fee_bps,
    fee_collector,
    timestamp: now,
  });
  msg!(
    "UpdateFeeSettings: fee_bps={} fee_collector={} owner={} timestamp={}",
    fee_bps,
    fee_collector,
    owner,
    now,
  );
  Ok(())
}
