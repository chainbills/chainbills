use anchor_lang::{ prelude::*, solana_program::clock };
use anchor_spl::token::{ self, Mint, Token, TokenAccount, Transfer as SplTransfer };
use crate::error::ChainbillsError;
use crate::program::Chainbills;
use crate::state::*;

#[derive(Accounts)]
#[instruction(amount: u64)]
pub struct Withdraw<'info> {
    #[account(
        init,
        seeds = [
            signer.key().as_ref(),
            b"withdrawal",
            host.withdrawals_count.checked_add(1).unwrap().to_le_bytes().as_ref(),
        ],
        bump,
        payer = signer,
        space = 8 + Withdrawal::SPACE
    )]
    pub withdrawal: Box<Account<'info, Withdrawal>>,

    #[account(mut, has_one = host)]
    pub payable: Box<Account<'info, Payable>>,

    #[account(mut, seeds = [signer.key().as_ref()], bump)]
    pub host: Box<Account<'info, User>>,

    #[account(mut, seeds = [b"global"], bump)]
    pub global_stats: Box<Account<'info, GlobalStats>>,

    #[account(address = crate::ID)]
    pub this_program: Program<'info, Chainbills>,

    pub mint: Box<Account<'info, Mint>>,

    #[account(
        mut, 
        associated_token::mint = mint,
        associated_token::authority = signer,
    )]
    pub host_token_account: Box<Account<'info, TokenAccount>>,

    #[account(
        mut,
        associated_token::mint = mint,
        associated_token::authority = this_program,
    )]
    pub this_program_token_account: Box<Account<'info, TokenAccount>>,

    #[account(mut)]
    pub signer: Signer<'info>,

    pub token_program: Program<'info, Token>,

    pub system_program: Program<'info, System>,
}

/// Transfers the amount of tokens from a payable to a host
///
/// ### args
/// * amount<u64>: The amount to be withdrawn
pub fn withdraw_handler(ctx: Context<Withdraw>, amount: u64) -> Result<()> {
    /* ----- CHECKS ----- */
    // Ensure that amount is greater than zero
    require!(amount > 0, ChainbillsError::ZeroAmountSpecified);

    // - Ensure that this payable has enough of the provided amount in its balance.
    // - Ensure that the specified token (mint) for withdrawal exists in the
    //   payable's balances.
    let payable = ctx.accounts.payable.as_mut();
    let mint = &ctx.accounts.mint;
    let mut bals_it = payable.balances.iter().peekable();
    while let Some(balance) = bals_it.next() {
        if balance.token == mint.key() {
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

    /* ----- TRANSFER ----- */
    let destination = &ctx.accounts.host_token_account;
    let source = &ctx.accounts.this_program_token_account;
    let token_program = &ctx.accounts.token_program;
    let authority = &ctx.accounts.this_program;
    let cpi_accounts = SplTransfer {
        from: source.to_account_info().clone(),
        to: destination.to_account_info().clone(),
        authority: authority.to_account_info().clone(),
    };
    let cpi_program = token_program.to_account_info();
    let amount_minus_fees = amount.checked_mul(98).unwrap().checked_div(100).unwrap();
    token::transfer(CpiContext::new(cpi_program, cpi_accounts), amount_minus_fees)?;

    /* ----- STATE UPDATES ----- */
    // Increment the global_stats for withdrawals_count.
    let global_stats = ctx.accounts.global_stats.as_mut();
    global_stats.withdrawals_count = global_stats.withdrawals_count.checked_add(1).unwrap();

    // Increment withdrawals_count on the involved payable.
    payable.withdrawals_count = payable.withdrawals_count.checked_add(1).unwrap();

    // Deduct the balances on the involved payable.
    for balance in payable.balances.iter_mut() {
        if balance.token == mint.key() {
            balance.amount = balance.amount.checked_sub(amount).unwrap();
            break;
        }
    }

    // Increment withdrawals_count in the host that just withdrew.
    let host = ctx.accounts.host.as_mut();
    host.withdrawals_count = host.withdrawals_count.checked_add(1).unwrap();

    // Initialize the withdrawal.
    let withdrawal = ctx.accounts.withdrawal.as_mut();
    withdrawal.global_count = global_stats.withdrawals_count;
    withdrawal.payable = payable.key();
    withdrawal.payable_count = payable.withdrawals_count;
    withdrawal.host = host.key();
    withdrawal.host_count = host.withdrawals_count;
    withdrawal.timestamp = clock::Clock::get()?.unix_timestamp as u64;
    withdrawal.details = TokenAndAmount {
        token: mint.key(),
        amount: amount,
    };

    emit!(WithdrawalEvent {
        global_count: global_stats.withdrawals_count,
        payable_count: withdrawal.payable_count,
        host_count: withdrawal.host_count,
    });
    Ok(())
}

#[event]
pub struct WithdrawalEvent {
    pub global_count: u64,
    pub payable_count: u64,
    pub host_count: u64,
}
