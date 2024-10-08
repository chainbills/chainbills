use crate::state::*;
use anchor_lang::prelude::*;


#[derive(Accounts)]
pub struct PayNative<'info> {
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

  #[account(mut)]
  pub payable: Box<Account<'info, Payable>>,

  #[account(mut, seeds = [signer.key().as_ref()], bump)]
  pub payer: Box<Account<'info, User>>,

  #[account(mut, seeds = [ChainStats::SEED_PREFIX], bump)]
  pub chain_stats: Box<Account<'info, ChainStats>>,

  #[account(seeds = [MaxFeeDetails::SEED_PREFIX, crate::ID.as_ref()], bump)]
  pub max_withdrawal_fee_details: Box<Account<'info, MaxFeeDetails>>,

  #[account(mut)]
  pub signer: Signer<'info>,

  pub system_program: Program<'info, System>,
}
