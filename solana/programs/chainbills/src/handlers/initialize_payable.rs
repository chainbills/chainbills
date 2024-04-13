use crate::{constants::*, context::*, error::ChainbillsError, events::*, state::TokenAndAmount};
use anchor_lang::{prelude::*, solana_program::clock};

fn check_payable_inputs(
  description: String,
  tokens_and_amounts: Vec<TokenAndAmount>,
  allows_free_payments: bool,
) -> Result<()> {
  // Ensure that the description is not an empty string or filled with whitespace
  require!(
    !description.trim().is_empty(),
    ChainbillsError::EmptyDescriptionProvided
  );

  // Ensure that the description doesn't exceed the set maximum
  require!(
    description.len() <= MAX_PAYABLES_DESCRIPTION_LENGTH,
    ChainbillsError::MaxPayableDescriptionReached
  );

  // Ensure that the number of specified acceptable tokens (and their amounts)
  // for payments don't exceed the set maximum.
  require!(
    tokens_and_amounts.len() <= MAX_PAYABLES_TOKENS,
    ChainbillsError::MaxPayableTokensCapacityReached
  );

  // Ensure that the payable either accepts payments of any amounts in any tokens
  // or it specifies the tokens (and their amounts) that can be paid to it
  // and not both.
  require!(
    (allows_free_payments && tokens_and_amounts.len() == 0)
      || (!allows_free_payments && tokens_and_amounts.len() > 0),
    ChainbillsError::ImproperPayablesConfiguration
  );

  // Ensure that all specified acceptable amounts are greater than zero.
  for taa in tokens_and_amounts.iter() {
    require!(taa.amount > 0, ChainbillsError::ZeroAmountSpecified);
  }

  Ok(())
}

fn complete_payable_initialization(
  ctx: Context<InitializePayable>,
  description: String,
  tokens_and_amounts: Vec<TokenAndAmount>,
  allows_free_payments: bool,
) -> Result<()> {
  // Increment the global stats for payables_count.
  let global_stats = ctx.accounts.global_stats.as_mut();
  global_stats.payables_count = global_stats.payables_count.checked_add(1).unwrap();

  // Increment payables_count on the host initializing this payable.
  let host = ctx.accounts.host.as_mut();
  host.payables_count = host.payables_count.checked_add(1).unwrap();

  // Initialize the payable.
  let payable = ctx.accounts.payable.as_mut();
  payable.global_count = global_stats.payables_count;
  payable.host = host.key();
  payable.host_count = host.payables_count;
  payable.description = description.trim().to_owned();
  payable.tokens_and_amounts = tokens_and_amounts;
  payable.balances = Vec::<TokenAndAmount>::new();
  payable.allows_free_payments = allows_free_payments;
  payable.created_at = clock::Clock::get()?.unix_timestamp as u64;
  payable.payments_count = 0;
  payable.withdrawals_count = 0;
  payable.is_closed = false;

  msg!(
    "Initialized payable with global_count: {} and host_count: {}.",
    payable.global_count,
    payable.host_count
  );
  emit!(InitializedPayableEvent {
    global_count: payable.global_count,
    host_count: payable.host_count,
  });
  Ok(())
}

/// Initialize a Payable
///
/// ### args
/// * description<String>: what users see when they want to make payment.
/// * tokens_and_amounts<Vec<TokenAndAmount>>: The allowed tokens
///         (and their amounts) on this payable.
/// * allows_free_payments<bool>: Whether this payable should allow payments of
///         any amount in any token.
pub fn initialize_payable_handler(
  ctx: Context<InitializePayable>,
  description: String,
  tokens_and_amounts: Vec<TokenAndAmount>,
  allows_free_payments: bool,
) -> Result<()> {
  check_payable_inputs(description, tokens_and_amounts, allows_free_payments);
  complete_payable_initialization(ctx, description, tokens_and_amounts, allows_free_payments)
}

/// Initialize a Payable from another chain network
///
/// ### args
/// * vaa_hash<[u8; 32]>: The wormhole encoded hash of the inputs from the
///       source chain.
/// * caller<[u8; 32]>: The Wormhole-normalized address of the wallet of the
///       creator of the payable on the source chain.
/// * host_count<u64>: The nth count of the new payable from the host.
pub fn initialize_payable_received_handler(
  ctx: Context<InitializePayableReceived>,
  vaa_hash: [u8; 32],
  caller: [u8; 32],
  host_count: u64,
) -> Result<()> {
  let vaa = &ctx.accounts.vaa;

  // ensure the caller was expected and is valid
  require!(
    vaa.data().caller == caller && !caller.iter().all(|&x| x == 0),
    ChainbillsError::InvalidCallerAddress
  );

  let wormhole_received = ctx.accounts.wormhole_received.as_mut();
  wormhole_received.batch_id = vaa.batch_id();
  wormhole_received.vaa_hash = vaa_hash;

  // ensure the actionId is as expected
  require!(
    vaa.data().action_id = ACTION_ID_INITIALIZE_PAYABLE,
    ChainbillsError::InvalidActionId
  );

  let host = ctx.accounts.host.as_mut();
  if host.to_account_info().data_is_empty() {
    // increment global count for users
    let global_stats = ctx.accounts.global_stats.as_mut();
    global_stats.users_count = global_stats.users_count.checked_add(1).unwrap();

    // initialize the host if that has not yet been done
    host.owner_wallet = vaa.data().caller;
    host.chain_id = vaa.emitter_chain();
    host.global_count = global_stats.users_count;
    host.payables_count = 0;
    host.payments_count = 0;
    host.withdrawals_count = 0;

    msg!("Initialized user with global_count: {}.", host.global_count);
    emit!(InitializedUserEvent {
      global_count: host.global_count,
    });
  } else {
    // Ensure matching chain id and user wallet address
    require!(
      host.owner_wallet == caller && host.chain_id == vaa.emitter_chain(),
      ChainbillsError::UnauthorizedCallerAddress
    );
  }

  // Ensure that the host count is that which is expected
  require!(
    host_count == host.next_payable(),
    ChainbillsError::WrongPayablesHostCountProvided
  );

  // TODO: Obtain payable inputs from decoded vaa.data().data and check them
  // check_payable_inputs(description, tokens_and_amounts, allows_free_payments);

  // TODO: Complete the payable initialization
  // complete_payable_initialization(ctx, description, tokens_and_amounts, allows_free_payments)

  // TODO: Remove this Ok(()) after extracting payable inputs and completing
  // initialization
  Ok(())
}
