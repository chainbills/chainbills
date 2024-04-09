use crate::{error::ChainbillsError, payload::CbPayloadMessage, state::*};
use anchor_lang::prelude::*;
use wormhole_anchor_sdk::wormhole;

#[derive(Accounts)]
#[instruction(vaa_hash: [u8; 32], caller: [u8; 32], host_count: u64)]
pub struct InitializePayableReceived<'info> {
  #[account(
        init,
        payer = signer,
        seeds = [&caller, Payable::SEED_PREFIX, &host_count.to_le_bytes()],
        bump,
        space = Payable::SPACE
    )]
  pub payable: Box<Account<'info, Payable>>,

  #[account(
      init_if_needed,
      payer = signer,
      seeds = [&caller],
      bump,
      space = User::SPACE
    )]
  pub host: Box<Account<'info, User>>,

  #[account(mut, seeds = [GlobalStats::SEED_PREFIX], bump)]
  pub global_stats: Box<Account<'info, GlobalStats>>,

  #[account(mut)]
  pub signer: Signer<'info>,

  #[account(
        seeds = [Config::SEED_PREFIX],
        bump,
    )]
  pub config: Box<Account<'info, Config>>,

  pub wormhole_program: Program<'info, wormhole::program::Wormhole>,

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
  pub vaa: Box<Account<'info, wormhole::PostedVaa<CbPayloadMessage>>>,

  #[account(
        seeds = [
            ForeignContract::SEED_PREFIX,
            &vaa.emitter_chain().to_le_bytes()[..]
        ],
        bump,
        constraint = foreign_contract.verify(&vaa) @ ChainbillsError::InvalidForeignContract
    )]
  /// Foreign contract account. The vaa's `emitter_address` must
  /// agree with the one we have registered for this message's `emitter_chain`
  /// (chain ID). Read-only.
  pub foreign_contract: Box<Account<'info, ForeignContract>>,

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

  pub system_program: Program<'info, System>,
}
