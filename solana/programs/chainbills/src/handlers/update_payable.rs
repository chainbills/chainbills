use crate::{constants::*, context::*, error::ChainbillsError, events::*, payload::*};
use anchor_lang::prelude::*;

/// Stop a payable from accepting payments. Can be called only
/// by the host (user) that owns the payable.
pub fn close_payable(ctx: Context<UpdatePayable>) -> Result<()> {
  let payable = ctx.accounts.payable.as_mut();
  payable.is_closed = true;

  msg!("Closed Payable.");
  emit!(ClosePayableEvent {});
  Ok(())
}

/// Allow a closed payable to continue accepting payments.
/// Can be called only by the host (user) that owns the payable.
pub fn reopen_payable(ctx: Context<UpdatePayable>) -> Result<()> {
  let payable = ctx.accounts.payable.as_mut();
  payable.is_closed = false;

  msg!("Reopened Payable.");
  emit!(ReopenPayableEvent {});
  Ok(())
}

/// Allows a payable's host to update the payable's description.
///
/// ### args
/// * description: the new description of the payable.
pub fn update_payable_description(ctx: Context<UpdatePayable>, description: String) -> Result<()> {
  require!(
    !description.trim().is_empty(),
    ChainbillsError::EmptyDescriptionProvided
  );
  require!(
    description.len() <= MAX_PAYABLES_DESCRIPTION_LENGTH,
    ChainbillsError::MaxPayableDescriptionReached
  );

  let payable = ctx.accounts.payable.as_mut();
  payable.description = description.trim().to_owned();

  msg!("Updated Payable Description.");
  emit!(UpdatePayableDescriptionEvent {});
  Ok(())
}

fn check_received_inputs(
  ctx: Context<UpdatePayableReceived>,
  vaa_hash: [u8; 32],
  caller: [u8; 32],
) -> Result<()> {
  let vaa = &ctx.accounts.vaa;

  // ensure the caller was expected and is valid
  require!(
    vaa.data().caller == caller && !caller.iter().all(|&x| x == 0),
    ChainbillsError::InvalidCallerAddress
  );


  let wormhole_received = ctx.accounts.wormhole_received.as_mut();
  wormhole_received.batch_id = posted_message.batch_id();
  wormhole_received.vaa_hash = vaa_hash;

  // Ensure matching chain id and user wallet address
  let host = ctx.accounts.host;
  require!(
    host.owner_wallet == caller && host.chain_id == vaa.emitter_chain(),
    ChainbillsError::UnauthorizedCallerAddress
  );

  Ok(())
}

/// Stop a payable from accepting payments from contract call on
/// another chain. Should be called only by the host (user) that created
/// the payable.
///
/// ### args
/// * vaa_hash<[u8; 32]>: The wormhole encoded hash of the inputs from the
///       source chain.
/// * caller<[u8; 32]>: The Wormhole-normalized address of the wallet of the
///       creator of the payable on the source chain.
pub fn close_payable_received(
  ctx: Context<UpdatePayableReceived>,
  vaa_hash: [u8; 32],
  caller: [u8; 32],
) -> Result<()> {
  check_received_inputs(ctx, vaa_hash, caller);

  // ensure the actionId is as expected
  require!(
    ctx.accounts.vaa.data().action_id = ACTION_ID_CLOSE_PAYABLE,
    ChainbillsError::InvalidActionId
  );

  // ensure provided payable matches what was expected
  let payable = ctx.accounts.payable.as_mut();
  require!(
    payable.key().to_bytes() == vaa.data().extract(),
    ChainbillsError::NotMatchingPayableId
  );

  payable.is_closed = true;

  msg!("Closed Payable.");
  emit!(ClosePayableEvent {});
  Ok(())
}

/// Allow a closed payable to continue accepting payments from contract
/// call on another chain. Should be called only by the host (user)
/// that owns the payable.
///
/// ### args
/// * vaa_hash<[u8; 32]>: The wormhole encoded hash of the inputs from the
///       source chain.
/// * caller<[u8; 32]>: The Wormhole-normalized address of the wallet of the
///       creator of the payable on the source chain.
pub fn reopen_payable_received(
  ctx: Context<UpdatePayableReceived>,
  vaa_hash: [u8; 32],
  caller: [u8; 32],
) -> Result<()> {
  check_received_inputs(ctx, vaa_hash, caller);

  // ensure the action_id is as expected
  require!(
    ctx.accounts.vaa.data().action_id = ACTION_ID_REOPEN_PAYABLE,
    ChainbillsError::InvalidActionId
  );

  // ensure provided payable matches what was expected
  let payable = ctx.accounts.payable.as_mut();
  require!(
    payable.key().to_bytes() == vaa.data().extract(),
    ChainbillsError::NotMatchingPayableId
  );

  payable.is_closed = false;

  msg!("Reopened Payable.");
  emit!(ReopenPayableEvent {});
  Ok(())
}

/// Allows a payable's host to update the payable's description from a
/// contract call on another chain.
///
/// ### args
/// * vaa_hash<[u8; 32]>: The wormhole encoded hash of the inputs from the
///       source chain.
/// * caller<[u8; 32]>: The Wormhole-normalized address of the wallet of the
///       creator of the payable on the source chain.
pub fn update_payable_description_received(
  ctx: Context<UpdatePayableReceived>,
  vaa_hash: [u8; 32],
  caller: [u8; 32],
) -> Result<()> {
  check_received_inputs(ctx, vaa_hash, caller);

  // ensure the actionId is as expected
  require!(
    ctx.accounts.vaa.data().action_id = ACTION_ID_UPDATE_PAYABLE_DESCRIPTION,
    ChainbillsError::InvalidActionId
  );

  let payable = ctx.accounts.payable.as_mut();

  let CbUpdatePayableDescription {
    payable_id,
    description,
  } = vaa.data().extract();


  // ensure provided payable matches what was expected
  require!(
    payable.key().to_bytes() == payable_id,
    ChainbillsError::NotMatchingPayableId
  );
  require!(
    !description.trim().is_empty(),
    ChainbillsError::EmptyDescriptionProvided
  );
  require!(
    description.len() <= MAX_PAYABLES_DESCRIPTION_LENGTH,
    ChainbillsError::MaxPayableDescriptionReached
  );

  payable.description = description.trim().to_owned();

  msg!("Updated Payable Description.");
  emit!(UpdatePayableDescriptionEvent {});
  Ok(())
}
