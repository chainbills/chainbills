use crate::{context::InitializeUser, events::*};
use anchor_lang::prelude::*;
use wormhole_anchor_sdk::wormhole::CHAIN_ID_SOLANA;

/// Initialize a User
///
/// Should be run once for the first time that anyone uses their wallet to
/// interact with this program.
pub fn initialize_user_handler(ctx: Context<InitializeUser>) -> Result<()> {
  // increment global count for users
  let global_stats = ctx.accounts.global_stats.as_mut();
  global_stats.users_count = global_stats.next_user();

  // increment chain count for users
  let chain_stats = ctx.accounts.chain_stats.as_mut();
  chain_stats.users_count = chain_stats.next_user();

  // initialize the user
  let user = ctx.accounts.user.as_mut();
  user.owner_wallet = ctx.accounts.signer.key().to_bytes();
  user.chain_id = CHAIN_ID_SOLANA;
  user.global_count = global_stats.users_count;
  user.chain_count = chain_stats.users_count;
  user.payables_count = 0;
  user.payments_count = 0;
  user.withdrawals_count = 0;

  msg!(
    "Initialized User with global_count: {} and chain_count: {}.",
    user.global_count,
    user.chain_count
  );
  emit!(InitializedUserEvent {
    global_count: user.global_count,
    chain_count: user.chain_count,
  });
  Ok(())
}
