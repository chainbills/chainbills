pub mod context;
pub mod error;
pub mod events;
pub mod handlers;
pub mod payload;
pub mod state;

use crate::{context::*, state::TokenAndAmount};
use anchor_lang::prelude::*;

declare_id!("GazbpBKrionSvJbeqqqbfqCvK8m7prd8eq5P1SK5EZUD");

#[program]
pub mod chainbills {
  use super::*;

  /// Initialize the program. Specifically initialize the program's
  /// Config and Solana's ChainStats.
  ///
  /// Config holds addresses and infos that this program will use to interact
  /// with Wormhole. Other method handlers would reference properties of
  /// Config to execute Wormhole-related CPI calls.
  ///
  /// ChainStats keeps track of the count of all entities in this program,
  /// that were created on this chain (and any other chain). Entities include
  /// Users, Payables, Payments, and Withdrawals. Initializing any other entity
  /// must increment the appropriate count in the appropriate ChainStats.
  ///
  /// ChainStats has to be initialized for each BlockChain Network
  /// involved in Chainbills. Solana's ChainStats also gets initialized here.
  /// ChainStats for other chains get initialized when their foreign contracts
  /// are registered.
  #[inline(never)]
  pub fn initialize(ctx: Context<Initialize>) -> Result<()> {
    handlers::initialize_handler(ctx)
  }

  /// Initialize a User.
  ///
  /// A User Account keeps track of the count of all entities associated with
  /// them. That includes the number of payables they've created and the
  /// number of payments and withdrawals they've made.
  #[inline(never)]
  pub fn initialize_user(ctx: Context<InitializeUser>) -> Result<()> {
    handlers::initialize_user_handler(ctx)
  }

