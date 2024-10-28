use crate::{context::InitializeUser, events::*, state::ActivityType};
use anchor_lang::prelude::*;
use solana_program::clock;

/// Initialize a User
///
/// Should be run once for the first time that anyone uses their wallet to
/// interact with this program.
pub fn initialize_user_handler(ctx: Context<InitializeUser>) -> Result<()> {
  // Increment chain count for users and activities.
  let chain_stats = ctx.accounts.chain_stats.as_mut();
  chain_stats.users_count = chain_stats.next_user();
  chain_stats.activities_count = chain_stats.next_activity();

  // Initialize the user.
  let user = ctx.accounts.user.as_mut();
  user.chain_count = chain_stats.users_count;
  user.payables_count = 0;
  user.payments_count = 0;
  user.withdrawals_count = 0;
  user.activities_count = 1; // Start at 1 to record the initialization.

  // Initialize the activity.
  let activity = ctx.accounts.activity.as_mut();
  activity.chain_count = chain_stats.activities_count;
  activity.user_count = user.activities_count;
  activity.payable_count = 0; // Setting 0 because it's not a payable activity.
  activity.timestamp = clock::Clock::get()?.unix_timestamp as u64;
  activity.entity = ctx.accounts.signer.key();
  activity.activity_type = ActivityType::InitializedUser;

  // Initialize the user activity info.
  let user_activity_info = ctx.accounts.user_activity_info.as_mut();
  user_activity_info.chain_count = chain_stats.activities_count;

  // Emit log and event.
  msg!("Initialized User with chain_count: {}.", user.chain_count);
  emit!(InitializedUser {
    wallet: ctx.accounts.signer.key(),
    chain_count: user.chain_count
  });
  Ok(())
}
