use crate::{constants::*, context::*, error::ChainbillsError, events::*, state::*};
use anchor_lang::{prelude::*, solana_program::clock};
use anchor_spl::token::{self, Transfer as SplTransfer};
use std::cmp::min;
use wormhole_anchor_sdk::token_bridge;

fn check_withdraw_inputs(amount: u64, mint: [u8; 32], payable: &Account<Payable>) -> Result<()> {
  // Ensure that amount is greater than zero
  require!(amount > 0, ChainbillsError::ZeroAmountSpecified);

  // - Ensure that this payable has enough of the provided amount in its balance.
  // - Ensure that the specified token (mint) for withdrawal exists in the
  //   payable's balances.
  let mut bals_it = payable.balances.iter().peekable();
  while let Some(balance) = bals_it.next() {
    if balance.token == mint {
      if balance.amount < amount {
        return err!(ChainbillsError::InsufficientWithdrawAmount);
      } else {
        break;
      }
    }
    if bals_it.peek().is_none() {
      return err!(ChainbillsError::NoBalanceForWithdrawalToken);
    }
  }

  Ok(())
}

fn update_state_for_withdrawal(
  amount: u64,
  mint: [u8; 32],
  global_stats: &mut Account<GlobalStats>,
  chain_stats: &mut Account<ChainStats>,
  payable: &mut Account<Payable>,
  host: &mut Account<User>,
  withdrawal: &mut Account<Withdrawal>,
) -> Result<()> {
  // Increment the global_stats for withdrawals_count.
  global_stats.withdrawals_count = global_stats.next_withdrawal();

  // Increment the chain stats for payables_count.
  chain_stats.withdrawals_count = chain_stats.next_withdrawal();

  // Increment withdrawals_count in the host that just withdrew.
  host.withdrawals_count = host.next_withdrawal();

  // Increment withdrawals_count on the involved payable.
  payable.withdrawals_count = payable.next_withdrawal();

  // Deduct the balances on the involved payable.
  for balance in payable.balances.iter_mut() {
    if balance.token == mint {
      balance.amount = balance.amount.checked_sub(amount).unwrap();
      break;
    }
  }

  // Initialize the withdrawal.
  withdrawal.global_count = global_stats.withdrawals_count;
  withdrawal.chain_count = chain_stats.payables_count;
  withdrawal.payable = payable.key();
  withdrawal.payable_count = payable.withdrawals_count;
  withdrawal.host = host.key();
  withdrawal.host_count = host.withdrawals_count;
  withdrawal.timestamp = clock::Clock::get()?.unix_timestamp as u64;
  withdrawal.details = TokenAndAmount {
    token: mint,
    amount,
  };

  msg!(
    "Withdrawal was made with global_count: {}, chain_count: {}, payable_count: {}, and host_count: {}.",
    withdrawal.global_count,
    withdrawal.chain_count,
    withdrawal.payable_count,
    withdrawal.host_count
  );
  emit!(WithdrawalEvent {
    global_count: withdrawal.global_count,
    chain_count: withdrawal.chain_count,
    payable_count: withdrawal.payable_count,
    host_count: withdrawal.host_count,
  });
  Ok(())
}

fn calculate_amount_minus_fees(
  // max_fees_per_token: &Vec<TokenAndAmount>,
  token: [u8; 32],
  amount: u64,
) -> u64 {
  let two_percent = amount.checked_mul(2).unwrap().checked_div(100).unwrap();
  // let mut max_fee = 0u64;
  // for taa in max_fees_per_token.iter() {
  //   if taa.token == token {
  //     max_fee = taa.amount;
  //     break;
  //   }
  // }
  // amount.checked_sub(min(two_percent, max_fee)).unwrap()
  amount.checked_sub(two_percent).unwrap()
}

/// Transfers the amount of tokens from a payable to a host
///
/// ### args
/// * amount<u64>: The Wormhole-normalized amount to be withdrawn
pub fn withdraw_handler(ctx: Context<Withdraw>, amount: u64) -> Result<()> {
  // CHECKS
  let payable = ctx.accounts.payable.as_mut();
  let mint = &ctx.accounts.mint;
  let denormalized = token_bridge::denormalize_amount(amount, mint.decimals);

  check_withdraw_inputs(amount, mint.key().to_bytes(), payable)?;

  // TRANSFER
  let destination = &ctx.accounts.host_token_account;
  let source = &ctx.accounts.global_token_account;
  let token_program = &ctx.accounts.token_program;
  let authority = &ctx.accounts.global_stats;
  let cpi_accounts = SplTransfer {
    from: source.to_account_info().clone(),
    to: destination.to_account_info().clone(),
    authority: authority.to_account_info().clone(),
  };
  let cpi_program = token_program.to_account_info();
  let config = ctx.accounts.config.load()?;
  let amount_minus_fees = calculate_amount_minus_fees(
    // &config.max_fees_per_token,
    mint.key().to_bytes(),
    denormalized,
  );
  token::transfer(
    CpiContext::new_with_signer(
      cpi_program,
      cpi_accounts,
      &[&[GlobalStats::SEED_PREFIX, &[ctx.bumps.global_stats]]],
    ),
    amount_minus_fees,
  )?;

  let global_stats = ctx.accounts.global_stats.as_mut();
  let chain_stats = ctx.accounts.chain_stats.as_mut();
  let host = ctx.accounts.host.as_mut();
  let withdrawal = ctx.accounts.withdrawal.as_mut();

  // STATE UPDATES
  update_state_for_withdrawal(
    amount,
    mint.key().to_bytes(),
    global_stats,
    chain_stats,
    payable,
    host,
    withdrawal,
  )
}

