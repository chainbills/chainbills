use crate::state::*;
use anchor_lang::prelude::*;

#[derive(Accounts)]
pub struct WithdrawNative<'info> {
  #[account(
        init,
        seeds = [signer.key().as_ref(),
            Withdrawal::SEED_PREFIX,
            &host.next_withdrawal().to_le_bytes()[..]],
        bump,
        payer = signer,
        space = Withdrawal::SPACE
    )]
  pub withdrawal: Box<Account<'info, Withdrawal>>,

  #[account(
        init,
        seeds = [payable.key().as_ref(),
            PayableWithdrawalCounter::SEED_PREFIX,
            &payable.next_withdrawal().to_le_bytes()[..]],
        bump,
        payer = signer,
        space = PayableWithdrawalCounter::SPACE
    )]
  pub payable_withdrawal_counter: Box<Account<'info, PayableWithdrawalCounter>>,

  #[account(mut, has_one = host)]
  pub payable: Box<Account<'info, Payable>>,

  #[account(mut, seeds = [signer.key().as_ref()], bump)]
  pub host: Box<Account<'info, User>>,

  #[account(mut, seeds = [ChainStats::SEED_PREFIX], bump)]
  pub chain_stats: Box<Account<'info, ChainStats>>,

  #[account(seeds = [Config::SEED_PREFIX], bump)]
  pub config: AccountLoader<'info, Config>,

  #[account(address = config.load()?.chainbills_fee_collector)]
  pub fee_collector: SystemAccount<'info>,

  #[account(seeds = [MaxFeeDetails::SEED_PREFIX, crate::ID.as_ref()], bump)]
  pub max_withdrawal_fee_details: Box<Account<'info, MaxFeeDetails>>,

  #[account(mut)]
  pub signer: Signer<'info>,

  pub system_program: Program<'info, System>,
}
