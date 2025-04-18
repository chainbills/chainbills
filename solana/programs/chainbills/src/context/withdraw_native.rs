use crate::{error::ChainbillsError, state::*};
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
    seeds = [ChainWithdrawalId::SEED_PREFIX, &chain_stats.next_withdrawal().to_le_bytes()[..]],
    bump,
    payer = signer,
    space = ChainWithdrawalId::SPACE
  )]
  /// Keeps the withdrawal_id at chain level. Useful for getting all  on
  /// on this chain.
  pub chain_withdrawal_id: Box<Account<'info, ChainWithdrawalId>>,

  #[account(
        init,
        seeds = [payable.key().as_ref(),
            PayableWithdrawalInfo::SEED_PREFIX,
            &payable.next_withdrawal().to_le_bytes()[..]],
        bump,
        payer = signer,
        space = PayableWithdrawalInfo::SPACE
    )]
  pub payable_withdrawal_info: Box<Account<'info, PayableWithdrawalInfo>>,

  #[account(
    init,
    seeds = [ActivityRecord::SEED_PREFIX, &chain_stats.next_activity().to_le_bytes()[..]],
    bump,
    payer = signer,
    space = ActivityRecord::SPACE
  )]
  /// Houses Details of this activity as Withdrew.
  pub activity: Box<Account<'info, ActivityRecord>>,

  #[account(
    init,
    seeds = [signer.key().as_ref(), ActivityRecord::SEED_PREFIX, &host.next_activity().to_le_bytes()[..]],
    bump,
    payer = signer,
    space = UserActivityInfo::SPACE
  )]
  /// Houses Chain Count of activities for this activity.
  pub user_activity_info: Box<Account<'info, UserActivityInfo>>,

  #[account(
    init,
    seeds = [payable.key().as_ref(), ActivityRecord::SEED_PREFIX, &payable.next_activity().to_le_bytes()[..]],
    bump,
    payer = signer,
    space = PayableActivityInfo::SPACE
  )]
  /// Houses Chain Count of activities for this activity.
  pub payable_activity_info: Box<Account<'info, PayableActivityInfo>>,

  #[account(mut, constraint = payable.host == *signer.key @ ChainbillsError::NotYourPayable)]
  pub payable: Box<Account<'info, Payable>>,

  #[account(mut, seeds = [signer.key().as_ref()], bump)]
  pub host: Box<Account<'info, User>>,

  #[account(mut, seeds = [ChainStats::SEED_PREFIX], bump)]
  pub chain_stats: Box<Account<'info, ChainStats>>,

  #[account(seeds = [Config::SEED_PREFIX], bump)]
  pub config: AccountLoader<'info, Config>,

  #[account(address = config.load()?.chainbills_fee_collector)]
  pub fee_collector: SystemAccount<'info>,

  #[account(seeds = [TokenDetails::SEED_PREFIX, crate::ID.as_ref()], bump)]
  pub token_details: Box<Account<'info, TokenDetails>>,

  #[account(mut)]
  pub signer: Signer<'info>,

  pub system_program: Program<'info, System>,
}
