pub mod constants;
pub mod context;
pub mod error;
pub mod events;
pub mod handlers;
pub mod payload;
pub mod state;

use crate::{context::*, state::TokenAndAmount};
use anchor_lang::prelude::*;

declare_id!("p7Lu1yPzMRYLfLxWbEePx8kn3LNevFTbGVC5ghyADF9");

#[program]
pub mod chainbills {
  use super::*;

  /// Initialize the program. Specifically initialize the program's
  /// Config, GlobalStats, and Solana's ChainStats.
  ///
  /// Config holds addresses and infos that this program will use to interact
  /// with Wormhole. Other method handlers would reference properties of
  /// Config to execute Wormhole-related CPI calls.
  ///
  /// GlobalStats keeps track of the count of all entities in this program.
  /// Entities include Users, Payables, Payments, and Withdrawals.
  /// Initializing any other entity must increment the appropriate count in
  /// GlobalStats.
  ///
  /// ChainStats is like GlobalStats but just for each BlockChain Network
  /// involved in Chainbills. Solana's ChainStats also gets initialized here.
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

  /// Updates the maximum fees of the given token.
  ///
  /// ### Args
  /// * token<[u8; 32]>: The Wormhole-normalized address of the token for which
  ///     its maximum withdrawal fees is been set.
  /// * fee<u64>: The max fee to set.
  pub fn update_max_fee(
    ctx: Context<UpdateMaxFee>,
    token: [u8; 32],
    fee: u64,
  ) -> Result<()> {
    handlers::update_max_fee_handler(ctx, token, fee)
  }

  /// Initialize a User.
  ///
  /// A User Account keeps track of the count of all entities associated with
  /// them. That includes the number of payables they've created and the
  /// number of payments and withdrawals they've made.
  pub fn initialize_user(ctx: Context<InitializeUser>) -> Result<()> {
    handlers::initialize_user_handler(ctx)
  }

  /// Initialize a Payable
  ///
  /// ### args
  /// * description<String>: what users see when they want to make payment.
  /// * tokens_and_amounts<Vec<TokenAndAmount>>: The allowed tokens
  ///         (and their amounts) on this payable.
  /// * allows_free_payments<bool>: Whether this payable should allow payments
  ///        of any amounts of any token.
  pub fn initialize_payable(
    ctx: Context<InitializePayable>,
    description: String,
    tokens_and_amounts: Vec<TokenAndAmount>,
    allows_free_payments: bool,
  ) -> Result<()> {
    handlers::initialize_payable_handler(ctx, description, tokens_and_amounts, allows_free_payments)
  }

  /// Initialize a Payable from another chain network
  ///
  /// ### args
  /// * vaa_hash<[u8; 32]>: The wormhole encoded hash of the inputs from the
  ///       source chain.
  /// * caller<[u8; 32]>: The Wormhole-normalized address of the wallet of the
  ///       creator of the payable on the source chain.
  /// * host_count<u64>: The nth count of the new payable from the host.
  pub fn initialize_payable_received(
    ctx: Context<InitializePayableReceived>,
    vaa_hash: [u8; 32],
    caller: [u8; 32],
    host_count: u64,
  ) -> Result<()> {
    handlers::initialize_payable_received_handler(ctx, vaa_hash, caller, host_count)
  }

  /// Stop a payable from accepting payments. Can be called only
  /// by the host (user) that owns the payable.
  pub fn close_payable(ctx: Context<UpdatePayable>) -> Result<()> {
    handlers::close_payable(ctx)
  }

  /// Stop a payable from accepting payments from contract call on
  /// another chain. Should be called only by the host (user) that created
  /// the payable.
  ///
  /// ### args
  /// * vaa_hash<[u8; 32]>: The wormhole encoded hash of the inputs from the
  ///       source chain.
  /// * caller<[u8; 32]>: The Wormhole-normalized address of the wallet of the
  ///       creator of the payable on the source chain.
  pub fn close_payable_received(
    ctx: Context<UpdatePayableReceived>,
    vaa_hash: [u8; 32],
    caller: [u8; 32],
  ) -> Result<()> {
    handlers::close_payable_received(ctx, vaa_hash, caller)
  }

