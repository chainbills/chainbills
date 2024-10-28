use crate::state::*;
use anchor_lang::prelude::*;
use anchor_spl::token::{Mint, Token, TokenAccount};

#[derive(Accounts)]
pub struct Pay<'info> {
  #[account(
        init,
        seeds = [
            signer.key().as_ref(),
            UserPayment::SEED_PREFIX,
            &payer.next_payment().to_le_bytes()[..]
        ],
        bump,
        payer = signer,
        space = UserPayment::SPACE
    )]
  pub user_payment: Box<Account<'info, UserPayment>>,

  #[account(
        init,
        seeds = [
            payable.key().as_ref(),
            PayablePayment::SEED_PREFIX,
            &payable.next_payment().to_le_bytes()[..]
        ],
        bump,
        payer = signer,
        space = UserPayment::SPACE
    )]
  pub payable_payment: Box<Account<'info, PayablePayment>>,

  #[account(
        mut,
        seeds = [
            payable.key().as_ref(),
            &chain_stats.chain_id.to_le_bytes()[..],
        ],
        bump
    )]
  pub payable_chain_counter: Box<Account<'info, PayableChainCounter>>,

  #[account(mut, realloc = payable.space_update_balance(mint.key()), realloc::payer = signer, realloc::zero = false)]
  pub payable: Box<Account<'info, Payable>>,

  #[account(mut, seeds = [signer.key().as_ref()], bump)]
  pub payer: Box<Account<'info, User>>,

  #[account(mut, seeds = [ChainStats::SEED_PREFIX], bump)]
  pub chain_stats: Box<Account<'info, ChainStats>>,

  pub mint: Box<Account<'info, Mint>>,

  #[account(seeds = [TokenDetails::SEED_PREFIX, mint.key().as_ref()], bump)]
  pub token_details: Box<Account<'info, TokenDetails>>,

  #[account(
        mut,
        associated_token::mint = mint,
        associated_token::authority = signer,
    )]
  pub payer_token_account: Box<Account<'info, TokenAccount>>,

  #[account(
        mut,
        associated_token::mint = mint,
        associated_token::authority = chain_stats,
    )]
  pub chain_token_account: Box<Account<'info, TokenAccount>>,

  #[account(mut)]
  pub signer: Signer<'info>,

  pub token_program: Program<'info, Token>,

  pub system_program: Program<'info, System>,
}
