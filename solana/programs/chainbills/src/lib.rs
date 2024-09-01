pub mod context;
pub mod error;
pub mod events;
pub mod handlers;
pub mod payload;
pub mod state;

use crate::{context::*, state::TokenAndAmount};
use anchor_lang::prelude::*;

declare_id!("25DUdGkxQgDF7uN58viq6Mjegu3Ajbq2tnQH3zmgX2ND");

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
  pub fn initialize(ctx: Context<Initialize>) -> Result<()> {
    handlers::initialize_handler(ctx)
  }

  /// Register (or update) a trusted contract or Wormhole emitter from another
  /// chain. Also initialize that chain's ChainStats if need be.
  ///
  /// ### Arguments
  /// * `ctx`     - `RegisterForeignEmitter` context
  /// * `chain`   - Wormhole Chain ID
  /// * `address` - Wormhole Emitter Address
  pub fn register_foreign_contract(
    ctx: Context<RegisterForeignContract>,
    chain: u16,
    address: [u8; 32],
  ) -> Result<()> {
    handlers::register_foreign_contract_handler(ctx, chain, address)
  }

  /// Updates the maximum withdrawal fees of the given token.
  ///
  /// ### Args
  /// * token<Pubkey>: The address of the token for which its maximum
  ///                   withdrawal fees is been set.
  /// * fee<u64>: The max fee to set.
  pub fn update_max_withdrawal_fee(
    ctx: Context<UpdateMaxWithdrawalFee>,
    token: Pubkey,
    fee: u64,
  ) -> Result<()> {
    handlers::update_max_withdrawal_fee(ctx, token, fee)
  }

  /// Updates the maximum withdrawal fees of the native token (Solana).
  ///
  /// ### Args
  /// * fee<u64>: The max fee to set.
  pub fn update_max_withdrawal_fee_native(
    ctx: Context<UpdateMaxWithdrawalFeeNative>,
    fee: u64,
  ) -> Result<()> {
    handlers::update_max_withdrawal_fee_native(ctx, fee)
  }

  /// Initialize a User.
  ///
  /// A User Account keeps track of the count of all entities associated with
  /// them. That includes the number of payables they've created and the
  /// number of payments and withdrawals they've made.
  pub fn initialize_user(ctx: Context<InitializeUser>) -> Result<()> {
    handlers::initialize_user_handler(ctx)
  }

  /// Create a Payable
  ///
  /// ### args
  /// * allowed_tokens_and_amounts<Vec<TokenAndAmount>>: The allowed tokens
  ///         (and their amounts) on this payable. If this vector is empty,
  ///         then the payable will accept payments in any token.
  pub fn create_payable(
    ctx: Context<CreatePayable>,
    allowed_tokens_and_amounts: Vec<TokenAndAmount>,
  ) -> Result<()> {
    handlers::create_payable_handler(ctx, allowed_tokens_and_amounts)
  }

  /// Stop a payable from accepting payments. Can be called only
  /// by the host (user) that owns the payable.
  pub fn close_payable(ctx: Context<UpdatePayable>) -> Result<()> {
    handlers::close_payable(ctx)
  }

  /// Allow a closed payable to continue accepting payments.
  /// Can be called only by the host (user) that owns the payable.
  pub fn reopen_payable(ctx: Context<UpdatePayable>) -> Result<()> {
    handlers::reopen_payable(ctx)
  }

  /// Allows a payable's host to update the payable's allowed_tokens_and_amounts.
  ///
  /// ### args
  /// * allowed_tokens_and_amounts: the new set of tokens and amounts that the payable
  /// will accept.
  pub fn update_payable_allowed_tokens_and_amounts(
    ctx: Context<UpdatePayable>,
    allowed_tokens_and_amounts: Vec<TokenAndAmount>,
  ) -> Result<()> {
    handlers::update_payable_allowed_tokens_and_amounts(
      ctx,
      allowed_tokens_and_amounts,
    )
  }

  /// Transfers the amount of tokens from a payer to a payable
  ///
  /// ### args
  /// * amount<u64>: The amount to be paid
  pub fn pay(ctx: Context<Pay>, amount: u64) -> Result<()> {
    handlers::pay(ctx, amount)
  }

  /// Transfers the amount of native tokens (Solana) to a payable
  ///
  /// ### args
  /// * amount<u64>: The Wormhole-normalized amount to be paid
  pub fn pay_native(ctx: Context<PayNative>, amount: u64) -> Result<()> {
    handlers::pay_native(ctx, amount)
  }

  /// Transfers the amount of tokens from a payable to a host
  ///
  /// ### args
  /// * amount<u64>: The amount to be withdrawn
  pub fn withdraw(ctx: Context<Withdraw>, amount: u64) -> Result<()> {
    handlers::withdraw(ctx, amount)
  }

  /// Transfers the amount of native tokens (Solana) from a payable to a host
  ///
  /// ### args
  /// * amount<u64>: The amount to be withdrawn
  pub fn withdraw_native(
    ctx: Context<WithdrawNative>,
    amount: u64,
  ) -> Result<()> {
    handlers::withdraw_native(ctx, amount)
  }

  /// Withdraws fees from this program.
  /// Should be called only by upgrade authority holder of this program.
  ///
  /// ### args
  /// * amount<u64>: The amount to be withdrawn
  pub fn owner_withdraw(
    ctx: Context<OwnerWithdraw>,
    amount: u64,
  ) -> Result<()> {
    handlers::owner_withdraw_handler(ctx, amount)
  }
}
