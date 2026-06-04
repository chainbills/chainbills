//! `disallow_token` — mark a token as no longer accepted for payments.

use anchor_lang::prelude::*;

use crate::{
  errors::ChainbillsError,
  events::TokenDisallowed,
  state::{Config, TokenConfig},
  utils::get_current_timestamp,
};

/// Accounts for the `disallow_token` instruction.
#[derive(Accounts)]
pub struct DisallowToken<'info> {
  /// The program owner. Must sign.
  pub owner: Signer<'info>,

  /// Config — validates owner.
  #[account(
        seeds = [Config::SEED_PREFIX],
        bump,
        constraint = config.owner == owner.key() @ ChainbillsError::UnauthorizedOwner,
    )]
  pub config: Account<'info, Config>,

  /// The TokenConfig to update. Must already exist.
  #[account(
        mut,
        seeds = [TokenConfig::SEED_PREFIX, token_config.mint.as_ref()],
        bump,
    )]
  pub token_config: Account<'info, TokenConfig>,
}

/// Handler for `disallow_token`.
pub fn process_disallow_token(ctx: Context<DisallowToken>) -> Result<()> {
  let now = get_current_timestamp()?;
  let mint = ctx.accounts.token_config.mint;
  let owner = ctx.accounts.owner.key();

  ctx.accounts.token_config.is_allowed = false;

  emit!(TokenDisallowed { mint, timestamp: now });
  msg!(
    "DisallowToken: mint={} owner={} timestamp={}",
    mint,
    owner,
    now,
  );
  Ok(())
}
