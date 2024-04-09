use crate::state::*;
use anchor_lang::prelude::*;

#[derive(Accounts)]
pub struct InitializeUser<'info> {
  #[account(
    init,
    seeds = [signer.key().to_bytes().as_ref()],
    bump,
    payer = signer,
    space = User::SPACE
  )]
  pub user: Box<Account<'info, User>>,

  #[account(mut, seeds=[GlobalStats::SEED_PREFIX], bump)]
  pub global_stats: Box<Account<'info, GlobalStats>>,

  #[account(mut)]
  pub signer: Signer<'info>,

  pub system_program: Program<'info, System>,
}
