//! `handle_receive_message` — CCTP MessageTransmitter receiver callback.
//!
//! Circle's MessageTransmitter calls this instruction on our program as the
//! last step of `receive_message` when Chainbills is set as the `receiver`
//! in a CCTP data message. This happens for:
//!   - `recv_payable_update_via_cctp`: PayablePayload data messages
//!   - `recv_payment_via_cctp_only`: PaymentPayload data messages
//!
//! The actual message payload has already been validated and state has already
//! been recorded by the calling instruction *before* it invoked CCTP's
//! `receive_message`. This handler is therefore a no-op — it exists solely to
//! satisfy the CCTP receiver callback ABI.
//!
//! ## Security
//! The `authority_pda` account is signed by CCTP's MessageTransmitter using
//! seeds `[b"message_transmitter_authority", chainbills_program]`. Its
//! presence as a signer proves the call originated from the MessageTransmitter
//! (not a spoofed direct call to our program).

use anchor_lang::prelude::*;

/// Accounts for `handle_receive_message`.
#[derive(Accounts)]
pub struct HandleReceiveMessage<'info> {
  /// Signed by MessageTransmitter with seeds
  /// `[b"message_transmitter_authority", chainbills_program]` in the MT
  /// program. Presence as signer proves this was called by CCTP MT.
  pub authority_pda: Signer<'info>,
}

/// Parameters passed by CCTP MessageTransmitter on callback.
#[derive(AnchorDeserialize, AnchorSerialize)]
pub struct HandleReceiveMessageParams {
  pub remote_domain: u32,
  pub sender: [u8; 32],
  pub message_body: Vec<u8>,
  pub authority_bump: u8,
}

/// Handler: no-op receiver. State was already recorded before this callback.
pub fn process_handle_receive_message(
  _ctx: Context<HandleReceiveMessage>,
  _params: HandleReceiveMessageParams,
) -> Result<()> {
  Ok(())
}
