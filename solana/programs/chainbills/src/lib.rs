pub mod constants;
pub mod error;
pub mod instructions;
pub mod state;

use anchor_lang::prelude::*;
use crate::state::TokenAndAmount;
use instructions::*;

declare_id!("4BTSkx71TpMMScc4QpVPr5ebH1rfsQojPSmcCALsq45d");

#[program]
pub mod chainbills {
    use super::*;

    /// Initialize the GlobalStats.
    ///
    /// GlobalStats keeps track of the count of all entities in this program.
    /// Entities include Users, Payables, Payments, and Withdrawals.
    /// Initializing any other entity must increment the appropriate count in
    /// GlobalStats.
    pub fn initialize_global_stats(ctx: Context<InitializeGlobalStats>) -> Result<()> {
        instructions::initialize_global_stats_handler(ctx)
    }

    /// Initialize a User.
    ///
    /// A User Account keeps track of the count of all entities associated with
    /// them. That includes the number of payables they've created and the
    /// number of payments and withdrawals they've made.
    pub fn initialize_user(ctx: Context<InitializeUser>) -> Result<()> {
        instructions::initialize_user_handler(ctx)
    }

    /// Initialize a Payable
    ///
    /// ### args
    /// * description<String>: what users see when they want to make payment.
    /// * tokens_and_amounts<Vec<TokenAndAmount>>: The allowed tokens
    ///         (and their amounts) on this payable.
    /// * allows_any_token<bool>: Whether this payable should allow payments in
    ///         any token.
    pub fn initialize_payable(
        ctx: Context<InitializePayable>,
        description: String,
        tokens_and_amounts: Vec<TokenAndAmount>,
        allows_any_token: bool
    ) -> Result<()> {
        instructions::initialize_payable_handler(
            ctx,
            description,
            tokens_and_amounts,
            allows_any_token
        )
    }

    /// Allows a payable's host to update the payable's description.
    ///
    /// ### args
    /// * description: the new description of the payable.
    pub fn update_payable_description(
        ctx: Context<UpdatePayableDescription>,
        description: String
    ) -> Result<()> {
        instructions::update_payable_description_handler(ctx, description)
    }

    /// Stop a payable from accepting payments. Can be called only
    /// by the host (user) that owns the payable.
    pub fn close_payable(ctx: Context<UpdatePayableCloseStatus>) -> Result<()> {
        instructions::close_payable(ctx)
    }

    /// Allow a closed payable to continue accepting payments.
    /// Can be called only by the host (user) that owns the payable.
    pub fn reopen_payable(ctx: Context<UpdatePayableCloseStatus>) -> Result<()> {
        instructions::reopen_payable(ctx)
    }

    /// Transfers the amount of tokens from a payer to a payable
    ///
    /// ### args
    /// * amount<u64>: The amount to be paid
    pub fn pay(ctx: Context<Pay>, amount: u64) -> Result<()> {
        instructions::pay_handler(ctx, amount)
    }

    /// Transfers the amount of tokens from a payable to a host
    ///
    /// ### args
    /// * amount<u64>: The amount to be withdrawn
    pub fn withdraw(ctx: Context<Withdraw>, amount: u64) -> Result<()> {
        instructions::withdraw_handler(ctx, amount)
    }

    /// Withdraws fees from this program.
    /// Should be called only by upgrade authority holder of this program.
    pub fn admin_withdraw(ctx: Context<AdminWithdraw>, amount: u64) -> Result<()> {
        instructions::admin_withdraw_handler(ctx, amount)
    }
}
