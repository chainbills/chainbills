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
        init,
        seeds = [
            payable.key().as_ref(),
            &chain_stats.chain_id.to_le_bytes()[..],
            &payable_per_chain_payments_counter.next_payment().to_le_bytes()[..]
        ],
        bump,
        payer = signer,
        space = PayablePerChainPayment::SPACE
    )]
  pub payable_per_chain_payment: Box<Account<'info, PayablePerChainPayment>>,

  #[account(
        mut,
        seeds = [
            payable.key().as_ref(),
            &chain_stats.chain_id.to_le_bytes()[..],
        ],
        bump
    )]
  pub payable_per_chain_payments_counter:
    Box<Account<'info, PayablePerChainPaymentsCounter>>,

  #[account(mut, realloc = payable.space_update_balance(crate::ID), realloc::payer = signer, realloc::zero = false)]
  pub payable: Box<Account<'info, Payable>>,

  #[account(mut, seeds = [signer.key().as_ref()], bump)]
  pub payer: Box<Account<'info, User>>,

  #[account(mut, seeds = [ChainStats::SEED_PREFIX], bump)]
  pub chain_stats: Box<Account<'info, ChainStats>>,

  #[account(seeds = [TokenDetails::SEED_PREFIX, crate::ID.as_ref()], bump)]
  pub token_details: Box<Account<'info, TokenDetails>>,

  #[account(mut)]
  pub signer: Signer<'info>,

  pub system_program: Program<'info, System>,
}
