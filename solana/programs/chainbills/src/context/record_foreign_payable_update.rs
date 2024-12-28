use crate::{error::*, payload::PayablePayload, state::*};
use anchor_lang::prelude::*;
use wormhole_anchor_sdk::wormhole::{self, program::Wormhole};

#[derive(Accounts)]
#[instruction(payable_id: [u8; 32], ataa_len: u8, vaa_hash: [u8; 32])]
/// Context used to record a foreign payable update.
pub struct RecordForeignPayableUpdate<'info> {
  #[account(
    init_if_needed,
    seeds = [payable_id.as_ref()],
    bump,
    payer = signer,
    space = PayableForeign::space(ataa_len.into())
  )]
  pub foreign_payable: Box<Account<'info, PayableForeign>>,

  #[account(
    init_if_needed,
    seeds = [ChainForeignPayableId::SEED_PREFIX, &chain_stats.next_foreign_payable().to_le_bytes()[..]],
    bump,
    payer = signer,
    space = ChainForeignPayableId::SPACE
  )]
  /// Keeps the payable_id of the foreign_payable at chain level.
  /// Useful for getting all foreign payables on this chain.
  pub chain_foreign_payable_id: Box<Account<'info, ChainForeignPayableId>>,

  #[account(
        seeds = [
            RegisteredForeignContract::SEED_PREFIX,
            &posted_vaa.emitter_chain().to_le_bytes()[..]
        ],
        bump,
        constraint = &registered_foreign_contract.emitter_address == posted_vaa.emitter_address() @ ChainbillsError::InvalidForeignContract
    )]
  /// Foreign Contract account. It's address should be the emitter of the VAA
  pub registered_foreign_contract: Account<'info, RegisteredForeignContract>,

  #[account(mut, seeds = [ChainStats::SEED_PREFIX], bump)]
  /// Keeps track of entities on this chain. Its payable_count will be
  /// incremented in this instruction.
  pub chain_stats: Box<Account<'info, ChainStats>>,

  #[account(seeds = [Config::SEED_PREFIX], bump)]
  pub config: AccountLoader<'info, Config>,

  #[account(mut)]
  pub signer: Signer<'info>,

  #[account(
        seeds = [
            wormhole::SEED_PREFIX_POSTED_VAA,
            &vaa_hash
        ],
        bump,
        seeds::program = wormhole_program.key
    )]
  /// Verified Wormhole message account. The Wormhole program verified
  /// signatures and posted the account data here. Read-only.
  pub posted_vaa: Account<'info, wormhole::PostedVaa<PayablePayload>>,

  #[account(
        init,
        payer = signer,
        seeds = [
            ConsumedWormholeMessage::SEED_PREFIX,
            &posted_vaa.emitter_chain().to_le_bytes()[..],
            &posted_vaa.sequence().to_le_bytes()[..]
        ],
        bump,
        space = ConsumedWormholeMessage::SPACE
    )]
  /// Consumed Wormhole Message Account. Stores the VAA hash to prevent
  /// replay attacks.
  pub consumed_wormhole_message: Box<Account<'info, ConsumedWormholeMessage>>,

  #[account(
        init,
        seeds = [
            ChainConsumedWormholeMessageId::SEED_PREFIX,
            &chain_stats.next_consumed_wormhole_message().to_le_bytes()[..]
        ],
        bump,
        payer = signer,
        space = ChainConsumedWormholeMessageId::SPACE
    )]
  /// Chain Consumed Wormhole Message ID. Stores the consumed message's
  /// chain_id and sequence. Useful for getting all consumed messages on
  /// this chain.
  pub chain_consumed_wormhole_message_id:
    Box<Account<'info, ChainConsumedWormholeMessageId>>,

  #[account(
    init,
    seeds = [
      PerChainConsumedWormholeMessagesCounter::SEED_PREFIX,
      &posted_vaa.emitter_chain().to_le_bytes()[..]
    ],
    bump,
    payer = signer,
    space = PerChainConsumedWormholeMessagesCounter::SPACE
  )]
  /// Keeps track of the total counter of consumed messages per chain.
  pub per_chain_consumed_wormhole_messages_counter:
    Box<Account<'info, PerChainConsumedWormholeMessagesCounter>>,

  // Wormhole program.
  pub wormhole_program: Program<'info, Wormhole>,

  /// System program.
  pub system_program: Program<'info, System>,
}
