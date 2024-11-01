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
    init,
    seeds = [ChainUserPaymentId::SEED_PREFIX, &chain_stats.next_user_payment().to_le_bytes()[..]],
    bump,
    payer = signer,
    space = ChainUserPaymentId::SPACE
  )]
  /// Keeps the user_payment_id at chain level. Useful for getting all 
  /// user payments on this chain.
  pub chain_user_payment_id: Box<Account<'info, ChainUserPaymentId>>,

  #[account(
    init,
    seeds = [ChainPayablePaymentId::SEED_PREFIX, &chain_stats.next_payable_payment().to_le_bytes()[..]],
    bump,
    payer = signer,
    space = ChainPayablePaymentId::SPACE
  )]
  /// Keeps the payable_payment_id at chain level. Useful for getting all 
  /// payable payments on this chain.
  pub chain_payable_payment_id: Box<Account<'info, ChainPayablePaymentId>>,

  #[account(
        init,
        seeds = [
            payable.key().as_ref(),
            &config.load()?.chain_id.to_le_bytes()[..],
            &payable_per_chain_payments_counter.next_payment().to_le_bytes()[..]
        ],
        bump,
        payer = signer,
        space = PayablePerChainPaymentInfo::SPACE
    )]
  pub payable_per_chain_payment_info:
    Box<Account<'info, PayablePerChainPaymentInfo>>,

  #[account(
        mut,
        seeds = [
            payable.key().as_ref(),
            &config.load()?.chain_id.to_le_bytes()[..],
        ],
        bump
    )]
  pub payable_per_chain_payments_counter:
    Box<Account<'info, PayablePerChainPaymentsCounter>>,

  #[account(
    init,
    seeds = [ActivityRecord::SEED_PREFIX, &chain_stats.next_activity().to_le_bytes()[..]],
    bump,
    payer = signer,
    space = ActivityRecord::SPACE
  )]
  /// Houses Details of this activity as one of UserPaid.
  pub user_activity: Box<Account<'info, ActivityRecord>>,

  #[account(
    init,
    seeds = [signer.key().as_ref(), ActivityRecord::SEED_PREFIX, &payer.next_activity().to_le_bytes()[..]],
    bump,
    payer = signer,
    space = UserActivityInfo::SPACE
  )]
  /// Houses Chain Count of activities for this activity.
  pub user_activity_info: Box<Account<'info, UserActivityInfo>>,

  #[account(
    init,
    // added 1 to chain_stats.next_activity() because the previous addition in this same transaction is for the user activity
    seeds = [ActivityRecord::SEED_PREFIX, &(chain_stats.next_activity().checked_add(1).unwrap()).to_le_bytes()[..]], 
    bump,
    payer = signer,
    space = ActivityRecord::SPACE
  )]
  /// Houses Details of this activity as one of PayableReceived.
  pub payable_activity: Box<Account<'info, ActivityRecord>>,

  #[account(
    init,
    seeds = [payable.key().as_ref(), ActivityRecord::SEED_PREFIX, &payable.next_activity().to_le_bytes()[..]],
    bump,
    payer = signer,
    space = PayableActivityInfo::SPACE
  )]
  /// Houses Chain Count of activities for this activity.
  pub payable_activity_info: Box<Account<'info, PayableActivityInfo>>,

  #[account(mut, realloc = payable.space_update_balance(mint.key()), realloc::payer = signer, realloc::zero = false)]
  pub payable: Box<Account<'info, Payable>>,

  #[account(mut, seeds = [signer.key().as_ref()], bump)]
  pub payer: Box<Account<'info, User>>,

  #[account(mut, seeds = [ChainStats::SEED_PREFIX], bump)]
  pub chain_stats: Box<Account<'info, ChainStats>>,

  #[account(seeds = [Config::SEED_PREFIX], bump)]
  pub config: AccountLoader<'info, Config>,

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
