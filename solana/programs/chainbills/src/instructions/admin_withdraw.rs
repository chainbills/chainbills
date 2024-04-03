use anchor_lang::prelude::*;
use anchor_spl::token::{ self, Mint, Token, TokenAccount, Transfer as SplTransfer };
use crate::error::ChainbillsError;
use crate::program::Chainbills;
use crate::state::GlobalStats;

#[derive(Accounts)]
#[instruction(amount: u64)]
pub struct AdminWithdraw<'info> {
    pub mint: Box<Account<'info, Mint>>,

    #[account(seeds = [b"global"], bump)]
    pub global_stats: Box<Account<'info, GlobalStats>>,

    #[account(
        address = crate::ID,
        constraint = this_program.programdata_address()? == Some(this_program_data.key())
    )]
    pub this_program: Program<'info, Chainbills>,

    #[account(constraint = this_program_data.upgrade_authority_address == Some(admin.key()))]
    pub this_program_data: Box<Account<'info, ProgramData>>,

    #[account(
        mut,
        associated_token::mint = mint,
        associated_token::authority = global_stats,
    )]
    pub global_token_account: Box<Account<'info, TokenAccount>>,

    #[account(
        mut, 
        associated_token::mint = mint,
        associated_token::authority = admin,
    )]
    pub admin_token_account: Box<Account<'info, TokenAccount>>,

    pub admin: Signer<'info>,

    pub token_program: Program<'info, Token>,
}

/// Withdraws fees from this program.
/// Should be called only by upgrade authority holder of this program.
///
/// ### args
/// * amount<u64>: The amount to be withdrawn
pub fn admin_withdraw_handler(ctx: Context<AdminWithdraw>, amount: u64) -> Result<()> {
    require!(amount > 0, ChainbillsError::ZeroAmountSpecified);

    let destination = &ctx.accounts.admin_token_account;
    let source = &ctx.accounts.global_token_account;
    let token_program = &ctx.accounts.token_program;
    let authority = &ctx.accounts.global_stats;
    let cpi_accounts = SplTransfer {
        from: source.to_account_info().clone(),
        to: destination.to_account_info().clone(),
        authority: authority.to_account_info().clone(),
    };
    let cpi_program = token_program.to_account_info();
    token::transfer(
        CpiContext::new_with_signer(
            cpi_program,
            cpi_accounts,
            &[&[b"global", &[ctx.bumps.global_stats]]]
        ),
        amount
    )?;

    msg!("Admin made a withdrawal.");
    emit!(AdminWithdrawalEvent {});
    Ok(())
}

#[event]
pub struct AdminWithdrawalEvent {}
