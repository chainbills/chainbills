//! Wormhole Post-Message Shim CPI helper.
//!
//! The shim (`EtZMZM22ViKMo4r5y4Anovs3wKQ2owUmDpjygnMMcdEX`) emits Wormhole
//! messages cheaply by reusing a per-emitter message PDA instead of creating
//! a new account per message (~0.002 SOL saved per call vs direct Core Bridge).
//!
//! ## `post_message` remaining_accounts layout (8 accounts)
//! ```text
//! [0] wormhole_shim_program  — Post-Message Shim program
//! [1] wormhole_core_program  — Core Bridge program
//! [2] wormhole_bridge        — Core Bridge state PDA [b"Bridge"]
//! [3] wormhole_message       — per-emitter reusable PDA [emitter.key] in shim
//! [4] wormhole_sequence      — emitter sequence PDA [b"Sequence", emitter.key]
//!                              in Core Bridge
//! [5] wormhole_fee_collector — PDA [b"fee_collector"] in Core Bridge (mut)
//! [6] clock                  — sysvar::clock::ID
//! [7] event_authority        — PDA [b"__event_authority"] in shim
//! ```
//! Named accounts supply: payer/authority (signer), emitter (sender_authority
//! PDA signs), system_program.
//!
//! ## PDA derivations for relayer
//! ```text
//! wormhole_bridge:        [b"Bridge"]           in core_bridge
//! wormhole_message:       [emitter.key]          in shim
//! wormhole_sequence:      [b"Sequence", emitter] in core_bridge
//! wormhole_fee_collector: [b"fee_collector"]     in core_bridge
//! event_authority:        [b"__event_authority"] in shim
//! ```

#[cfg(not(feature = "skip-external-cpi"))]
use anchor_lang::prelude::*;
#[cfg(not(feature = "skip-external-cpi"))]
use anchor_lang::solana_program::{
  instruction::{AccountMeta, Instruction},
  program::invoke_signed,
  sysvar,
};
#[cfg(not(feature = "skip-external-cpi"))]
use crate::state::SenderAuthority;

/// Wormhole `post_message` discriminator (sha256("global:post_message")[0..8]).
/// Verified: echo -n "global:post_message" | openssl dgst -sha256
pub const POST_MESSAGE_DISC: [u8; 8] = [214, 50, 100, 209, 38, 34, 7, 76];

/// Wormhole finality: Confirmed = 200 (fast, ~5s); Finalized = 201 (safer, ~13s).
pub const FINALITY_CONFIRMED: u8 = 200;

/// Call the Wormhole Post-Message Shim `post_message`.
///
/// Emits `payload` as a Wormhole VAA. `emitter` is the Chainbills
/// `sender_authority` PDA which signs via `invoke_signed`.
/// `rem` must be the 8-account slice (see module doc).
#[cfg(not(feature = "skip-external-cpi"))]
pub fn post_message<'info>(
  nonce: u32,
  payload: &[u8],
  // Named accounts
  payer: &AccountInfo<'info>,
  emitter: &AccountInfo<'info>, // sender_authority PDA
  system_program: &AccountInfo<'info>,
  // 8 remaining accounts
  rem: &[AccountInfo<'info>],
  sender_authority_bump: u8,
) -> Result<()> {
  require!(rem.len() >= 8, crate::errors::ChainbillsError::MissingRemainingAccounts);
  let (shim_program, core_program, bridge, message, sequence, fee_collector, clock, event_authority) =
    (&rem[0], &rem[1], &rem[2], &rem[3], &rem[4], &rem[5], &rem[6], &rem[7]);

  let mut data = POST_MESSAGE_DISC.to_vec();
  // Args: nonce: u32 LE, consistency_level: u8, payload: Vec<u8> (4-byte LE len + bytes)
  data.extend_from_slice(&nonce.to_le_bytes());
  data.push(FINALITY_CONFIRMED);
  data.extend_from_slice(&(payload.len() as u32).to_le_bytes());
  data.extend_from_slice(payload);

  let account_metas = vec![
    AccountMeta::new(*payer.key, true),
    AccountMeta::new(*bridge.key, false),
    AccountMeta::new(*message.key, false),
    AccountMeta::new_readonly(*emitter.key, true),
    AccountMeta::new(*sequence.key, false),
    AccountMeta::new(*fee_collector.key, false),
    AccountMeta::new_readonly(sysvar::clock::ID, false),
    AccountMeta::new_readonly(*system_program.key, false),
    AccountMeta::new_readonly(*core_program.key, false),
    AccountMeta::new_readonly(*event_authority.key, false),
    AccountMeta::new_readonly(*shim_program.key, false),
  ];

  let ix = Instruction { program_id: *shim_program.key, accounts: account_metas, data };
  let signer_seeds: &[&[&[u8]]] = &[&[SenderAuthority::SEED_PREFIX, &[sender_authority_bump]]];

  invoke_signed(
    &ix,
    &[
      payer.clone(), bridge.clone(), message.clone(), emitter.clone(),
      sequence.clone(), fee_collector.clone(), clock.clone(),
      system_program.clone(), core_program.clone(),
      event_authority.clone(), shim_program.clone(),
    ],
    signer_seeds,
  )
  .map_err(|e| { msg!("post_message CPI failed: {:?}", e); e.into() })
}
