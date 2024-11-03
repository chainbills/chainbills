use crate::{error::ChainbillsError, state::*};
use anchor_lang::prelude::*;
use wormhole_anchor_sdk::wormhole::{self, program::Wormhole};

#[derive(Accounts)]
#[instruction(allowed_tokens_and_amounts: Vec<TokenAndAmount>)]
/// Context used to create a Payable.
pub struct CreatePayable<'info> {
  #[account(
        init,
        seeds = [
            signer.key().as_ref(),
            Payable::SEED_PREFIX,
            &host.next_payable().to_le_bytes()[..],
        ],
        bump,
        payer = signer,
        space = Payable::space_new(allowed_tokens_and_amounts.len())
    )]
  /// The payable account to create. It houses details about the payable.
  pub payable: Box<Account<'info, Payable>>,

  #[account(
    init,
    seeds = [ChainPayableId::SEED_PREFIX, &chain_stats.next_payable().to_le_bytes()[..]],
    bump,
    payer = signer,
    space = ChainPayableId::SPACE
  )]
  /// Keeps the payable_id at chain level. Useful for getting all payables on
  /// this chain.
  pub chain_payable_id: Box<Account<'info, ChainPayableId>>,

  #[account(
        init,
        seeds = [
            payable.key().as_ref(),
            &config.load()?.chain_id.to_le_bytes()[..],
        ],
        bump,
        payer = signer,
        space = PayablePerChainPaymentsCounter::SPACE
    )]
  /// The payable chain counter account to create. It houses the payments_count
  /// for the payable per chain.
  pub payable_per_chain_payments_counter:
    Box<Account<'info, PayablePerChainPaymentsCounter>>,

  #[account(
    init,
    seeds = [ActivityRecord::SEED_PREFIX, &chain_stats.next_activity().to_le_bytes()[..]],
    bump,
    payer = signer,
    space = ActivityRecord::SPACE
  )]
  /// Houses Details of this activity as CreatedPayable.
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

  #[account(mut, seeds = [signer.key().to_bytes().as_ref()], bump)]
  /// The user account of the signer that is creating the payable.
  pub host: Box<Account<'info, User>>,

  #[account(mut, seeds = [ChainStats::SEED_PREFIX], bump)]
  /// Keeps track of entities on this chain. Its payable_count will be
  /// incremented in this instruction.
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
  /// The signer of the transaction.
  pub signer: Signer<'info>,

  /// Clock sysvar.
  pub clock: Sysvar<'info, Clock>,

  /// Rent sysvar.
  pub rent: Sysvar<'info, Rent>,

  /// The system program account.
  pub system_program: Program<'info, System>,
}
