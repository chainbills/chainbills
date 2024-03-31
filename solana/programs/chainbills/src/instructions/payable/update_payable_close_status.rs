use anchor_lang::prelude::*;
use crate::state::{ Payable, User };

#[derive(Accounts)]
pub struct UpdatePayableCloseStatus<'info> {
    #[account(mut, has_one = host)]
    pub payable: Box<Account<'info, Payable>>,

    #[account(seeds = [signer.key().as_ref()], bump)]
    pub host: Box<Account<'info, User>>,

    #[account(mut)]
    pub signer: Signer<'info>,
}

/// Stop a payable from accepting payments. Can be called only
/// by the host (user) that owns the payable.
pub fn close_payable(ctx: Context<UpdatePayableCloseStatus>) -> Result<()> {
    let payable = ctx.accounts.payable.as_mut();
    payable.is_closed = true;

    msg!("Closed Payable.");
    emit!(ClosePayableEvent {});
    Ok(())
}

/// Allow a closed payable to continue accepting payments.
/// Can be called only by the host (user) that owns the payable.
pub fn reopen_payable(ctx: Context<UpdatePayableCloseStatus>) -> Result<()> {
    let payable = ctx.accounts.payable.as_mut();
    payable.is_closed = false;

    msg!("Reopened Payable.");
    emit!(ReopenPayableEvent {});
    Ok(())
}

#[event]
pub struct ClosePayableEvent {}

#[event]
pub struct ReopenPayableEvent {}
