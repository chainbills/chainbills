use crate::{error::ChainbillsError, program::Chainbills, state::GlobalStats};
use anchor_lang::prelude::*;
use anchor_spl::token::{Mint, Token, TokenAccount};

#[derive(Accounts)]
#[instruction(amount: u64)]
pub struct OwnerWithdraw<'info> {
  pub mint: Box<Account<'info, Mint>>,

  #[account(seeds = [GlobalStats::SEED_PREFIX], bump)]
  pub global_stats: Box<Account<'info, GlobalStats>>,

  #[account(
        address = crate::ID,
        constraint = this_program.programdata_address()? == Some(this_program_data.key()) @ ChainbillsError::ProgramDataUnauthorized
    )]
  pub this_program: Program<'info, Chainbills>,

  #[account(constraint = this_program_data.upgrade_authority_address == Some(admin.key()) @ ChainbillsError::AdminUnauthorized)]
  pub this_program_data: Box<Account<'info, ProgramData>>,

  #[account(
        mut,
        associated_token::mint = mint,
        associated_token::authority = global_stats,
    )]
  pub global_token_account: Box<Account<'info, TokenAccount>>,

  #[account(
        mut,
        associated_token::mint = mint,
        associated_token::authority = admin,
    )]
  pub admin_token_account: Box<Account<'info, TokenAccount>>,

  pub admin: Signer<'info>,

  pub token_program: Program<'info, Token>,
}
