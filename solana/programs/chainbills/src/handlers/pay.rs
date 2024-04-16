use crate::{constants::*, context::*, error::ChainbillsError, events::*, state::*};
use anchor_lang::{prelude::*, solana_program::clock};
use anchor_spl::token::{self, Transfer as SplTransfer};
use wormhole_anchor_sdk::token_bridge;

fn check_pay_inputs(amount: u64, mint: [u8; 32], payable: &Account<Payable>) -> Result<()> {
  // Ensure that amount is greater than zero
  require!(amount > 0, ChainbillsError::ZeroAmountSpecified);

  // Ensure that the payable is not closed
  require!(!payable.is_closed, ChainbillsError::PayableIsClosed);

  // Ensure that the payable can still accept new tokens, if this
  // payable allows any token
  if payable.allows_free_payments && payable.balances.len() >= MAX_PAYABLES_TOKENS {
    let mut bals_it = payable.balances.iter().peekable();
    while let Some(balance) = bals_it.next() {
      if balance.token == mint {
        break;
      }
      if bals_it.peek().is_none() {
        return err!(ChainbillsError::MaxPayableTokensCapacityReached);
      }
    }
  }

  // Ensure that the specified token to be transferred (the mint) is an
  // allowed token for this payable, if this payable
  // doesn't allow any token outside those it specified
  if !payable.allows_free_payments {
    let mut taas_it = payable.tokens_and_amounts.iter().peekable();
    while let Some(taa) = taas_it.next() {
      if taa.token == mint && taa.amount == amount {
        break;
      }
      if taas_it.peek().is_none() {
        return err!(ChainbillsError::MatchingTokenAndAccountNotFound);
      }
    }
  }

  Ok(())
}

fn update_state_for_payment(
  amount: u64,
  mint: [u8; 32],
  global_stats: &mut Account<GlobalStats>,
  payable: &mut Account<Payable>,
  payer: &mut Account<User>,
  payment: &mut Account<Payment>,
) -> Result<()> {
  // Increment the global stats for payments_count.
  global_stats.payments_count = global_stats.payments_count.checked_add(1).unwrap();

  // Increment payments_count on involved payable.
  payable.payments_count = payable.payments_count.checked_add(1).unwrap();

  // Update payable's balances to add this token and its amount.
  //
  // This boolean and the following two scopes was used (instead of peekable)
  // to solve the borrowing twice bug with rust on the payable variable.
  let mut was_matching_balance_updated = false;
  {
    for balance in payable.balances.iter_mut() {
      if balance.token == mint {
        balance.amount = balance.amount.checked_add(amount).unwrap();
        was_matching_balance_updated = true;
        break;
      }
    }
  }
  {
    if !was_matching_balance_updated {
      payable.balances.push(TokenAndAmount {
        token: mint,
        amount: amount,
      });
    }
  }

  // Increment payments_count in the payer that just paid.
  payer.payments_count = payer.payments_count.checked_add(1).unwrap();

  // Initialize the payment.
  payment.global_count = global_stats.payments_count;
  payment.payable = payable.key();
  payment.payer = payer.key();
  payment.payer_count = payer.payments_count;
  payment.payable_count = payable.payments_count;
  payment.timestamp = clock::Clock::get()?.unix_timestamp as u64;
  payment.details = TokenAndAmount {
    token: mint,
    amount: amount,
  };

  msg!(
    "Payment was made with global_count: {}, payable_count: {}, and payer_count: {}.",
    payment.global_count,
    payment.payable_count,
    payment.payer_count
  );
  emit!(PayEvent {
    global_count: payment.global_count,
    payable_count: payment.payable_count,
    payer_count: payment.payer_count,
  });
  Ok(())
}

/// Transfers the amount of tokens to a payable
///
/// ### args
/// * amount<u64>: The amount to be paid
pub fn pay_handler(ctx: Context<Pay>, amount: u64) -> Result<()> {
  // CHECKS
  let mint = &ctx.accounts.mint;
  let payable = ctx.accounts.payable.as_mut();
  check_pay_inputs(amount, mint.key().to_bytes(), payable)?;

  // TRANSFER
  let destination = &ctx.accounts.global_token_account;
  let source = &ctx.accounts.payer_token_account;
  let token_program = &ctx.accounts.token_program;
  let authority = &ctx.accounts.signer;
  let cpi_accounts = SplTransfer {
    from: source.to_account_info().clone(),
    to: destination.to_account_info().clone(),
    authority: authority.to_account_info().clone(),
  };
  let cpi_program = token_program.to_account_info();
  // TODO: Do Wormhole normalise amount here
  token::transfer(CpiContext::new(cpi_program, cpi_accounts), amount)?;

  // STATE UPDATES
  let global_stats = ctx.accounts.global_stats.as_mut();
  let payer = ctx.accounts.payer.as_mut();
  let payment = ctx.accounts.payment.as_mut();
  update_state_for_payment(
    amount,
    mint.key().to_bytes(),
    global_stats,
    payable,
    payer,
    payment,
  )
}

