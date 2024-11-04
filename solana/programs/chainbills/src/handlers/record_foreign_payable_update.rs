use crate::{context::*, error::*, events::*};
use anchor_lang::prelude::*;

/// This instruction records a foreign payable update in the chain. 
#[inline(never)]
pub fn record_foreign_payable_update_handler(
  ctx: Context<RecordForeignPayableUpdate>,
  payable_id: [u8; 32],
  ataa_len: u8,
  vaa_hash: [u8; 32],
) -> Result<()> {
  /* CHECKS */
  let posted_vaa = &ctx.accounts.posted_vaa;
  let payload = &posted_vaa.payload.1;

  // Ensure the Payable ID is what is in the Payload.
  require!(
    payable_id == payload.payable_id,
    ChainbillsError::InvalidPayloadPayableId
  );

  // Ensure the provided ataa_len matches the length of the
  // allowed_tokens_and_amounts in the payload.
  require!(
    ataa_len == payload.allowed_tokens_and_amounts.len() as u8,
    ChainbillsError::InvalidPayloadAtaaLen
  );

  /* STATE CHANGES */
  // Record the foreign payable update.
  let foreign_payable = &mut ctx.accounts.foreign_payable;
  foreign_payable.chain_id = posted_vaa.emitter_chain();
  if payload.action_type == 1 || payload.action_type == 4 {
    foreign_payable.allowed_tokens_and_amounts =
      payload.allowed_tokens_and_amounts.clone();
  } else if payload.action_type == 2 || payload.action_type == 3 {
    foreign_payable.is_closed = payload.is_closed;
  } else {
    return Err(ChainbillsError::InvalidPayloadActionType.into());
  }

  let chain_stats = &mut ctx.accounts.chain_stats;

  // Increment the foreign payable count in the chain stats and record
  // the payable_id in the chain_foreign_payable_id account.
  // TODO: Detect how to know if this is the first time foreign_payable
  // was being initialized. Increment and record only in that case.
  chain_stats.foreign_payables_count = chain_stats.next_foreign_payable();
  let chain_foreign_payable_id = &mut ctx.accounts.chain_foreign_payable_id;
  chain_foreign_payable_id.payable_id = payable_id;

  // Increment ChainStats for consumed messages count.
  chain_stats.consumed_wormhole_messages_count =
    chain_stats.next_consumed_wormhole_message();

  // Record the VAA hash in the consumed messages account.
  let consumed_wormhole_message = &mut ctx.accounts.consumed_wormhole_message;
  consumed_wormhole_message.vaa_hash = vaa_hash;

  // Record the consumed message ID at global level.
  let chain_consumed_wormhole_message_id =
    &mut ctx.accounts.chain_consumed_wormhole_message_id;
  chain_consumed_wormhole_message_id.chain_id = posted_vaa.emitter_chain();
  chain_consumed_wormhole_message_id.message_sequence = posted_vaa.sequence();

  // Record the consumed message count in the chain's consumed messages counter.
  let pccwmc = &mut ctx.accounts.per_chain_consumed_wormhole_messages_counter;
  pccwmc.consumed_messages_count = pccwmc.next_consumed_messages_count();

  // Emit log and event.
  msg!("Recorded Foreign Payable Update with payable_id: {:?}, chain_id: {:?}, and vaa_hash: {:?}.", payable_id, posted_vaa.emitter_chain(), vaa_hash);
  emit!(ConsumedWormholePayableMessage {
    payable_id,
    chain_id: posted_vaa.emitter_chain(),
    vaa_hash
  });
  Ok(())
}
