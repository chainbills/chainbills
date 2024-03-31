use anchor_lang::{ prelude::*, solana_program::clock };
use anchor_spl::token::{ self, Mint, Token, TokenAccount, Transfer as SplTransfer };
use crate::constants::*;
use crate::error::ChainbillsError;
use crate::program::Chainbills;
use crate::state::*;

#[derive(Accounts)]
#[instruction(amount: u64)]
pub struct Pay<'info> {
    #[account(
        init,
        seeds = [
            signer.key().as_ref(),
            b"payment",
            payer.payments_count.checked_add(1).unwrap().to_le_bytes().as_ref(),
        ],
        bump,
        payer = signer,
        space = 8 + Payment::SPACE
    )]
    pub payment: Box<Account<'info, Payment>>,

    #[account(mut)]
    pub payable: Box<Account<'info, Payable>>,

    #[account(mut, seeds = [signer.key().as_ref()], bump)]
    pub payer: Box<Account<'info, User>>,

    #[account(mut, seeds=[b"global"], bump)]
    pub global_stats: Box<Account<'info, GlobalStats>>,

    #[account(address = crate::ID)]
    pub this_program: Program<'info, Chainbills>,

    pub mint: Box<Account<'info, Mint>>,

    #[account(
        mut, 
        associated_token::mint = mint,
        associated_token::authority = signer,
    )]
    pub payer_token_account: Box<Account<'info, TokenAccount>>,

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

/// Transfers the amount of tokens to a payable
///
/// ### args
/// * amount<u64>: The amount to be paid
pub fn pay_handler(ctx: Context<Pay>, amount: u64) -> Result<()> {
    /* ----- CHECKS ----- */
    // Ensure that amount is greater than zero
    require!(amount > 0, ChainbillsError::ZeroAmountSpecified);

    // Ensure that the payable is not closed
    let payable = ctx.accounts.payable.as_mut();
    require!(!payable.is_closed, ChainbillsError::PayableIsClosed);

    // Ensure that the payable can still accept new tokens, if this
    // payable allows any token
    let mint = &ctx.accounts.mint;
    if payable.allows_any_token && payable.balances.len() >= MAX_PAYABLES_TOKENS {
        let mut bals_it = payable.balances.iter().peekable();
        while let Some(balance) = bals_it.next() {
            if balance.token == mint.key() {
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
    if !payable.allows_any_token {
        let mut taas_it = payable.tokens_and_amounts.iter().peekable();
        while let Some(taa) = taas_it.next() {
            if taa.token == mint.key() && taa.amount == amount {
                break;
            }
            if taas_it.peek().is_none() {
                return err!(ChainbillsError::MatchingTokenAndAccountNotFound);
            }
        }
    }

    /* ----- TRANSFER ----- */
    let destination = &ctx.accounts.this_program_token_account;
    let source = &ctx.accounts.payer_token_account;
    let token_program = &ctx.accounts.token_program;
    let authority = &ctx.accounts.signer;
    let cpi_accounts = SplTransfer {
        from: source.to_account_info().clone(),
        to: destination.to_account_info().clone(),
        authority: authority.to_account_info().clone(),
    };
    let cpi_program = token_program.to_account_info();
    token::transfer(CpiContext::new(cpi_program, cpi_accounts), amount)?;

    /* ----- STATE UPDATES ----- */
    // Increment the global stats for payments_count.
    let global_stats = ctx.accounts.global_stats.as_mut();
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
            if balance.token == mint.key() {
                balance.amount = balance.amount.checked_add(amount).unwrap();
                was_matching_balance_updated = true;
                break;
            }
        }
    }
    {
        if !was_matching_balance_updated {
            payable.balances.push(TokenAndAmount {
                token: mint.key(),
                amount: amount,
            });
        }
    }

    // Increment payments_count in the payer that just paid.
    let payer = ctx.accounts.payer.as_mut();
    payer.payments_count = payer.payments_count.checked_add(1).unwrap();

    // Initialize the payment.
    let payment = ctx.accounts.payment.as_mut();
    payment.global_count = global_stats.payments_count;
    payment.payable = payable.key();
    payment.payer = payer.key();
    payment.payer_count = payer.payments_count;
    payment.payable_count = payable.payments_count;
    payment.timestamp = clock::Clock::get()?.unix_timestamp as u64;
    payment.details = TokenAndAmount {
        token: mint.key(),
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

#[event]
pub struct PayEvent {
    pub global_count: u64,
    pub payable_count: u64,
    pub payer_count: u64,
}
