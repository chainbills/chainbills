use crate::state::*;
use anchor_lang::prelude::*;
use wormhole_anchor_sdk::wormhole;

#[derive(Accounts)]
/// Context used to Initialize core program data (Config and Solana's
/// ChainStats).
pub struct Initialize<'info> {
  #[account(mut)]
  /// Whoever initializes the config will be the owner of the program. Signer
  /// for creating the [`Config`] account and posting a Wormhole message
  /// indicating that the program is alive.
  pub owner: Signer<'info>,

  #[account(
      init,
      payer = owner,
      seeds = [ChainStats::SEED_PREFIX],
      bump,
      space = ChainStats::SPACE
  )]
  /// Keeps track of the counts of all entities (Users, Payables, Payments,
  /// and Withdrawals) initialized on Solana Chain in Chainbills.
  pub chain_stats: Box<Account<'info, ChainStats>>,

  #[account(
        init,
        payer = owner,
        seeds = [Config::SEED_PREFIX],
        bump,
        space = Config::SPACE,

    )]
  /// Config account, which saves program data useful for other instructions.
  /// Also saves the payer of the [`initialize`](crate::initialize) instruction
  /// as the program's owner.
  pub config: AccountLoader<'info, Config>,

  /// An external address for collecting fees during withdrawals.
  /// We save it in config and use it for withdrawals.
  pub chainbills_fee_collector: SystemAccount<'info>,

  /// Wormhole program.
  pub wormhole_program: Program<'info, wormhole::program::Wormhole>,

  #[account(
        mut,
        seeds = [wormhole::BridgeData::SEED_PREFIX],
        bump,
        seeds::program = wormhole_program.key,
    )]
  /// Wormhole bridge data account (a.k.a. its config).
  /// [`wormhole::post_message`] requires this account be mutable.
  pub wormhole_bridge: Box<Account<'info, wormhole::BridgeData>>,

  #[account(
        init,
        payer = owner,
        seeds = [wormhole::SEED_PREFIX_EMITTER],
        bump,
        space = 8, // 8 bytes for the discriminator
    )]
  /// CHECK: This program's emitter account for Wormhole messages.
  /// This isn't an account that holds data; it is purely
  /// just a signer for posting Wormhole messages directly.
  pub wormhole_emitter: Account<'info, Empty>,

  #[account(
        mut,
        seeds = [wormhole::FeeCollector::SEED_PREFIX],
        bump,
        seeds::program = wormhole_program.key
    )]
  /// Wormhole fee collector account, which requires lamports before the
  /// program can post a message (if there is a fee).
  /// [`wormhole::post_message`] requires this account be mutable.
  pub wormhole_fee_collector: Box<Account<'info, wormhole::FeeCollector>>,

  #[account(
        mut,
        seeds = [
            wormhole::SequenceTracker::SEED_PREFIX,
            wormhole_emitter.key().as_ref()
        ],
        bump,
        seeds::program = wormhole_program.key
    )]
  /// CHECK: Emitter's sequence account. This is not created until the first
  /// message is posted, so it needs to be an [UncheckedAccount] for the
  /// [`initialize`](crate::initialize) instruction.
  /// [`wormhole::post_message`] requires this account be mutable.
  pub wormhole_sequence: UncheckedAccount<'info>,

  #[account(
        mut,
        seeds = [
            SEED_PREFIX_SENT,
            &wormhole::INITIAL_SEQUENCE.to_le_bytes()[..]
        ],
        bump,
    )]
  /// CHECK: Wormhole message account. The Wormhole program writes to this
  /// account, which requires this program's signature.
  /// [`wormhole::post_message`] requires this account be mutable.
  pub wormhole_message: UncheckedAccount<'info>,

  /// Clock sysvar.
  pub clock: Sysvar<'info, Clock>,

  /// Rent sysvar.
  pub rent: Sysvar<'info, Rent>,

  /// System program.
  pub system_program: Program<'info, System>,
}
