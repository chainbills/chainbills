use crate::state::*;
use anchor_lang::prelude::*;

#[derive(Accounts)]
/// Context used to initialize a User.
pub struct InitializeUser<'info> {
  #[account(
    init,
    seeds = [signer.key().as_ref()],
    bump,
    payer = signer,
    space = User::SPACE
  )]
  /// The PDA account to create. It houses details about the user. Keeps track
  /// of the count of entities created by the user.
  pub user: Box<Account<'info, User>>,

  #[account(
    init,
    seeds = [UserAddress::SEED_PREFIX, &chain_stats.next_user().to_le_bytes()[..]],
    bump,
    payer = signer,
    space = User::SPACE
  )]
  /// Keeps the wallet address of the user.
  pub user_address: Box<Account<'info, UserAddress>>,

  #[account(
    init,
    seeds = [ActivityRecord::SEED_PREFIX, &chain_stats.next_activity().to_le_bytes()[..]],
    bump,
    payer = signer,
    space = ActivityRecord::SPACE
  )]
  /// Houses Details of this activity as InitializedUser.
  pub activity: Box<Account<'info, ActivityRecord>>,

  #[account(
    init,
    seeds = [signer.key().as_ref(), ActivityRecord::SEED_PREFIX, &user.next_activity().to_le_bytes()[..]],
    bump,
    payer = signer,
    space = UserActivityInfo::SPACE
  )]
  /// Houses Chain Count of activities for this activity.
  pub user_activity_info: Box<Account<'info, UserActivityInfo>>,

  #[account(mut, seeds = [ChainStats::SEED_PREFIX], bump)]
  /// Keeps track of entities on this chain. Its user_count will be
  /// incremented in this instruction.
  pub chain_stats: Box<Account<'info, ChainStats>>,

  #[account(mut)]
  /// The signer of the transaction.
  pub signer: Signer<'info>,

  /// The system program account.
  pub system_program: Program<'info, System>,
}
