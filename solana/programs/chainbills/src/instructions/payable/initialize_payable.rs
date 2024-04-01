use anchor_lang::{ prelude::*, solana_program::clock };
use crate::constants::*;
use crate::error::ChainbillsError;
use crate::state::{ GlobalStats, Payable, TokenAndAmount, User };

#[derive(Accounts)]
#[instruction(
    description: String, 
    tokens_and_amounts: Vec<TokenAndAmount>, 
    allows_any_token: bool
)]
pub struct InitializePayable<'info> {
    #[account(
        init,
        seeds = [
            signer.key().as_ref(),
            b"payable",
            host.payables_count.checked_add(1).unwrap().to_le_bytes().as_ref(),
        ],
        bump,
        payer = signer,
        space = 8 + Payable::SPACE
    )]
    pub payable: Box<Account<'info, Payable>>,

    #[account(mut, seeds = [signer.key().as_ref()], bump)]
    pub host: Box<Account<'info, User>>,

    #[account(mut, seeds = [b"global"], bump)]
    pub global_stats: Box<Account<'info, GlobalStats>>,

    #[account(mut)]
    pub signer: Signer<'info>,

    pub system_program: Program<'info, System>,
}

/// Initialize a Payable
///
/// ### args
/// * description<String>: what users see when they want to make payment.
/// * tokens_and_amounts<Vec<TokenAndAmount>>: The allowed tokens
///         (and their amounts) on this payable.
/// * allows_any_token<bool>: Whether this payable should allow payments in
///         any token.
pub fn initialize_payable_handler(
    ctx: Context<InitializePayable>,
    description: String,
    tokens_and_amounts: Vec<TokenAndAmount>,
    allows_any_token: bool
) -> Result<()> {
    /* ----- CHECKS ----- */
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

    // Ensure that the payable either accepts any tokens or it specifies
    // the tokens (and their amounts) that can be paid to it.
    require!(
        allows_any_token || (!allows_any_token && tokens_and_amounts.len() > 0),
        ChainbillsError::ImproperPayablesConfiguration
    );

    // Ensure that all specified acceptable amounts are greater than zero.
    for taa in tokens_and_amounts.iter() {
        require!(taa.amount > 0, ChainbillsError::ZeroAmountSpecified);
    }

    
    /* ----- STATE UPDATES ----- */
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
    payable.description = description;
    payable.tokens_and_amounts = tokens_and_amounts;
    payable.balances = Vec::<TokenAndAmount>::new();
    payable.allows_any_token = allows_any_token;
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

#[event]
pub struct InitializedPayableEvent {
    pub global_count: u64,
    pub host_count: u64,
}
