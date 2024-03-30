use anchor_lang::prelude::*;
use crate::constants::MAX_PAYABLES_DESCRIPTION_LENGTH;
use crate::error::ChainbillsError;
use crate::state::{ Payable, User };

#[derive(Accounts)]
#[instruction(description: String)]
pub struct UpdatePayableDescription<'info> {
    #[account(
        mut, 
        has_one = host,
        realloc = 8 + Payable::SPACE,
        realloc::payer = signer,
        realloc::zero = false
    )]
    pub payable: Box<Account<'info, Payable>>,

    #[account(seeds = [signer.key().as_ref()], bump)]
    pub host: Box<Account<'info, User>>,

    #[account(mut)]
    pub signer: Signer<'info>,

    pub system_program: Program<'info, System>,
}

/// Allows a payable's host to update the payable's description.
///
/// ### args
/// * description: the new description of the payable.
pub fn update_payable_description_handler(ctx: Context<UpdatePayableDescription>, description: String) -> Result<()> {
    require!(
        description.len() <= MAX_PAYABLES_DESCRIPTION_LENGTH,
        ChainbillsError::MaxPayableDescriptionReached
    );

    let payable = ctx.accounts.payable.as_mut();
    payable.description = description;

    emit!(UpdatePayableDescriptionEvent {});
    Ok(())
}

#[event]
pub struct UpdatePayableDescriptionEvent {}
