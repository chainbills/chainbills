use crate::{context::*, error::ChainbillsError, events::*, state::*};
use anchor_lang::{
  prelude::*,
  solana_program::clock,
  system_program::{self, Transfer},
};
use anchor_spl::token::{self, Transfer as SplTransfer};

fn check_pay_inputs(
  amount: u64,
  mint: Pubkey,
  payable: &Account<Payable>,
) -> Result<()> {
  // Ensure that amount is greater than zero
  require!(amount > 0, ChainbillsError::ZeroAmountSpecified);

  // Ensure that the payable is not closed
  require!(!payable.is_closed, ChainbillsError::PayableIsClosed);

  // Ensure that the payable can still accept new tokens, if this
  // payable allows any token
  if payable.allowed_tokens_and_amounts.is_empty()
    && payable.balances.len() >= Payable::MAX_PAYABLES_TOKENS
  {
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
  // allowed token for this payable, if this payable doesn't allow any token
  // outside those it specified
  if !payable.allowed_tokens_and_amounts.is_empty() {
    let mut taas_it = payable.allowed_tokens_and_amounts.iter().peekable();
    while let Some(taa) = taas_it.next() {
      if taa.token == mint && taa.amount == amount {
        break;
      }
      if taas_it.peek().is_none() {
        return err!(ChainbillsError::MatchingTokenAndAmountNotFound);
      }
    }
  }

  Ok(())
}

fn update_state_for_payment(
  amount: u64,
  mint: Pubkey,
  chain_stats: &mut Account<ChainStats>,
  payable: &mut Account<Payable>,
  payer: &mut Account<User>,
  payable_chain_counter: &mut Account<PayableChainCounter>,
  payable_payment: &mut Account<PayablePayment>,
  user_payment: &mut Account<UserPayment>,
) -> Result<()> {
  // Increment the chain stats for payments_count.
  chain_stats.payments_count = chain_stats.next_payment();

  // Increment payments_count in the payer that just paid.
  payer.payments_count = payer.next_payment();

  // Increment payments_count on involved payable.
  payable.payments_count = payable.next_payment();

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
        amount,
      });
    }
  }

  // Increment payments_count on the payable_chain_counter for Solana.
  payable_chain_counter.payments_count = payable_chain_counter.next_payment();

  let timestamp = clock::Clock::get()?.unix_timestamp as u64;
  let payment_details = TokenAndAmount {
    token: mint,
    amount,
  };

  // Initialize the Payable Payment.
  payable_payment.payable_id = payable.key();
  payable_payment.payer = payer.wallet_address.to_bytes();
  payable_payment.payer_chain_id = chain_stats.chain_id;
  payable_payment.local_chain_count = payable_chain_counter.payments_count;
  payable_payment.payable_count = payable.payments_count;
  payable_payment.payer_count = payer.payments_count;
  payable_payment.timestamp = timestamp;
  payable_payment.details = payment_details;

  // Initialize the User Payment.
  user_payment.chain_count = chain_stats.payables_count;
  user_payment.payable_id = payable.key().to_bytes();
  user_payment.payable_chain_id = payable_chain_counter.chain_id;
  user_payment.payer = payer.wallet_address;
  user_payment.payer_count = payer.payments_count;
  user_payment.payable_count = payable.payments_count;
  user_payment.timestamp = timestamp;
  user_payment.details = payment_details;

  // Emit logs and events.
  msg!(
    "Payable Payment was made from chain with wormhole ID: {}, with chain_count: {}, and payable_count: {}.",
    payable_payment.payer_chain_id,
    payable_payment.local_chain_count,
    payable_payment.payable_count
  );
  msg!(
    "User Payment was made with chain_count: {} and payer_count: {}.",
    user_payment.chain_count,
    user_payment.payer_count
  );
  // TODO: Make this to be emit! instead of emit!
  emit!(PayablePayEvent {
    payable_id: payable.key(),
    payer_wallet: payer.wallet_address.to_bytes(),
    payment_id: payable_payment.key(),
    payer_chain_id: payable_payment.payer_chain_id,
    chain_count: payable_payment.local_chain_count,
    payable_count: payable_payment.payer_count,
  });
  // TODO: Make this to be emit! instead of emit!
  emit!(UserPayEvent {
    payable_id: payable.key().to_bytes(),
    payer_wallet: payer.wallet_address,
    payment_id: user_payment.key(),
    payable_chain_id: user_payment.payable_chain_id,
    chain_count: user_payment.chain_count,
    payer_count: user_payment.payer_count,
  });
  Ok(())
}

/// Transfers the amount of tokens to a payable
///
/// ### args
/// * amount<u64>: The Wormhole-normalized amount to be paid
pub fn pay(ctx: Context<Pay>, amount: u64) -> Result<()> {
  /* CHECKS */
  let mint = &ctx.accounts.mint;
  let payable = ctx.accounts.payable.as_mut();
  check_pay_inputs(amount, mint.key(), payable)?;

  /* TRANSFER */
  token::transfer(
    CpiContext::new(
      ctx.accounts.token_program.to_account_info(),
      SplTransfer {
        from: ctx.accounts.payer_token_account.to_account_info(),
        to: ctx.accounts.chain_token_account.to_account_info(),
        authority: ctx.accounts.signer.to_account_info(),
      },
    ),
    amount,
  )?;

  /* STATE CHANGES */
  let chain_stats = ctx.accounts.chain_stats.as_mut();
  let payer = ctx.accounts.payer.as_mut();
  let payable_chain_counter = ctx.accounts.payable_chain_counter.as_mut();
  let payable_payment = ctx.accounts.payable_payment.as_mut();
  let user_payment = ctx.accounts.user_payment.as_mut();
  update_state_for_payment(
    amount,
    mint.key(),
    chain_stats,
    payable,
    payer,
    payable_chain_counter,
    payable_payment,
    user_payment,
  )
}

/// Transfers the amount of native tokens (Solana) to a payable
///
/// ### args
/// * amount<u64>: The Wormhole-normalized amount to be paid
pub fn pay_native(ctx: Context<PayNative>, amount: u64) -> Result<()> {
  /* CHECKS */
  let payable = ctx.accounts.payable.as_mut();
  check_pay_inputs(amount, crate::ID, payable)?;

  /* TRANSFER */
  system_program::transfer(
    CpiContext::new(
      ctx.accounts.system_program.to_account_info(),
      Transfer {
        from: ctx.accounts.signer.to_account_info(),
        to: ctx.accounts.chain_stats.to_account_info(),
      },
    ),
    amount,
  )?;

  /* STATE CHANGES */
  let chain_stats = ctx.accounts.chain_stats.as_mut();
  let payer = ctx.accounts.payer.as_mut();
  let payable_chain_counter = ctx.accounts.payable_chain_counter.as_mut();
  let payable_payment = ctx.accounts.payable_payment.as_mut();
  let user_payment = ctx.accounts.user_payment.as_mut();
  update_state_for_payment(
    amount,
    crate::ID,
    chain_stats,
    payable,
    payer,
    payable_chain_counter,
    payable_payment,
    user_payment,
  )
}
