//! `allow_token` — create or update a TokenConfig PDA, marking a mint as
//! accepted.

use anchor_lang::prelude::*;
use anchor_spl::token_interface::{Mint, TokenInterface};

use crate::{
  errors::ChainbillsError,
  events::TokenAllowed,
  state::{Config, TokenConfig},
  utils::get_current_timestamp,
};

/// Accounts for the `allow_token` instruction.
#[derive(Accounts)]
pub struct AllowToken<'info> {
  /// The program owner. Must sign.
  #[account(mut)]
  pub owner: Signer<'info>,

  /// Config — validates owner.
  #[account(
        seeds = [Config::SEED_PREFIX],
        bump,
        constraint = config.owner == owner.key() @ ChainbillsError::UnauthorizedOwner,
    )]
  pub config: Account<'info, Config>,

  /// The token mint to allow. Must be owned by a recognized token program.
  pub token_mint: InterfaceAccount<'info, Mint>,

  /// TokenConfig PDA for this mint. Created if it doesn't exist yet.
  #[account(
        init_if_needed,
        payer = owner,
        space = TokenConfig::SPACE,
        seeds = [TokenConfig::SEED_PREFIX, token_mint.key().as_ref()],
        bump,
    )]
  pub token_config: Account<'info, TokenConfig>,

  /// Token program — needed to validate the mint account.
  pub token_program: Interface<'info, TokenInterface>,
  pub system_program: Program<'info, System>,
}

/// Handler for `allow_token`.
///
/// # Arguments
/// * `ctx`                — accounts
/// * `max_withdrawal_fee` — fee cap in token base units for this mint
pub fn process_allow_token(
  ctx: Context<AllowToken>,
  max_withdrawal_fee: u64,
) -> Result<()> {
  let now = get_current_timestamp()?;
  let token_config = &mut ctx.accounts.token_config;
  let mint = ctx.accounts.token_mint.key();
  let owner = ctx.accounts.owner.key();

  token_config.mint = mint;
  token_config.is_allowed = true;
  token_config.max_withdrawal_fee = max_withdrawal_fee;

  emit!(TokenAllowed {
    mint,
    max_withdrawal_fee,
    timestamp: now,
  });
  msg!(
    "AllowToken: mint={} max_withdrawal_fee={} owner={} timestamp={}",
    mint,
    max_withdrawal_fee,
    owner,
    now,
  );
  Ok(())
}
