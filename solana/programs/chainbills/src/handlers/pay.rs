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
  token_details: &Account<TokenDetails>,
) -> Result<()> {
  // Ensure that payments are currently accepted in the provided token.
  require!(
    token_details.is_supported,
    ChainbillsError::UnsupportedToken
  );

  // Ensure that amount is greater than zero
  require!(amount > 0, ChainbillsError::ZeroAmountSpecified);

  // Ensure that the payable is not closed
  require!(!payable.is_closed, ChainbillsError::PayableIsClosed);

  // If this payable specified the tokens and amounts it can accept, ensure
  // that the token and amount are matching.
  if !payable.allowed_tokens_and_amounts.is_empty() {
    let mut ataa_it = payable.allowed_tokens_and_amounts.iter().peekable();
    while let Some(taa) = ataa_it.next() {
      if taa.token == mint && taa.amount == amount {
        break;
      }
      if ataa_it.peek().is_none() {
        return err!(ChainbillsError::MatchingTokenAndAmountNotFound);
      }
    }
  }

  Ok(())
}

fn update_state_for_payment(
  chain_id: u16,
  amount: u64,
  mint: Pubkey,
  signer: Pubkey,
  chain_stats: &mut Account<ChainStats>,
  payable: &mut Account<Payable>,
  payer: &mut Account<User>,
  payable_per_chain_payments_counter: &mut Account<
    PayablePerChainPaymentsCounter,
  >,
  token_details: &mut Account<TokenDetails>,
  user_payment: &mut Account<UserPayment>,
  payable_payment: &mut Account<PayablePayment>,
  chain_user_payment_id: &mut Account<ChainUserPaymentId>,
  chain_payable_payment_id: &mut Account<ChainPayablePaymentId>,
  payable_per_chain_payment_info: &mut Account<PayablePerChainPaymentInfo>,
  user_activity: &mut Account<ActivityRecord>,
  user_activity_info: &mut Account<UserActivityInfo>,
  payable_activity: &mut Account<ActivityRecord>,
  payable_activity_info: &mut Account<PayableActivityInfo>,
) -> Result<()> {
  // Increment the chain stats for payments counts.
  chain_stats.user_payments_count = chain_stats.next_user_payment();
  chain_stats.payable_payments_count = chain_stats.next_payable_payment();

  // Increment the chain stats for activities_count.
  //
  // Incrementing twice to account for recording two activities: one for the
  // user and one for the payable.
  chain_stats.activities_count = chain_stats.next_activity();
  chain_stats.activities_count = chain_stats.next_activity();

  // Increment payments_count and activities_count in the payer that just paid.
  payer.payments_count = payer.next_payment();
  payer.activities_count = payer.next_activity();

  // Increment payments_count and activities_count on involved payable.
  payable.payments_count = payable.next_payment();
  payable.activities_count = payable.next_activity();

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
  payable_per_chain_payments_counter.payments_count =
    payable_per_chain_payments_counter.next_payment();

  // Increase the supported token's totals from this payment.
  token_details.add_user_paid(amount);
  token_details.add_payable_received(amount);

  let timestamp = clock::Clock::get()?.unix_timestamp as u64;
  let payment_details = TokenAndAmount {
    token: mint,
    amount,
  };

  // Initialize the User Payment.
  user_payment.chain_count = chain_stats.payables_count;
  user_payment.payable_id = payable.key().to_bytes();
  user_payment.payable_chain_id = chain_id;
  user_payment.payer = signer;
  user_payment.payer_count = payer.payments_count;
  user_payment.timestamp = timestamp;
  user_payment.details = payment_details;

  // Initialize the Payable Payment.
  payable_payment.payable_id = payable.key();
  payable_payment.payer = signer.to_bytes();
  payable_payment.chain_count = chain_stats.payable_payments_count;
  payable_payment.payer_chain_id = chain_id;
  payable_payment.local_chain_count =
    payable_per_chain_payments_counter.payments_count;
  payable_payment.payable_count = payable.payments_count;
  payable_payment.timestamp = timestamp;
  payable_payment.details = payment_details;

  // Initialize the Chain User Payment ID.
  chain_user_payment_id.user_payment_id = user_payment.key();

  // Initialize the Chain Payable Payment ID.
  chain_payable_payment_id.payable_payment_id = payable_payment.key();

  // Initialize the Payable Per Chain Payment. This is used for retrieving
  // payments per chain. The stored payable_count can then be used to get the
  // main payable_payment.
  payable_per_chain_payment_info.payable_count = payable.payments_count;

  // Initialize the User Activity.
  // subtracting 1 because we incremented the activities_count twice.
  user_activity.chain_count =
    chain_stats.activities_count.checked_sub(1).unwrap();
  user_activity.user_count = payer.activities_count;
  // Setting 0 because it's not a payable activity.
  user_activity.payable_count = 0;
  user_activity.timestamp = timestamp;
  user_activity.entity = user_payment.key();
  user_activity.activity_type = ActivityType::UserPaid;

  // Initialize the User Activity Info.
  user_activity_info.chain_count = chain_stats.activities_count;

  // Initialize the Payable Activity.
  payable_activity.chain_count = chain_stats.activities_count;
  // Setting 0 because it's not a user activity.
  payable_activity.user_count = 0;
  payable_activity.payable_count = payable.activities_count;
  payable_activity.timestamp = timestamp;
  payable_activity.entity = payable_payment.key();
  payable_activity.activity_type = ActivityType::PayableReceived;

  // Initialize the Payable Activity Info.
  payable_activity_info.chain_count = chain_stats.activities_count;

  // Emit logs and events.
  msg!(
    "User Payment was made with chain_count: {} and payer_count: {}.",
    user_payment.chain_count,
    user_payment.payer_count
  );
  msg!(
    "Payable Payment was received with chain_count: {}, and payable_count: {}.",
    payable_payment.chain_count,
    payable_payment.payable_count
  );
  emit!(UserPaid {
    payable_id: payable.key().to_bytes(),
    payer_wallet: signer,
    payment_id: user_payment.key(),
    payable_chain_id: user_payment.payable_chain_id,
    chain_count: user_payment.chain_count,
    payer_count: user_payment.payer_count,
  });
  emit!(PayableReceived {
    payable_id: payable.key(),
    payer_wallet: signer.to_bytes(),
    payment_id: payable_payment.key(),
    payer_chain_id: payable_payment.payer_chain_id,
    chain_count: payable_payment.chain_count,
    payable_count: payable_payment.payable_count,
  });
  Ok(())
}

