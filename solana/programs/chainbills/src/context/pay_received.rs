use crate::{error::ChainbillsError, payload::CbPayloadMessage, state::*};
use anchor_lang::prelude::*;
use anchor_spl::token::{Mint, Token, TokenAccount};
use wormhole_anchor_sdk::{token_bridge, wormhole};

#[derive(Accounts)]
#[instruction(vaa_hash: [u8; 32], caller: [u8; 32], payer_count: u64)]
pub struct PayReceived<'info> {
  #[account(
        init,
        seeds = [&caller, Payment::SEED_PREFIX, &payer_count.to_le_bytes()],
        bump,
        payer = signer,
        space = Payment::SPACE
    )]
  pub payment: Box<Account<'info, Payment>>,

  #[account(mut)]
  pub payable: Box<Account<'info, Payable>>,

  #[account(
      init_if_needed,
      payer = signer,
      seeds = [&caller],
      bump,
      space = User::SPACE
    )]
  pub payer: Box<Account<'info, User>>,

  #[account(mut, seeds=[GlobalStats::SEED_PREFIX], bump)]
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
  pub config: Box<Account<'info, Config>>,

  #[account(
        seeds = [
            ForeignContract::SEED_PREFIX,
            &vaa.emitter_chain().to_le_bytes()[..]
        ],
        bump,
        constraint = foreign_contract.verify(&vaa) @ ChainbillsError::InvalidForeignContract
    )]
  /// Foreign Contract account. The registered contract specified in this
  /// account must agree with the target address for the Token Bridge's token
  /// transfer. Read-only.
  pub foreign_contract: Box<Account<'info, ForeignContract>>,

  #[account(
        mut,
        seeds = [
            token_bridge::WrappedMint::SEED_PREFIX,
            &vaa.data().token_chain().to_be_bytes(),
            vaa.data().token_address()
        ],
        bump,
        seeds::program = token_bridge_program
    )]
  /// Token Bridge wrapped mint info. This is the SPL token that will be
  /// bridged from the foreign contract. The wrapped mint PDA must agree
  /// with the native token's metadata in the wormhole message. Mutable.
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
  pub token_bridge_wrapped_meta: Box<Account<'info, token_bridge::WrappedMeta>>,

  #[account(mut)]
  /// CHECK: Token Bridge claim account. It stores a boolean, whose value
  /// is true if the bridged assets have been claimed. If the transfer has
  /// not been redeemed, this account will not exist yet.
  pub token_bridge_claim: UncheckedAccount<'info>,

  #[account(
        address = foreign_contract.token_bridge_foreign_endpoint @ ChainbillsError::InvalidTokenBridgeForeignEndpoint
    )]
  /// Token Bridge foreign endpoint. This account should really be one
  /// endpoint per chain, but the PDA allows for multiple endpoints for each
  /// chain! We store the proper endpoint for the emitter chain.
  pub token_bridge_foreign_endpoint: Box<Account<'info, token_bridge::EndpointRegistration>>,

  #[account(
        address = config.mint_authority @ ChainbillsError::InvalidTokenBridgeMintAuthority
    )]
  /// CHECK: Token Bridge custody signer. Read-only.
  pub token_bridge_mint_authority: UncheckedAccount<'info>,

  #[account(
        address = config.token_bridge_config @ ChainbillsError::InvalidTokenBridgeConfig
    )]
  pub token_bridge_config: Box<Account<'info, token_bridge::Config>>,

  #[account(
        mut,
        address = config.wormhole_bridge @ ChainbillsError::InvalidWormholeBridge,
    )]
  /// Wormhole bridge data. Mutable.
  pub wormhole_bridge: Box<Account<'info, wormhole::BridgeData>>,

  #[account(
        seeds = [
            wormhole::SEED_PREFIX_POSTED_VAA,
            &vaa_hash
        ],
        bump,
        seeds::program = wormhole_program,
        constraint = vaa.data().to() == crate::ID @ ChainbillsError::InvalidTransferToAddress,
        constraint = vaa.data().to_chain() == wormhole::CHAIN_ID_SOLANA @ ChainbillsError::InvalidTransferToChain,
        constraint = vaa.data().token_chain() != wormhole::CHAIN_ID_SOLANA @ ChainbillsError::InvalidTransferTokenChain
    )]
  /// Verified Wormhole message account. The Wormhole program verified
  /// signatures and posted the account data here. Read-only.
  pub vaa: Box<Account<'info, token_bridge::PostedTransferWith<CbPayloadMessage>>>,

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

  #[account(mut)]
  pub signer: Signer<'info>,

  pub wormhole_program: Program<'info, wormhole::program::Wormhole>,

  pub token_bridge_program: Program<'info, token_bridge::program::TokenBridge>,

  pub associated_token_program: Program<'info, AssociatedToken>,

  pub token_program: Program<'info, Token>,

  pub rent: Sysvar<'info, Rent>,

  pub system_program: Program<'info, System>,
}
