//! `initialize` — one-time program setup. Creates Config + Stats +
//! SenderAuthority. Only callable by the program's upgrade authority.

use anchor_lang::prelude::*;

use crate::{
  constants::*,
  errors::ChainbillsError,
  events::{ProgramInitialized, UserInitialized},
  state::{Config, SenderAuthority, Stats},
};

/// Accounts for the `initialize` instruction.
#[derive(Accounts)]
pub struct Initialize<'info> {
  /// The upgrade authority of the program. Must sign. Becomes the program
  /// owner.
  #[account(mut)]
  pub authority: Signer<'info>,

  /// The program account itself — used to look up its programdata address.
  #[account(
        constraint = program.programdata_address()? == Some(program_data.key())
            @ ChainbillsError::InvalidProgramData
    )]
  pub program: Program<'info, crate::program::Chainbills>,

  /// The program's upgrade data account. Validates that `authority` is the
  /// upgrade authority — the only entity that should be able to initialize.
  #[account(
        constraint = program_data.upgrade_authority_address == Some(authority.key())
            @ ChainbillsError::UnauthorizedUpgradeAuthority
    )]
  pub program_data: Account<'info, ProgramData>,

  /// Admin config PDA. Seeds: [b"config"].
  #[account(
        init,
        payer = authority,
        space = Config::SPACE,
        seeds = [Config::SEED_PREFIX],
        bump,
    )]
  pub config: Account<'info, Config>,

  /// Chain statistics PDA. Seeds: [b"stats"].
  #[account(
        init,
        payer = authority,
        space = Stats::SPACE,
        seeds = [Stats::SEED_PREFIX],
        bump,
    )]
  pub stats: Account<'info, Stats>,

  /// Sender authority PDA — keyless signer for CCTP deposit_for_burn CPIs.
  /// Seeds: [b"sender_authority"].
  #[account(
        init,
        payer = authority,
        space = SenderAuthority::SPACE,
        seeds = [SenderAuthority::SEED_PREFIX],
        bump,
    )]
  pub sender_authority: Account<'info, SenderAuthority>,

  pub system_program: Program<'info, System>,
}

/// Handler for `initialize`. Sets owner, default fee_bps, and stores the
/// Solana cbChainId (mainnet or devnet based on compile feature).
///
/// # Arguments
/// * `ctx` — accounts for initialization
pub fn process_initialize(ctx: Context<Initialize>) -> Result<()> {
  let cfg = &mut ctx.accounts.config;
  let authority = ctx.accounts.authority.key();
  let now = Clock::get()?.unix_timestamp;

  cfg.owner = authority;
  cfg.fee_collector = authority; // default to owner; update via update_fee_settings
  cfg.fee_bps = DEFAULT_FEE_BPS;

  // Store the cbChainId for this Solana deployment.
  #[cfg(feature = "mainnet")]
  {
    cfg.cb_chain_id = SOLANA_MAINNET_CB_CHAIN_ID;
  }
  #[cfg(not(feature = "mainnet"))]
  {
    cfg.cb_chain_id = SOLANA_DEVNET_CB_CHAIN_ID;
  }

  cfg.payable_update_nonce_counter = 0;
  // Solana production deployments support both Wormhole and CCTP.
  cfg.has_wormhole = true;
  cfg.has_cctp = true;

  // Stats start at zero (default).

  // Emit program-level init event with full config snapshot — useful for
  // off-chain indexers that need the initial state without fetching PDAs.
  emit!(ProgramInitialized {
    owner: authority,
    fee_bps: DEFAULT_FEE_BPS,
    cb_chain_id: cfg.cb_chain_id,
    has_wormhole: cfg.has_wormhole,
    has_cctp: cfg.has_cctp,
    timestamp: now,
  });
  // Also emit UserInitialized for the deployer — consistent with how all other
  // first-time wallet interactions are indexed.
  emit!(UserInitialized {
    user: authority,
    timestamp: now,
  });
  msg!(
    "Chainbills initialized. owner={} fee_bps={} cb_chain_id={:?} \
     has_wormhole={} has_cctp={}",
    authority,
    DEFAULT_FEE_BPS,
    cfg.cb_chain_id,
    cfg.has_wormhole,
    cfg.has_cctp,
  );

  Ok(())
}
