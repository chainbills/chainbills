use crate::{error::ChainbillsError, state::*};
use anchor_lang::prelude::*;
use anchor_spl::token::{Mint, Token, TokenAccount};


#[derive(Accounts)]
pub struct OwnerWithdraw<'info> {
  pub mint: Box<Account<'info, Mint>>,

  #[account(mut, seeds = [ChainStats::SEED_PREFIX], bump)]
  pub chain_stats: Box<Account<'info, ChainStats>>,

  #[account(
        mut,
        associated_token::mint = mint,
        associated_token::authority = chain_stats,
    )]
  pub chain_token_account: Box<Account<'info, TokenAccount>>,

  #[account(
        mut,
        associated_token::mint = mint,
        associated_token::authority = owner,
    )]
  pub owner_token_account: Box<Account<'info, TokenAccount>>,

  #[account(seeds = [Config::SEED_PREFIX], bump)]
  pub config: AccountLoader<'info, Config>,

  #[account(mut, address = config.load()?.owner @ ChainbillsError::OwnerUnauthorized)]
  pub owner: Signer<'info>,

  pub token_program: Program<'info, Token>,
}