  /// Create a Payable
  ///
  /// ### args
  /// * allowed_tokens_and_amounts<Vec<TokenAndAmount>>: The allowed tokens
  ///         (and their amounts) on this payable. If this vector is empty,
  ///         then the payable will accept payments in any token.
  #[inline(never)]
  pub fn create_payable<'info>(
    ctx: Context<'_, '_, 'info, 'info, CreatePayable>,
    allowed_tokens_and_amounts: Vec<TokenAndAmount>,
  ) -> Result<()> {
    handlers::create_payable_handler(ctx, allowed_tokens_and_amounts)
  }

  /// Transfers the amount of tokens from a payer to a payable
  ///
  /// ### args
  /// * amount<u64>: The amount to be paid
  #[inline(never)]
  pub fn pay(ctx: Context<Pay>, amount: u64) -> Result<()> {
    handlers::pay(ctx, amount)
  }

  /// Transfers the amount of native tokens (Solana) to a payable
  ///
  /// ### args
  /// * amount<u64>: The Wormhole-normalized amount to be paid
  #[inline(never)]
  pub fn pay_native(ctx: Context<PayNative>, amount: u64) -> Result<()> {
    handlers::pay_native(ctx, amount)
  }

  /// Transfers the amount of tokens from a payable to a host
  ///
  /// ### args
  /// * amount<u64>: The amount to be withdrawn
  #[inline(never)]
  pub fn withdraw(ctx: Context<Withdraw>, amount: u64) -> Result<()> {
    handlers::withdraw(ctx, amount)
  }

  /// Transfers the amount of native tokens (Solana) from a payable to a host
  ///
  /// ### args
  /// * amount<u64>: The amount to be withdrawn
  #[inline(never)]
  pub fn withdraw_native(
    ctx: Context<WithdrawNative>,
    amount: u64,
  ) -> Result<()> {
    handlers::withdraw_native(ctx, amount)
  }

  /// Stop a payable from accepting payments. Can be called only
  /// by the host (user) that owns the payable.
  #[inline(never)]
  pub fn close_payable(ctx: Context<UpdatePayable>) -> Result<()> {
    handlers::close_payable(ctx)
  }

  /// Allow a closed payable to continue accepting payments.
  /// Can be called only by the host (user) that owns the payable.
  #[inline(never)]
  pub fn reopen_payable(ctx: Context<UpdatePayable>) -> Result<()> {
    handlers::reopen_payable(ctx)
  }

  /// Allows a payable's host to update the payable's allowed_tokens_and_amounts.
  ///
  /// ### args
  /// * allowed_tokens_and_amounts: the new set of tokens and amounts that the payable
  /// will accept.
  #[inline(never)]
  pub fn update_payable_allowed_tokens_and_amounts<'info>(
    ctx: Context<'_, '_, 'info, 'info, UpdatePayableAllowedTokensAndAmounts>,
    allowed_tokens_and_amounts: Vec<TokenAndAmount>,
  ) -> Result<()> {
    handlers::update_payable_allowed_tokens_and_amounts(
      ctx,
      allowed_tokens_and_amounts,
    )
  }

  /// Record a foreign payable update.
  ///
  /// ### args
  /// * payable_id<[u8; 32]>: The payable ID to update.
  /// * ataa_len<u8>: The length of the allowed tokens and amounts.
  /// * vaa_hash<[u8; 32]>: The hash of the VAA.
  #[inline(never)]
  pub fn record_foreign_payable_update(
    ctx: Context<RecordForeignPayableUpdate>,
    payable_id: [u8; 32],
    ataa_len: u8,
    vaa_hash: [u8; 32],
  ) -> Result<()> {
    handlers::record_foreign_payable_update_handler(
      ctx, payable_id, ataa_len, vaa_hash,
    )
  }

  /// Updates the local token mint and the foreign token address for a given
  /// token against a foreign chain.
  ///
  /// ### Args
  /// * chain<u16>: The foreign chain ID.
  /// * foreign_token<[u8; 32]>: The foreign token address.
  /// * token<Pubkey>: The token mint to update.
  #[inline(never)]
  pub fn update_token_foreign_chain(
    ctx: Context<UpdateTokenForeignChain>,
    chain: u16,
    foreign_token: [u8; 32],
    token: Pubkey,
  ) -> Result<()> {
    handlers::update_token_foreign_chain_handler(
      ctx,
      chain,
      foreign_token,
      token,
    )
  }

  /// Updates the maximum withdrawal fees of the given token.
  ///
  /// ### Args
  /// * token<Pubkey>: The address of the token for which its maximum
  ///                   withdrawal fees is been set.
  /// * max_withdrawal_fees<u64>: The maximum withdrawal fees to set.
  #[inline(never)]
  pub fn update_max_withdrawal_fees(
    ctx: Context<UpdateMaxWithdrawalFees>,
    token: Pubkey,
    max_withdrawal_fees: u64,
  ) -> Result<()> {
    handlers::update_max_withdrawal_fees(ctx, token, max_withdrawal_fees)
  }

  /// Updates the maximum withdrawal fees of the native token (Solana).
  ///
  /// ### Args
  /// * max_withdrawal_fees<u64>: The maximum withdrawal fees to set.
  #[inline(never)]
  pub fn update_max_withdrawal_fees_native(
    ctx: Context<UpdateMaxWithdrawalFeesNative>,
    max_withdrawal_fees: u64,
  ) -> Result<()> {
    handlers::update_max_withdrawal_fees_native(ctx, max_withdrawal_fees)
  }

  /// Withdraws fees from this program.
  /// Should be called only by upgrade authority holder of this program.
  ///
  /// ### args
  /// * amount<u64>: The amount to be withdrawn
  #[inline(never)]
  pub fn owner_withdraw(
    ctx: Context<OwnerWithdraw>,
    amount: u64,
  ) -> Result<()> {
    handlers::owner_withdraw_handler(ctx, amount)
  }

  /// Register (or update) a trusted contract or Wormhole emitter from another
  /// chain. Also initialize that chain's ChainStats if need be.
  ///
  /// ### Arguments
  /// * `ctx`     - `RegisterForeignEmitter` context
  /// * `chain_id`   - Wormhole Chain ID
  /// * `emitter_address` - Wormhole Emitter Address
  #[inline(never)]
  pub fn register_foreign_contract(
    ctx: Context<RegisterForeignContract>,
    chain_id: u16,
    emitter_address: [u8; 32],
  ) -> Result<()> {
    handlers::register_foreign_contract_handler(ctx, chain_id, emitter_address)
  }
}
