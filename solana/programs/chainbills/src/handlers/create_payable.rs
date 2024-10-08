use crate::{context::*, error::ChainbillsError, events::*, state::*};
use anchor_lang::{prelude::*, solana_program::clock};

/// Create a Payable
///
/// ### args
/// * allowed_tokens_and_amounts<Vec<TokenAndAmount>>: The allowed tokens
///         (and their amounts) on this payable. If this vector is empty,
///         then the payable will accept payments in any token.
pub fn create_payable_handler(
  ctx: Context<CreatePayable>,
  allowed_tokens_and_amounts: Vec<TokenAndAmount>,
) -> Result<()> {
  /* CHECKS */
  // Ensure that the number of specified acceptable tokens (and their amounts)
  // for payments don't exceed the set maximum.
  require!(
    allowed_tokens_and_amounts.len() <= Payable::MAX_PAYABLES_TOKENS,
    ChainbillsError::MaxPayableTokensCapacityReached
  );

  // Ensure that all specified acceptable amounts are greater than zero.
  for taa in allowed_tokens_and_amounts.iter() {
    require!(taa.amount > 0, ChainbillsError::ZeroAmountSpecified);
  }

  /* STATE CHANGES */
  // Increment the chain stats for payables_count.
  let chain_stats = ctx.accounts.chain_stats.as_mut();
  chain_stats.payables_count = chain_stats.next_payable();

  // Increment payables_count on the host initializing this payable.
  let host = ctx.accounts.host.as_mut();
  host.payables_count = host.next_payable();

  // Initialize the payable.
  let payable = ctx.accounts.payable.as_mut();
  payable.chain_count = chain_stats.payables_count;
  payable.host = host.wallet_address;
  payable.host_count = host.payables_count;
  payable.allowed_tokens_and_amounts = allowed_tokens_and_amounts;
  payable.balances = Vec::<TokenAndAmount>::new();
  payable.created_at = clock::Clock::get()?.unix_timestamp as u64;
  payable.payments_count = 0;
  payable.withdrawals_count = 0;
  payable.is_closed = false;

  // Initialize the payable_chain_counter for Solana.
  let payable_chain_counter = ctx.accounts.payable_chain_counter.as_mut();
  payable_chain_counter.chain_id = chain_stats.chain_id;
  payable_chain_counter.payable_id = payable.key();
  payable_chain_counter.payments_count = 0;

  // Emit log and event.
  msg!(
    "Initialized Payable with chain_count: {} and host_count: {}.",
    payable.chain_count,
    payable.host_count
  );
  emit!(CreatedPayableEvent {
    payable_id: payable.key(),
    host_wallet: host.wallet_address,
    chain_count: payable.chain_count,
    host_count: payable.host_count,
  });
  Ok(())
}
