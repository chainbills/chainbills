use crate::state::*;
use anchor_lang::prelude::*;
use anchor_spl::token::{Mint, Token, TokenAccount};

#[derive(Accounts)]
#[instruction(amount: u64)]
pub struct Pay<'info> {
  #[account(
        init,
        seeds = [
            signer.key().to_bytes().as_ref(),
            Payment::SEED_PREFIX,
            &payer.next_payment().to_le_bytes()[..]
        ],
        bump,
        payer = signer,
        space = Payment::SPACE
    )]
  pub payment: Box<Account<'info, Payment>>,

  #[account(mut)]
  pub payable: Box<Account<'info, Payable>>,

  #[account(mut, seeds = [signer.key().to_bytes().as_ref()], bump)]
  pub payer: Box<Account<'info, User>>,

  #[account(mut, seeds=[GlobalStats::SEED_PREFIX], bump)]
  pub global_stats: Box<Account<'info, GlobalStats>>,

  pub mint: Box<Account<'info, Mint>>,

  #[account(
        mut,
        associated_token::mint = mint,
        associated_token::authority = signer,
    )]
  pub payer_token_account: Box<Account<'info, TokenAccount>>,

  #[account(
        mut,
        associated_token::mint = mint,
        associated_token::authority = global_stats,
    )]
  pub global_token_account: Box<Account<'info, TokenAccount>>,

  #[account(mut)]
  pub signer: Signer<'info>,

  pub token_program: Program<'info, Token>,

  pub system_program: Program<'info, System>,
}
