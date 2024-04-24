use crate::{error::ChainbillsError, program::Chainbills, state::*};
use anchor_lang::prelude::*;
use wormhole_anchor_sdk::{token_bridge, wormhole};

#[derive(Accounts)]
/// Context used to Initialize core program data (Config, GlobalStats,
/// Solana's ChainStats).
pub struct Initialize<'info> {
  #[account(mut)]
  /// Whoever initializes the config will be the owner of the program. Signer
  /// for creating the [`Config`] account and posting a Wormhole message
  /// indicating that the program is alive.
  pub owner: Signer<'info>,

  #[account(
      address = crate::ID,
      constraint = this_program.programdata_address()? == Some(this_program_data.key()) @ ChainbillsError::ProgramDataUnauthorized
  )]
  /// Helps in ensuring that the provided `this_program_data` is the
  /// correct one.
  pub this_program: Program<'info, Chainbills>,

  #[account(
    constraint = this_program_data.upgrade_authority_address == Some(owner.key()) @ ChainbillsError::AdminUnauthorized
  )]
  /// Helps in ensuring that the provided `owner` is a correct owner.
  pub this_program_data: Box<Account<'info, ProgramData>>,

  #[account(
      init,
      payer = owner,
      seeds = [GlobalStats::SEED_PREFIX],
      bump,
      space = GlobalStats::SPACE
  )]
  /// Keeps track of the counts of all entities (Users, Payables, Payments,
  /// and Withdrawals) in Chainbills. It is also the signer PDA for the holding
  /// balances in this program.
  pub global_stats: Box<Account<'info, GlobalStats>>,

  #[account(
      init,
      payer = owner,
      seeds = [ChainStats::SEED_PREFIX, &wormhole::CHAIN_ID_SOLANA.to_le_bytes()[..]],
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

  /// Wormhole program.
  pub wormhole_program: Program<'info, wormhole::program::Wormhole>,

  /// Token Bridge program.
  pub token_bridge_program: Program<'info, token_bridge::program::TokenBridge>,

  #[account(
        mut,
        seeds = [wormhole::BridgeData::SEED_PREFIX],
        bump,
        seeds::program = wormhole_program,
    )]
  /// Wormhole bridge data account (a.k.a. its config).
  /// [`wormhole::post_message`] requires this account be mutable.
  pub wormhole_bridge: Box<Account<'info, wormhole::BridgeData>>,

  #[account(
        seeds = [token_bridge::Config::SEED_PREFIX],
        bump,
        seeds::program = token_bridge_program,
    )]
  /// Token Bridge config. Token Bridge program needs this account to
  /// invoke the Wormhole program to post messages. Even though it is a
  /// required account for redeeming token transfers, it is not actually
  /// used for completing these transfers.
  pub token_bridge_config: Box<Account<'info, token_bridge::Config>>,

  #[account(
        seeds = [wormhole::SEED_PREFIX_EMITTER],
        bump,
        seeds::program = wormhole_program
    )]
  /// CHECK: This program's emitter account for Wormhole messages and for
  /// Token Bridge. This isn't an account that holds data; it is purely
  /// just a signer for posting Wormhole messages directly or on behalf of
  /// the Token Bridge program.
  pub emitter: UncheckedAccount<'info>,

  #[account(
        mut,
        seeds = [wormhole::FeeCollector::SEED_PREFIX],
        bump,
        seeds::program = wormhole_program
    )]
  /// Wormhole fee collector account, which requires lamports before the
  /// program can post a message (if there is a fee).
  /// [`wormhole::post_message`] requires this account be mutable.
  pub fee_collector: Box<Account<'info, wormhole::FeeCollector>>,

  #[account(
        mut,
        seeds = [
            wormhole::SequenceTracker::SEED_PREFIX,
            emitter.key().as_ref()
        ],
        bump,
        seeds::program = wormhole_program
    )]
  /// CHECK: Emitter's sequence account. This is not created until the first
  /// message is posted, so it needs to be an [UncheckedAccount] for the
  /// [`initialize`](crate::initialize) instruction.
  /// [`wormhole::post_message`] requires this account be mutable.
  pub sequence: UncheckedAccount<'info>,

  #[account(
        seeds = [token_bridge::SEED_PREFIX_MINT_AUTHORITY],
        bump,
        seeds::program = token_bridge_program,
    )]
  /// CHECK: Token Bridge mint authority. This isn't an account that holds
  /// data; it is purely just a signer (SPL mint authority) for Token Bridge
  /// wrapped assets.
  pub mint_authority: UncheckedAccount<'info>,

  #[account(
        seeds = [token_bridge::SEED_PREFIX_CUSTODY_SIGNER],
        bump,
        seeds::program = token_bridge_program,
    )]
  /// CHECK: Token Bridge custody signer. This isn't an account that holds
  /// data; it is purely just a signer for Token Bridge SPL tranfers.
  pub custody_signer: UncheckedAccount<'info>,

  #[account(
        seeds = [token_bridge::SEED_PREFIX_AUTHORITY_SIGNER],
        bump,
        seeds::program = token_bridge_program,
    )]
  /// CHECK: Token Bridge authority signer. This isn't an account that holds
  /// data; it is purely just a signer for SPL tranfers when it is delegated
  /// spending approval for the SPL token.
  pub authority_signer: UncheckedAccount<'info>,

  /// Clock sysvar.
  pub clock: Sysvar<'info, Clock>,

  /// Rent sysvar.
  pub rent: Sysvar<'info, Rent>,

  /// System program.
  pub system_program: Program<'info, System>,
}
