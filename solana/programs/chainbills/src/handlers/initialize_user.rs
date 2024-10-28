use crate::{context::InitializeUser, events::*};
use anchor_lang::prelude::*;

/// Initialize a User
///
/// Should be run once for the first time that anyone uses their wallet to
/// interact with this program.
pub fn initialize_user_handler(ctx: Context<InitializeUser>) -> Result<()> {
  // Increment chain count for users.
  let chain_stats = ctx.accounts.chain_stats.as_mut();
  chain_stats.users_count = chain_stats.next_user();

  // Initialize the user.
  let user = ctx.accounts.user.as_mut();
  user.chain_count = chain_stats.users_count;
  user.payables_count = 0;
  user.payments_count = 0;
  user.withdrawals_count = 0;

  // Emit log and event.
  msg!("Initialized User with chain_count: {}.", user.chain_count);
  emit!(InitializedUserEvent {
    wallet: ctx.accounts.signer.key(),
    chain_count: user.chain_count
  });
  Ok(())
}
