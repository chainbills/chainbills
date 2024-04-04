use anchor_lang::prelude::*;
use crate::constants::MAX_PAYABLES_DESCRIPTION_LENGTH;
use crate::error::ChainbillsError;
use crate::state::{ Payable, User };

#[derive(Accounts)]
pub struct UpdatePayable<'info> {
    #[account(mut, has_one = host)]
    pub payable: Box<Account<'info, Payable>>,

    #[account(seeds = [signer.key().as_ref()], bump)]
    pub host: Box<Account<'info, User>>,

    #[account(mut)]
    pub signer: Signer<'info>,
}

/// Stop a payable from accepting payments. Can be called only
/// by the host (user) that owns the payable.
pub fn close_payable(ctx: Context<UpdatePayable>) -> Result<()> {
    let payable = ctx.accounts.payable.as_mut();
    payable.is_closed = true;

    msg!("Closed Payable.");
    emit!(ClosePayableEvent {});
    Ok(())
}

/// Allow a closed payable to continue accepting payments.
/// Can be called only by the host (user) that owns the payable.
pub fn reopen_payable(ctx: Context<UpdatePayable>) -> Result<()> {
    let payable = ctx.accounts.payable.as_mut();
    payable.is_closed = false;

    msg!("Reopened Payable.");
    emit!(ReopenPayableEvent {});
    Ok(())
}

/// Allows a payable's host to update the payable's description.
///
/// ### args
/// * description: the new description of the payable.
pub fn update_payable_description(ctx: Context<UpdatePayable>, description: String) -> Result<()> {
    require!(!description.trim().is_empty(), ChainbillsError::EmptyDescriptionProvided);
    require!(
        description.len() <= MAX_PAYABLES_DESCRIPTION_LENGTH,
        ChainbillsError::MaxPayableDescriptionReached
    );

    let payable = ctx.accounts.payable.as_mut();
    payable.description = description.trim().to_owned();

    msg!("Updated Payable Description.");
    emit!(UpdatePayableDescriptionEvent {});
    Ok(())
}

#[event]
pub struct ClosePayableEvent {}

#[event]
pub struct ReopenPayableEvent {}

#[event]
pub struct UpdatePayableDescriptionEvent {}