/// Transfers the amount of tokens from a payable to its host on another
/// chain network
///
/// ### args
/// * vaa_hash<[u8; 32]>: The wormhole encoded hash of the inputs from the
///       source chain.
/// * caller<[u8; 32]>: The Wormhole-normalized address of the wallet of the
///       creator of the payable on the source chain.
/// * host_count<u64>: The nth count of the new withdrawal from the host.
pub fn withdraw_received_handler(
  ctx: Context<WithdrawReceived>,
  vaa_hash: [u8; 32],
  caller: [u8; 32],
  host_count: u64,
) -> Result<()> {
  let vaa = &ctx.accounts.vaa;

  // ensure the actionId is as expected
  require!(
    vaa.data().action_id == ACTION_ID_WITHDRAW,
    ChainbillsError::InvalidActionId
  );

  // ensure the caller was expected and is valid
  require!(
    vaa.data().caller == caller && !caller.iter().all(|&x| x == 0),
    ChainbillsError::InvalidCallerAddress
  );

  // save received info to prevent replay attacks
  let wormhole_received = ctx.accounts.wormhole_received.as_mut();
  wormhole_received.batch_id = vaa.batch_id();
  wormhole_received.vaa_hash = vaa_hash;

  let host = ctx.accounts.host.as_mut();
  // Ensure matching chain id and user wallet address
  require!(
    host.owner_wallet == caller && host.chain_id == vaa.emitter_chain(),
    ChainbillsError::UnauthorizedCallerAddress
  );

  // Ensure that the host count is that which is expected
  require!(
    host_count == host.next_withdrawal(),
    ChainbillsError::WrongWithdrawalsHostCountProvided
  );

  let token_bridge_wrapped_mint = &ctx.accounts.token_bridge_wrapped_mint;
  let payable = ctx.accounts.payable.as_mut();

  // Ensure the decoded payable matches the account payable
  require!(
    payable.key().to_bytes() == vaa.data().payable_id,
    ChainbillsError::NotMatchingPayableId
  );

  // Ensure matching token
  let mint = token_bridge_wrapped_mint.key().to_bytes();
  require!(
    vaa.data().token == mint,
    ChainbillsError::NotMatchingTransactionToken
  );

  let amount = vaa.data().amount;
  let denormalized = token_bridge::denormalize_amount(amount, token_bridge_wrapped_mint.decimals);

  // Check other inputs
  check_withdraw_inputs(amount, mint, payable)?;

  let config = ctx.accounts.config.load()?;
  let amount_minus_fees =
    calculate_amount_minus_fees(
      // &config.max_fees_per_token, 
      mint, denormalized);

  // TRANSFER
  // Approve spending by token bridge
  anchor_spl::token::approve(
    CpiContext::new_with_signer(
      ctx.accounts.token_program.to_account_info(),
      anchor_spl::token::Approve {
        to: ctx.accounts.global_token_account.to_account_info(),
        delegate: ctx.accounts.token_bridge_authority_signer.to_account_info(),
        authority: ctx.accounts.global_stats.to_account_info(),
      },
      &[&[GlobalStats::SEED_PREFIX, &[ctx.bumps.global_stats]]],
    ),
    amount_minus_fees,
  )?;

  // Bridge wrapped token with encoded payload.
  token_bridge::transfer_wrapped_with_payload(
    CpiContext::new_with_signer(
      ctx.accounts.token_bridge_program.to_account_info(),
      token_bridge::TransferWrappedWithPayload {
        payer: ctx.accounts.signer.to_account_info(),
        config: ctx.accounts.token_bridge_config.to_account_info(),
        from: ctx.accounts.global_token_account.to_account_info(),
        from_owner: ctx.accounts.global_stats.to_account_info(),
        wrapped_mint: ctx.accounts.token_bridge_wrapped_mint.to_account_info(),
        wrapped_metadata: ctx.accounts.token_bridge_wrapped_meta.to_account_info(),
        authority_signer: ctx.accounts.token_bridge_authority_signer.to_account_info(),
        wormhole_bridge: ctx.accounts.wormhole_bridge.to_account_info(),
        wormhole_message: ctx.accounts.wormhole_message.to_account_info(),
        wormhole_emitter: ctx.accounts.emitter.to_account_info(),
        wormhole_sequence: ctx.accounts.sequence.to_account_info(),
        wormhole_fee_collector: ctx.accounts.fee_collector.to_account_info(),
        clock: ctx.accounts.clock.to_account_info(),
        sender: ctx.accounts.global_stats.to_account_info(),
        rent: ctx.accounts.rent.to_account_info(),
        system_program: ctx.accounts.system_program.to_account_info(),
        token_program: ctx.accounts.token_program.to_account_info(),
        wormhole_program: ctx.accounts.wormhole_program.to_account_info(),
      },
      &[
        &[GlobalStats::SEED_PREFIX, &[ctx.bumps.global_stats]],
        &[
          SEED_PREFIX_SENDING,
          &ctx.accounts.sequence.next_value().to_le_bytes()[..],
          &[ctx.bumps.wormhole_message],
        ],
      ],
    ),
    0, // 0 for batch_id. That is, no batching.
    amount_minus_fees,
    ctx.accounts.foreign_contract.address,
    vaa.emitter_chain(),
    vaa.payload.1.try_to_vec()?, // Send the payload message as what was originally received.
    &ctx.program_id.key(),
  )?;

  // STATE UPDATES
  let global_stats = ctx.accounts.global_stats.as_mut();
  let chain_stats = ctx.accounts.chain_stats.as_mut();
  let withdrawal = ctx.accounts.withdrawal.as_mut();
  update_state_for_withdrawal(
    amount,
    mint,
    global_stats,
    chain_stats,
    payable,
    host,
    withdrawal,
  )
}