/// Transfers the amount of tokens to a payable
///
/// ### args
/// * amount<u64>: The Wormhole-normalized amount to be paid
#[inline(never)]
pub fn pay(ctx: Context<Pay>, amount: u64) -> Result<()> {
  /* CHECKS */
  let mint = &ctx.accounts.mint;
  let payable = ctx.accounts.payable.as_mut();
  let token_details = ctx.accounts.token_details.as_mut();
  check_pay_inputs(amount, mint.key(), payable, token_details)?;

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
  update_state_for_payment(
    ctx.accounts.config.load()?.chain_id,
    amount,
    mint.key(),
    ctx.accounts.signer.key(),
    ctx.accounts.chain_stats.as_mut(),
    payable,
    ctx.accounts.payer.as_mut(),
    ctx.accounts.payable_per_chain_payments_counter.as_mut(),
    token_details,
    ctx.accounts.user_payment.as_mut(),
    ctx.accounts.payable_payment.as_mut(),
    ctx.accounts.chain_user_payment_id.as_mut(),
    ctx.accounts.chain_payable_payment_id.as_mut(),
    ctx.accounts.payable_per_chain_payment_info.as_mut(),
    ctx.accounts.user_activity.as_mut(),
    ctx.accounts.user_activity_info.as_mut(),
    ctx.accounts.payable_activity.as_mut(),
    ctx.accounts.payable_activity_info.as_mut(),
  )
}

/// Transfers the amount of native tokens (Solana) to a payable
///
/// ### args
/// * amount<u64>: The Wormhole-normalized amount to be paid
#[inline(never)]
pub fn pay_native(ctx: Context<PayNative>, amount: u64) -> Result<()> {
  /* CHECKS */
  let payable = ctx.accounts.payable.as_mut();
  let token_details = ctx.accounts.token_details.as_mut();
  check_pay_inputs(amount, crate::ID, payable, token_details)?;

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
  update_state_for_payment(
    ctx.accounts.config.load()?.chain_id,
    amount,
    crate::ID,
    ctx.accounts.signer.key(),
    ctx.accounts.chain_stats.as_mut(),
    payable,
    ctx.accounts.payer.as_mut(),
    ctx.accounts.payable_per_chain_payments_counter.as_mut(),
    token_details,
    ctx.accounts.user_payment.as_mut(),
    ctx.accounts.payable_payment.as_mut(),
    ctx.accounts.chain_user_payment_id.as_mut(),
    ctx.accounts.chain_payable_payment_id.as_mut(),
    ctx.accounts.payable_per_chain_payment_info.as_mut(),
    ctx.accounts.user_activity.as_mut(),
    ctx.accounts.user_activity_info.as_mut(),
    ctx.accounts.payable_activity.as_mut(),
    ctx.accounts.payable_activity_info.as_mut(),
  )
}
