use crate::state::*;
use anchor_lang::prelude::*;
use anchor_spl::token::{Mint, Token, TokenAccount};
use wormhole_anchor_sdk::wormhole;

#[derive(Accounts)]
#[instruction(amount: u64)]
pub struct Withdraw<'info> {
  #[account(
        init,
        seeds = [signer.key().to_bytes().as_ref(),
            Withdrawal::SEED_PREFIX,
            &host.next_withdrawal().to_le_bytes()[..]],
        bump,
        payer = signer,
        space = Withdrawal::SPACE
    )]
  pub withdrawal: Box<Account<'info, Withdrawal>>,

  #[account(mut, has_one = host)]
  pub payable: Box<Account<'info, Payable>>,

  #[account(mut, seeds = [signer.key().to_bytes().as_ref()], bump)]
  pub host: Box<Account<'info, User>>,

  #[account(mut, seeds = [GlobalStats::SEED_PREFIX], bump)]
  pub global_stats: Box<Account<'info, GlobalStats>>,

  #[account(mut, seeds = [ChainStats::SEED_PREFIX, &wormhole::CHAIN_ID_SOLANA.to_le_bytes()[..]], bump)]
  pub chain_stats: Box<Account<'info, ChainStats>>,

  #[account(seeds = [Config::SEED_PREFIX], bump)]
  pub config: Box<Account<'info, Config>>,

  pub mint: Box<Account<'info, Mint>>,

  #[account(
        mut,
        associated_token::mint = mint,
        associated_token::authority = signer,
    )]
  pub host_token_account: Box<Account<'info, TokenAccount>>,

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
