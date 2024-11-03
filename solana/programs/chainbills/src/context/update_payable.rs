use crate::{error::ChainbillsError, state::*};
use anchor_lang::prelude::*;
use wormhole_anchor_sdk::wormhole::{self, program::Wormhole};

#[derive(Accounts)]
pub struct UpdatePayable<'info> {
  #[account(mut, constraint = payable.host == *signer.key @ ChainbillsError::NotYourPayable)]
  pub payable: Box<Account<'info, Payable>>,

  #[account(
    init,
    seeds = [ActivityRecord::SEED_PREFIX, &chain_stats.next_activity().to_le_bytes()[..]],
    bump,
    payer = signer,
    space = ActivityRecord::SPACE
  )]
  /// Houses Details of this activity as one of ClosedPayable or ReopenedPayable.
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

  #[account(seeds = [signer.key().as_ref()], bump)]
  pub host: Box<Account<'info, User>>,

  #[account(mut, seeds = [ChainStats::SEED_PREFIX], bump)]
  pub chain_stats: Box<Account<'info, ChainStats>>,

  #[account(seeds = [Config::SEED_PREFIX], bump)]
  pub config: AccountLoader<'info, Config>,

  /// Wormhole program.
  pub wormhole_program: Program<'info, Wormhole>,

  #[account(
        mut,
        address = config.load()?.wormhole_bridge @ ChainbillsError::InvalidWormholeConfig
    )]
  /// Wormhole bridge data. [`wormhole::post_message`] requires this account
  /// be mutable.
  pub wormhole_bridge: Account<'info, wormhole::BridgeData>,

  #[account(
        mut,
        address = config.load()?.wormhole_fee_collector @ ChainbillsError::InvalidWormholeFeeCollector
    )]
  /// Wormhole fee collector. [`wormhole::post_message`] requires this
  /// account be mutable.
  pub wormhole_fee_collector: Account<'info, wormhole::FeeCollector>,

  #[account(
        seeds = [wormhole::SEED_PREFIX_EMITTER],
        bump,
    )]
  /// Program's emitter account. Read-only.
  pub wormhole_emitter: Account<'info, Empty>,

  #[account(
        mut,
        address = config.load()?.wormhole_sequence @ ChainbillsError::InvalidWormholeSequence
    )]
  /// Emitter's sequence account. [`wormhole::post_message`] requires this
  /// account be mutable.
  pub wormhole_sequence: Account<'info, wormhole::SequenceTracker>,

  #[account(
        mut,
        seeds = [
            SEED_PREFIX_SENT,
            &wormhole_sequence.next_value().to_le_bytes()[..]
        ],
        bump,
    )]
  /// CHECK: Wormhole Message. [`wormhole::post_message`] requires this
  /// account be mutable.
  pub wormhole_message: UncheckedAccount<'info>,

  #[account(mut)]
  pub signer: Signer<'info>,

  /// Clock sysvar.
  pub clock: Sysvar<'info, Clock>,

  /// Rent sysvar.
  pub rent: Sysvar<'info, Rent>,

  pub system_program: Program<'info, System>,
}

#[derive(Accounts)]
#[instruction(allowed_tokens_and_amounts: Vec<TokenAndAmount>)]
pub struct UpdatePayableAllowedTokensAndAmounts<'info> {
  // Allowing realloc::zero to be true if in case the allowed tokens and
  // amounts vec's len is lower than the previous one. This will allow the
  // program to refresh zeroing out discarded space as needed.
  #[account(mut, constraint = payable.host == *signer.key @ ChainbillsError::NotYourPayable, realloc = payable.space_update_ataa(allowed_tokens_and_amounts.len()), realloc::payer = signer, realloc::zero = true)]
  pub payable: Box<Account<'info, Payable>>,

  #[account(
    init,
    seeds = [ActivityRecord::SEED_PREFIX, &chain_stats.next_activity().to_le_bytes()[..]],
    bump,
    payer = signer,
    space = ActivityRecord::SPACE
  )]
  /// Houses Details of this activity as one of UpdatePayableTokensAndAmounts.
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

  #[account(seeds = [signer.key().as_ref()], bump)]
  pub host: Box<Account<'info, User>>,

  #[account(mut, seeds = [ChainStats::SEED_PREFIX], bump)]
  pub chain_stats: Box<Account<'info, ChainStats>>,

  #[account(seeds = [Config::SEED_PREFIX], bump)]
  pub config: AccountLoader<'info, Config>,

  /// Wormhole program.
  pub wormhole_program: Program<'info, Wormhole>,

  #[account(
        mut,
        address = config.load()?.wormhole_bridge @ ChainbillsError::InvalidWormholeConfig
    )]
  /// Wormhole bridge data. [`wormhole::post_message`] requires this account
  /// be mutable.
  pub wormhole_bridge: Account<'info, wormhole::BridgeData>,

  #[account(
        mut,
        address = config.load()?.wormhole_fee_collector @ ChainbillsError::InvalidWormholeFeeCollector
    )]
  /// Wormhole fee collector. [`wormhole::post_message`] requires this
  /// account be mutable.
  pub wormhole_fee_collector: Account<'info, wormhole::FeeCollector>,

  #[account(
        seeds = [wormhole::SEED_PREFIX_EMITTER],
        bump,
    )]
  /// Program's emitter account. Read-only.
  pub wormhole_emitter: Account<'info, Empty>,

  #[account(
        mut,
        address = config.load()?.wormhole_sequence @ ChainbillsError::InvalidWormholeSequence
    )]
  /// Emitter's sequence account. [`wormhole::post_message`] requires this
  /// account be mutable.
  pub wormhole_sequence: Account<'info, wormhole::SequenceTracker>,

  #[account(
        mut,
        seeds = [
            SEED_PREFIX_SENT,
            &wormhole_sequence.next_value().to_le_bytes()[..]
        ],
        bump,
    )]
  /// CHECK: Wormhole Message. [`wormhole::post_message`] requires this
  /// account be mutable.
  pub wormhole_message: UncheckedAccount<'info>,

  #[account(mut)]
  pub signer: Signer<'info>,

  /// Clock sysvar.
  pub clock: Sysvar<'info, Clock>,

  /// Rent sysvar.
  pub rent: Sysvar<'info, Rent>,

  pub system_program: Program<'info, System>,
}
