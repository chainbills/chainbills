use crate::{context::Initialize, events::*};
use anchor_lang::prelude::*;
use wormhole_anchor_sdk::wormhole;

/// Initialize the Config and Solana's ChainStats.
///
/// Should be run once by the deployer of the program
/// before other instructions in this program should be invoked.
pub fn initialize_handler(ctx: Context<Initialize>) -> Result<()> {
  // Initialize config account.
  let config = &mut ctx.accounts.config.load_init()?;
  config.withdrawal_fee_percentage = 200u16; // 2.00%
  config.owner = *ctx.accounts.owner.to_account_info().key;
  config.chainbills_fee_collector =
    *ctx.accounts.chainbills_fee_collector.to_account_info().key;
  config.wormhole_bridge = ctx.accounts.wormhole_bridge.key();
  config.wormhole_emitter = ctx.accounts.wormhole_emitter.key();
  config.wormhole_fee_collector = ctx.accounts.wormhole_fee_collector.key();
  config.wormhole_sequence = ctx.accounts.wormhole_sequence.key();

  // Initialize Solana's chain_stats account.
  let chain_stats = ctx.accounts.chain_stats.as_mut();
  chain_stats.initialize(wormhole::CHAIN_ID_SOLANA);

  // Send a message to Wormhole to initialize the sequence counter for this
  // program.

  // // If there is a fee for message sending, transfer it.
  // let fee = ctx.accounts.wormhole_bridge.fee();
  // if fee > 0 {
  //   solana_program::program::invoke(
  //     &solana_program::system_instruction::transfer(
  //       &ctx.accounts.owner.key(),
  //       &ctx.accounts.wormhole_fee_collector.key(),
  //       fee,
  //     ),
  //     &ctx.accounts.to_account_infos(),
  //   )?;
  // }

  // // Send the message.
  // wormhole::post_message(
  //   CpiContext::new_with_signer(
  //     ctx.accounts.wormhole_program.to_account_info(),
  //     wormhole::PostMessage {
  //       config: ctx.accounts.wormhole_bridge.to_account_info(),
  //       message: ctx.accounts.wormhole_message.to_account_info(),
  //       emitter: ctx.accounts.wormhole_emitter.to_account_info(),
  //       sequence: ctx.accounts.wormhole_sequence.to_account_info(),
  //       payer: ctx.accounts.owner.to_account_info(),
  //       fee_collector: ctx.accounts.wormhole_fee_collector.to_account_info(),
  //       clock: ctx.accounts.clock.to_account_info(),
  //       rent: ctx.accounts.rent.to_account_info(),
  //       system_program: ctx.accounts.system_program.to_account_info(),
  //     },
  //     &[
  //       &[
  //         SEED_PREFIX_SENT,
  //         &wormhole::INITIAL_SEQUENCE.to_le_bytes()[..],
  //         &[ctx.bumps.wormhole_message],
  //       ],
  //       &[wormhole::SEED_PREFIX_EMITTER, &[ctx.bumps.wormhole_emitter]],
  //     ],
  //   ),
  //   0,                       // Zero means no batching.
  //   b"Initialized".to_vec(), // simple bytes message to publish
  //   wormhole::Finality::Confirmed,
  // )?;

  // Emit log and event.
  msg!("Initialized Config and Solana's ChainStats.");
  emit!(Initialized {});
  Ok(())
}