/// Transfers the amount of tokens from another chain network to a payable
///
/// ### args
/// * vaa_hash<[u8; 32]>: The wormhole encoded hash of the inputs from the
///       source chain.
/// * caller<[u8; 32]>: The Wormhole-normalized address of the wallet of the
///       creator of the payable on the source chain.
/// * payer_count<u64>: The nth count of the new payment from the payer.
pub fn pay_received_handler(
  ctx: Context<PayReceived>,
  vaa_hash: [u8; 32],
  caller: [u8; 32],
  payer_count: u64,
) -> Result<()> {
  let vaa = &ctx.accounts.vaa;
  let payload = vaa.data().data();

  // ensure the caller was expected and is valid
  require!(
    payload.caller == caller && !caller.iter().all(|&x| x == 0),
    ChainbillsError::InvalidCallerAddress
  );

  // ensure that this bridged asset has not yet been redeemed.
  //
  // The Token Bridge program's claim account is only initialized when
  // a transfer is redeemed (and the boolean value `true` is written as
  // its data).
  //
  // The Token Bridge program will automatically fail if this transfer
  // is redeemed again. But we choose to short-circuit the failure as the
  // first evaluation of this instruction.
  require!(
    ctx.accounts.token_bridge_claim.data_is_empty(),
    ChainbillsError::AlreadyRedeemed
  );

  // save received info to prevent replay attacks
  let wormhole_received = ctx.accounts.wormhole_received.as_mut();
  wormhole_received.batch_id = vaa.batch_id();
  wormhole_received.vaa_hash = vaa_hash;

  // ensure the actionId is as expected
  require!(
    payload.action_id == ACTION_ID_PAY,
    ChainbillsError::InvalidActionId
  );

  let payer = ctx.accounts.payer.as_mut();
  if payer.to_account_info().data_is_empty() {
    // increment global count for users
    let global_stats = ctx.accounts.global_stats.as_mut();
    global_stats.users_count = global_stats.users_count.checked_add(1).unwrap();

    // initialize the payer if that has not yet been done
    payer.owner_wallet = payload.caller;
    payer.chain_id = vaa.emitter_chain();
    payer.global_count = global_stats.users_count;
    payer.payables_count = 0;
    payer.payments_count = 0;
    payer.withdrawals_count = 0;

    msg!(
      "Initialized user with global_count: {}.",
      payer.global_count
    );
    emit!(InitializedUserEvent {
      global_count: payer.global_count,
    });
  } else {
    // Ensure matching chain id and user wallet address
    require!(
      payer.owner_wallet == caller && payer.chain_id == vaa.emitter_chain(),
      ChainbillsError::UnauthorizedCallerAddress
    );
  }

  // Ensure that the payer count is that which is expected
  require!(
    payer_count == payer.next_payment(),
    ChainbillsError::WrongPaymentPayerCountProvided
  );

  let token_bridge_wrapped_mint = &ctx.accounts.token_bridge_wrapped_mint;
  let payable = ctx.accounts.payable.as_mut();
  let amount = vaa.data().amount();

  // Ensure the decoded payable matches the account payable
  require!(
    payable.key().to_bytes() == payload.payable_id,
    ChainbillsError::NotMatchingPayableId
  );

  // Ensure matching token and amount
  require!(
    payload.token == token_bridge_wrapped_mint.key().to_bytes(),
    ChainbillsError::NotMatchingTransactionToken
  );
  require!(
    payload.amount == amount,
    ChainbillsError::NotMatchingTransactionAmount
  );

  // Check pay inputs
  check_pay_inputs(amount, token_bridge_wrapped_mint.key().to_bytes(), payable)?;

  // TRANSFER
  token_bridge::complete_transfer_wrapped_with_payload(CpiContext::new_with_signer(
    ctx.accounts.token_bridge_program.to_account_info(),
    token_bridge::CompleteTransferWrappedWithPayload {
      payer: ctx.accounts.signer.to_account_info(),
      config: ctx.accounts.token_bridge_config.to_account_info(),
      vaa: ctx.accounts.vaa.to_account_info(),
      claim: ctx.accounts.token_bridge_claim.to_account_info(),
      foreign_endpoint: ctx.accounts.token_bridge_foreign_endpoint.to_account_info(),
      to: ctx.accounts.global_token_account.to_account_info(),
      redeemer: ctx.accounts.global_stats.to_account_info(),
      wrapped_mint: ctx.accounts.token_bridge_wrapped_mint.to_account_info(),
      wrapped_metadata: ctx.accounts.token_bridge_wrapped_meta.to_account_info(),
      mint_authority: ctx.accounts.token_bridge_mint_authority.to_account_info(),
      rent: ctx.accounts.rent.to_account_info(),
      system_program: ctx.accounts.system_program.to_account_info(),
      token_program: ctx.accounts.token_program.to_account_info(),
      wormhole_program: ctx.accounts.wormhole_program.to_account_info(),
    },
    &[&[GlobalStats::SEED_PREFIX, &[ctx.bumps.global_stats]]],
  ))?;

  // STATE UPDATES
  let global_stats = ctx.accounts.global_stats.as_mut();
  let payment = ctx.accounts.payment.as_mut();
  update_state_for_payment(
    amount,
    token_bridge_wrapped_mint.key().to_bytes(),
    global_stats,
    payable,
    payer,
    payment,
  )
}
