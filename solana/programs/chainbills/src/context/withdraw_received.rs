use crate::{constants::*, error::ChainbillsError, payload::*, state::*};
use anchor_lang::prelude::*;
use anchor_spl::associated_token::AssociatedToken;
use anchor_spl::token::{Token, TokenAccount};
use wormhole_anchor_sdk::{token_bridge, wormhole};

#[derive(Accounts)]
#[instruction(vaa_hash: [u8; 32], caller: [u8; 32], host_count: u64)]
pub struct WithdrawReceived<'info> {
  #[account(
        init,
        payer = signer,
        seeds = [&caller, Withdrawal::SEED_PREFIX, &host_count.to_le_bytes()],
        bump,
        space = Withdrawal::SPACE
    )]
  pub withdrawal: Box<Account<'info, Withdrawal>>,

  #[account(mut, has_one = host)]
  pub payable: Box<Account<'info, Payable>>,

  #[account(mut, seeds = [signer.key().to_bytes().as_ref()], bump)]
  pub host: Box<Account<'info, User>>,

  #[account(mut, seeds = [GlobalStats::SEED_PREFIX], bump)]
  pub global_stats: Box<Account<'info, GlobalStats>>,

  #[account(
        mut,
        associated_token::mint = token_bridge_wrapped_mint,
        associated_token::authority = global_stats,
    )]
  pub global_token_account: Box<Account<'info, TokenAccount>>,

  #[account(
        seeds = [Config::SEED_PREFIX],
        bump,
    )]
  pub config: AccountLoader<'info, Config>,

  #[account(mut, seeds = [ChainStats::SEED_PREFIX, &vaa.emitter_chain().to_le_bytes()[..]], bump)]
  pub chain_stats: Box<Account<'info, ChainStats>>,

  #[account(
        seeds = [
            ForeignContract::SEED_PREFIX,
            &vaa.emitter_chain().to_le_bytes()[..]
        ],
        bump,
        constraint = foreign_contract.verify(vaa.clone()) @ ChainbillsError::InvalidForeignContract
    )]
  /// Foreign contract account. The vaa's `emitter_address` must
  /// agree with the one we have registered for this message's `emitter_chain`
  /// (chain ID). Read-only.
  pub foreign_contract: Box<Account<'info, ForeignContract>>,

  #[account(
        seeds = [
            wormhole::SEED_PREFIX_POSTED_VAA,
            &vaa_hash
        ],
        bump,
        seeds::program = wormhole_program
    )]
  /// Verified Wormhole message account. The Wormhole program verified
  /// signatures and posted the account data here. Read-only.
  pub vaa: Box<Account<'info, wormhole::PostedVaa<CbPayloadMessage>>>,

  #[account(
        init,
        payer = signer,
        seeds = [
            WormholeReceived::SEED_PREFIX,
            &vaa.emitter_chain().to_le_bytes()[..],
            &vaa.sequence().to_le_bytes()[..]
        ],
        bump,
        space = WormholeReceived::SPACE
    )]
  /// Received account. [`receive_message`](crate::receive_message) will
  /// deserialize the Wormhole message's payload and save it to this account.
  /// This account cannot be overwritten, and will prevent Wormhole message
  /// replay with the same sequence.
  pub wormhole_received: Box<Account<'info, WormholeReceived>>,

  #[account(
        mut,
        seeds = [
            token_bridge::WrappedMint::SEED_PREFIX,
            &token_bridge_wrapped_meta.chain.to_le_bytes(),
            &token_bridge_wrapped_meta.token_address
        ],
        bump,
        seeds::program = token_bridge_program
    )]
  /// Token Bridge wrapped mint info. This is the SPL token that will be
  /// bridged to the foreign contract. The wrapped mint PDA must agree
  /// with the native token's metadata. Mutable.
  pub token_bridge_wrapped_mint: Box<Account<'info, token_bridge::WrappedMint>>,

  #[account(
        seeds = [
            token_bridge::WrappedMeta::SEED_PREFIX,
            token_bridge_wrapped_mint.key().as_ref()
        ],
        bump,
        seeds::program = token_bridge_program
    )]
  /// Token Bridge program's wrapped metadata, which stores info
  /// about the token from its native chain:
  ///   * Wormhole Chain ID
  ///   * Token's native contract address
  ///   * Token's native decimals
  pub token_bridge_wrapped_meta: Account<'info, token_bridge::WrappedMeta>,

  #[account(
        address = config.load()?.authority_signer @ ChainbillsError::InvalidTokenBridgeMintAuthority
    )]
  /// CHECK: Token Bridge custody signer. Read-only.
  pub token_bridge_authority_signer: UncheckedAccount<'info>,

  #[account(
        address = config.load()?.token_bridge_config @ ChainbillsError::InvalidTokenBridgeConfig
    )]
  pub token_bridge_config: Box<Account<'info, token_bridge::Config>>,

  #[account(
        mut,
        address = config.load()?.wormhole_bridge @ ChainbillsError::InvalidWormholeBridge,
    )]
  /// Wormhole bridge data. Mutable.
  pub wormhole_bridge: Box<Account<'info, wormhole::BridgeData>>,

  #[account(
        mut,
        seeds = [
            SEED_PREFIX_SENDING,
            &sequence.next_value().to_le_bytes()[..]
        ],
        bump,
    )]
  /// CHECK: Wormhole Message. Token Bridge program writes info about the
  /// tokens transferred in this account.
  pub wormhole_message: UncheckedAccount<'info>,

  #[account(
        mut,
        address = config.load()?.emitter @ ChainbillsError::InvalidWormholeEmitter
    )]
  /// CHECK: Token Bridge emitter. Read-only.
  pub emitter: UncheckedAccount<'info>,

  #[account(
        mut,
        address = config.load()?.sequence @ ChainbillsError::InvalidWormholeSequence
    )]
  /// CHECK: Token Bridge sequence. Mutable.
  pub sequence: Box<Account<'info, wormhole::SequenceTracker>>,

  #[account(
        mut,
        address = config.load()?.fee_collector @ ChainbillsError::InvalidWormholeFeeCollector
    )]
  /// Wormhole fee collector. Mutable.
  pub fee_collector: Box<Account<'info, wormhole::FeeCollector>>,

  #[account(mut)]
  pub signer: Signer<'info>,

  pub wormhole_program: Program<'info, wormhole::program::Wormhole>,

  pub token_bridge_program: Program<'info, token_bridge::program::TokenBridge>,

  pub associated_token_program: Program<'info, AssociatedToken>,

  pub token_program: Program<'info, Token>,

  pub system_program: Program<'info, System>,

  pub clock: Sysvar<'info, Clock>,

  pub rent: Sysvar<'info, Rent>,
}