  /// Allow a closed payable to continue accepting payments.
  /// Can be called only by the host (user) that owns the payable.
  pub fn reopen_payable(ctx: Context<UpdatePayable>) -> Result<()> {
    handlers::reopen_payable(ctx)
  }

  /// Allow a closed payable to continue accepting payments from contract
  /// call on another chain. Should be called only by the host (user)
  /// that owns the payable.
  ///
  /// ### args
  /// * vaa_hash<[u8; 32]>: The wormhole encoded hash of the inputs from the
  ///       source chain.
  /// * caller<[u8; 32]>: The Wormhole-normalized address of the wallet of the
  ///       creator of the payable on the source chain.
  pub fn reopen_payable_received(
    ctx: Context<UpdatePayableReceived>,
    vaa_hash: [u8; 32],
    caller: [u8; 32],
  ) -> Result<()> {
    handlers::reopen_payable_received(ctx, vaa_hash, caller)
  }

  /// Allows a payable's host to update the payable's description.
  ///
  /// ### args
  /// * description: the new description of the payable.
  pub fn update_payable_description(
    ctx: Context<UpdatePayable>,
    description: String,
  ) -> Result<()> {
    handlers::update_payable_description(ctx, description)
  }

  /// Allows a payable's host to update the payable's description from a
  /// contract call on another chain.
  ///
  /// ### args
  /// * vaa_hash<[u8; 32]>: The wormhole encoded hash of the inputs from the
  ///       source chain.
  /// * caller<[u8; 32]>: The Wormhole-normalized address of the wallet of the
  ///       creator of the payable on the source chain.
  pub fn update_payable_description_received(
    ctx: Context<UpdatePayableReceived>,
    vaa_hash: [u8; 32],
    caller: [u8; 32],
  ) -> Result<()> {
    handlers::update_payable_description_received(ctx, vaa_hash, caller)
  }

  /// Transfers the amount of tokens from a payer to a payable
  ///
  /// ### args
  /// * amount<u64>: The amount to be paid
  pub fn pay(ctx: Context<Pay>, amount: u64) -> Result<()> {
    handlers::pay_handler(ctx, amount)
  }

  /// Transfers the amount of tokens from another chain network to a payable
  ///
  /// ### args
  /// * vaa_hash<[u8; 32]>: The wormhole encoded hash of the inputs from the
  ///       source chain.
  /// * caller<[u8; 32]>: The Wormhole-normalized address of the wallet of the
  ///       creator of the payable on the source chain.
  /// * payer_count<u64>: The nth count of the new payment from the payer.
  pub fn pay_received(
    ctx: Context<PayReceived>,
    vaa_hash: [u8; 32],
    caller: [u8; 32],
    payer_count: u64,
  ) -> Result<()> {
    handlers::pay_received_handler(ctx, vaa_hash, caller, payer_count)
  }

  /// Transfers the amount of tokens from a payable to a host
  ///
  /// ### args
  /// * amount<u64>: The amount to be withdrawn
  pub fn withdraw(ctx: Context<Withdraw>, amount: u64) -> Result<()> {
    handlers::withdraw_handler(ctx, amount)
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
    handlers::withdraw_received_handler(ctx, vaa_hash, caller, host_count)
  }

  /// Withdraws fees from this program.
  /// Should be called only by upgrade authority holder of this program.
  ///
  /// ### args
  /// * amount<u64>: The amount to be withdrawn
  pub fn owner_withdraw(ctx: Context<OwnerWithdraw>, amount: u64) -> Result<()> {
    handlers::owner_withdraw_handler(ctx, amount)
  }
}
