use crate::state::*;
use anchor_lang::prelude::*;
use wormhole_anchor_sdk::wormhole;

#[derive(Accounts)]
#[instruction(
    description: String,
    tokens_and_amounts: Vec<TokenAndAmount>,
    allows_free_payments: bool
)]
pub struct InitializePayable<'info> {
  #[account(
        init,
        seeds = [
            signer.key().to_bytes().as_ref(),
            Payable::SEED_PREFIX,
            &host.next_payable().to_le_bytes()[..],
        ],
        bump,
        payer = signer,
        space = Payable::SPACE
    )]
  pub payable: Box<Account<'info, Payable>>,

  #[account(mut, seeds = [signer.key().to_bytes().as_ref()], bump)]
  pub host: Box<Account<'info, User>>,

  #[account(mut, seeds = [GlobalStats::SEED_PREFIX], bump)]
  pub global_stats: Box<Account<'info, GlobalStats>>,

  #[account(mut, seeds = [ChainStats::SEED_PREFIX, &wormhole::CHAIN_ID_SOLANA.to_le_bytes()[..]], bump)]
  pub chain_stats: Box<Account<'info, ChainStats>>,

  #[account(mut)]
  pub signer: Signer<'info>,

  pub system_program: Program<'info, System>,
}
