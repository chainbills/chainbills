use anchor_lang::prelude::*;
use crate::program::Chainbills;
use crate::state::GlobalStats;

#[derive(Accounts)]
pub struct InitializeGlobalStats<'info> {
    #[account(init, seeds = [b"global"], bump, payer = admin, space = 8 + GlobalStats::SPACE)]
    pub global_stats: Box<Account<'info, GlobalStats>>,

    #[account(
        address = crate::ID,
        constraint = this_program.programdata_address()? == Some(this_program_data.key())
    )]
    pub this_program: Program<'info, Chainbills>,

    #[account(constraint = this_program_data.upgrade_authority_address == Some(admin.key()))]
    pub this_program_data: Box<Account<'info, ProgramData>>,

    #[account(mut)]
    pub admin: Signer<'info>,

    pub system_program: Program<'info, System>,
}

/// Initialize the GlobalStats
///
/// Should be run once by the deployer of the program
/// before other instructions in this program should be invoked.
pub fn initialize_global_stats_handler(ctx: Context<InitializeGlobalStats>) -> Result<()> {
    let global_stats = ctx.accounts.global_stats.as_mut();
    global_stats.initialize();

    emit!(InitializedGlobalStatsEvent {});
    Ok(())
}

#[event]
pub struct InitializedGlobalStatsEvent {}
