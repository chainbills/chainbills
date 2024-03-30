use anchor_lang::prelude::*;
use crate::state::{ GlobalStats, User };

#[derive(Accounts)]
pub struct InitializeUser<'info> {
    #[account(init, seeds = [signer.key().as_ref()], bump, payer = signer, space = 8 + User::SPACE)]
    pub user: Box<Account<'info, User>>,

    #[account(mut, seeds=[b"global"], bump)]
    pub global_stats: Box<Account<'info, GlobalStats>>,

    #[account(mut)]
    pub signer: Signer<'info>,

    pub system_program: Program<'info, System>,
}

/// Initialize a User
///
/// Should be run once for the first time that anyone uses their wallet to 
/// interact with this program.
pub fn initialize_user_handler(ctx: Context<InitializeUser>) -> Result<()> {
    let global_stats = ctx.accounts.global_stats.as_mut();
    global_stats.users_count = global_stats.users_count.checked_add(1).unwrap();

    let user = ctx.accounts.user.as_mut();
    user.initialize(ctx.accounts.signer.key(), global_stats.users_count);

    emit!(InitializedUserEvent {
        global_count: global_stats.users_count,
    });
    Ok(())
}

#[event]
pub struct InitializedUserEvent {
    pub global_count: u64,
}
