use crate::state::*;
use anchor_lang::prelude::*;


#[derive(Accounts)]
/// Context used to initialize a User.
pub struct InitializeUser<'info> {
  #[account(
    init,
    seeds = [signer.key().as_ref()],
    bump,
    payer = signer,
    space = User::SPACE
  )]
  /// The PDA account to create. It houses details about the user. Keeps track
  /// of the count of entities created by the user.
  pub user: Box<Account<'info, User>>,

  #[account(mut, seeds = [ChainStats::SEED_PREFIX], bump)]
  /// Keeps track of entities on this chain. Its user_count will be
  /// incremented in this instruction.
  pub chain_stats: Box<Account<'info, ChainStats>>,

  #[account(mut)]
  /// The signer of the transaction.
  pub signer: Signer<'info>,

  /// The system program account.
  pub system_program: Program<'info, System>,
}
