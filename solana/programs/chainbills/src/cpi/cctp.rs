//! Circle CCTP V2 CPI helpers.
//!
//! Three instructions wrapped here:
//!
//! | Instruction        | Program              | Direction              |
//! |--------------------|----------------------|------------------------|
//! | `deposit_for_burn` | TokenMessengerMinter | outbound — burn USDC   |
//! | `send_message`     | MessageTransmitter   | outbound — data payload|
//! | `receive_message`  | MessageTransmitter   | inbound  — verify+mint |
//!
//! ## V1 vs V2
//! Production (mainnet) uses CCTP V2 (`CCTPV2…` program IDs). Devnet uses
//! CCTP V1 (`CCTPmb…`). V1 lacks `max_fee` and `min_finality_threshold` in
//! `deposit_for_burn`. This module targets V2; V1 differences are only
//! relevant for live devnet integration (all CPIs are skipped in unit tests
//! via the `skip-external-cpi` feature).
//!
//! ## `remaining_accounts` layouts
//!
//! ### `deposit_for_burn` (8 accounts, call-site indices shown)
//! ```text
//! [0] message_transmitter_state   — MessageTransmitter PDA (mut)
//! [1] token_messenger_state       — TokenMessengerMinter PDA
//! [2] remote_token_messenger      — per-dest-domain PDA in TMM
//! [3] token_minter_state          — TokenMinter PDA in TMM
//! [4] local_token                 — per-USDC-mint PDA in TMM (mut)
//! [5] message_sent_event_data     — new Keypair (signer, init'd by CCTP)
//! [6] message_transmitter_program — CCTP MessageTransmitter program
//! [7] token_messenger_minter_prog — CCTP TokenMessengerMinter program
//! ```
//! Named accounts supply: owner (sender_authority), event_rent_payer (payer),
//! burn_token_account (program_usdc_ata), burn_token_mint (usdc_mint),
//! token_program, system_program.
//!
//! ### `send_message` — 2 extra accounts after the deposit_for_burn slice
//! ```text
//! [8] message_sent_event_data_payload — new Keypair (signer, for data msg)
//! [9] sender_program                  — Chainbills program (executable)
//! ```
//! mt_state[0] and mt_program[6] are reused from deposit_for_burn slice.
//!
//! ### `receive_message` for DATA (5 accounts)
//! ```text
//! [0] message_transmitter_program
//! [1] message_transmitter_state   (mut)
//! [2] used_nonce                  (PDA in MessageTransmitter, init)
//! [3] authority_pda               (PDA [b"message_transmitter_authority",
//!                                       chainbills_program] in MT)
//! [4] receiver_program            (Chainbills — calls handle_receive_message)
//! ```
//! Named accounts supply: payer/relayer, caller (relayer), system_program.
//!
//! ### `receive_message` for BURN (13 accounts)
//! ```text
//! [0]  message_transmitter_program
//! [1]  message_transmitter_state  (mut)
//! [2]  used_nonce                 (PDA in MessageTransmitter, init)
//! [3]  authority_pda              (PDA [b"message_transmitter_authority",
//!                                       TMM] in MT)
//! [4]  token_messenger_minter_prog (receiver = TMM)
//! [5]  token_messenger_state
//! [6]  remote_token_messenger     (for src_domain)
//! [7]  token_minter_state
//! [8]  local_token                (for USDC, mut)
//! [9]  token_pair                 (for src_domain + src_token)
//! [10] custody_token_account      (CCTP USDC custody, mut)
//! [11] event_authority            (PDA [b"__event_authority"] in TMM)
//! [12] token_program
//! ```
//! Named accounts supply: payer/relayer, caller (relayer), vault_usdc_ata
//! (mint_recipient), system_program.

#[cfg(not(feature = "skip-external-cpi"))]
use anchor_lang::{
  prelude::*,
  solana_program::{
    instruction::{AccountMeta, Instruction},
    program::invoke,
    program::invoke_signed,
  },
};

#[cfg(not(feature = "skip-external-cpi"))]
use crate::state::SenderAuthority;

// ── Discriminators (sha256("global:<name>")[0..8]) ────────────────────────────
// Computed offline: echo -n "global:<name>" | openssl dgst -sha256

/// `deposit_for_burn` on TokenMessengerMinter.
pub const DEPOSIT_FOR_BURN_DISC: [u8; 8] = [215, 60, 61, 46, 114, 55, 128, 176];
/// `send_message` on MessageTransmitter.
pub const SEND_MESSAGE_DISC: [u8; 8] = [57, 40, 34, 178, 189, 10, 65, 26];
/// `receive_message` on MessageTransmitter.
pub const RECEIVE_MESSAGE_DISC: [u8; 8] = [38, 144, 127, 225, 31, 225, 238, 25];

// ── deposit_for_burn ──────────────────────────────────────────────────────────

/// Call CCTP V2 TokenMessengerMinter `deposit_for_burn`.
///
/// Signed by `sender_authority` PDA (`[b"sender_authority"]` in Chainbills).
/// `rem` must start at the deposit_for_burn slice (8 accounts, see module doc).
#[cfg(not(feature = "skip-external-cpi"))]
pub fn deposit_for_burn<'info>(
  amount: u64,
  destination_domain: u32,
  mint_recipient: [u8; 32],
  destination_caller: [u8; 32],
  max_fee: u64,
  min_finality_threshold: u8,
  owner: &AccountInfo<'info>,
  event_rent_payer: &AccountInfo<'info>,
  burn_token_account: &AccountInfo<'info>,
  burn_token_mint: &AccountInfo<'info>,
  token_program: &AccountInfo<'info>,
  system_program: &AccountInfo<'info>,
  rem: &[AccountInfo<'info>],
  sender_authority_bump: u8,
) -> Result<()> {
  require!(rem.len() >= 8, crate::errors::ChainbillsError::MissingRemainingAccounts);
  let (mt_state, tmm_state, remote_tmm, token_minter, local_token, event_data, mt_program, tmm_program) =
    (&rem[0], &rem[1], &rem[2], &rem[3], &rem[4], &rem[5], &rem[6], &rem[7]);

  let mut data = DEPOSIT_FOR_BURN_DISC.to_vec();
  data.extend_from_slice(&amount.to_le_bytes());
  data.extend_from_slice(&destination_domain.to_le_bytes());
  data.extend_from_slice(&mint_recipient);
  data.extend_from_slice(&destination_caller);
  data.extend_from_slice(&max_fee.to_le_bytes());
  data.push(min_finality_threshold);

  let account_metas = vec![
    AccountMeta::new_readonly(*owner.key, true),
    AccountMeta::new_readonly(*event_rent_payer.key, true),
    AccountMeta::new_readonly(*owner.key, false), // sender_authority_pda = owner
    AccountMeta::new(*burn_token_account.key, false),
    AccountMeta::new(*mt_state.key, false),
    AccountMeta::new_readonly(*tmm_state.key, false),
    AccountMeta::new_readonly(*remote_tmm.key, false),
    AccountMeta::new_readonly(*token_minter.key, false),
    AccountMeta::new(*local_token.key, false),
    AccountMeta::new(*burn_token_mint.key, false),
    AccountMeta::new(*event_data.key, true),
    AccountMeta::new_readonly(*mt_program.key, false),
    AccountMeta::new_readonly(*tmm_program.key, false),
    AccountMeta::new_readonly(*token_program.key, false),
    AccountMeta::new_readonly(*system_program.key, false),
  ];

  let ix = Instruction { program_id: *tmm_program.key, accounts: account_metas, data };
  let signer_seeds: &[&[&[u8]]] = &[&[SenderAuthority::SEED_PREFIX, &[sender_authority_bump]]];

  invoke_signed(
    &ix,
    &[
      owner.clone(), event_rent_payer.clone(), owner.clone(),
      burn_token_account.clone(), mt_state.clone(), tmm_state.clone(),
      remote_tmm.clone(), token_minter.clone(), local_token.clone(),
      burn_token_mint.clone(), event_data.clone(),
      mt_program.clone(), tmm_program.clone(),
      token_program.clone(), system_program.clone(),
    ],
    signer_seeds,
  )
  .map_err(|e| { msg!("deposit_for_burn CPI failed: {:?}", e); e.into() })
}

// ── send_message ──────────────────────────────────────────────────────────────

/// Call CCTP V2 MessageTransmitter `send_message`.
///
/// `mt_state` and `mt_program` come from rem[0] and rem[6] of the
/// deposit_for_burn slice. `event_data_payload` and `sender_program` are
/// rem[8] and rem[9] (CCTP-only path) or the caller passes them directly.
#[cfg(not(feature = "skip-external-cpi"))]
pub fn send_message<'info>(
  destination_domain: u32,
  recipient: [u8; 32],
  destination_caller: [u8; 32],
  min_finality_threshold: u8,
  message_body: &[u8],
  event_rent_payer: &AccountInfo<'info>,
  sender_authority: &AccountInfo<'info>,
  system_program: &AccountInfo<'info>,
  mt_state: &AccountInfo<'info>,
  event_data_payload: &AccountInfo<'info>,
  sender_program: &AccountInfo<'info>,
  mt_program: &AccountInfo<'info>,
  sender_authority_bump: u8,
) -> Result<()> {
  let mut data = SEND_MESSAGE_DISC.to_vec();
  data.extend_from_slice(&destination_domain.to_le_bytes());
  data.extend_from_slice(&recipient);
  data.extend_from_slice(&destination_caller);
  data.push(min_finality_threshold);
  data.extend_from_slice(&(message_body.len() as u32).to_le_bytes());
  data.extend_from_slice(message_body);

  let account_metas = vec![
    AccountMeta::new_readonly(*event_rent_payer.key, true),
    AccountMeta::new_readonly(*sender_authority.key, true),
    AccountMeta::new(*mt_state.key, false),
    AccountMeta::new(*event_data_payload.key, true),
    AccountMeta::new_readonly(*sender_program.key, false),
    AccountMeta::new_readonly(*system_program.key, false),
  ];

  let ix = Instruction { program_id: *mt_program.key, accounts: account_metas, data };
  let signer_seeds: &[&[&[u8]]] = &[&[SenderAuthority::SEED_PREFIX, &[sender_authority_bump]]];

  invoke_signed(
    &ix,
    &[
      event_rent_payer.clone(), sender_authority.clone(),
      mt_state.clone(), event_data_payload.clone(),
      sender_program.clone(), system_program.clone(),
    ],
    signer_seeds,
  )
  .map_err(|e| { msg!("send_message CPI failed: {:?}", e); e.into() })
}

// ── receive_message (DATA) ────────────────────────────────────────────────────

/// CCTP V2 `receive_message` for a data message (our program as receiver).
/// 5 accounts in `rem` (see module doc).
#[cfg(not(feature = "skip-external-cpi"))]
pub fn receive_data_message<'info>(
  message: &[u8],
  attestation: &[u8],
  payer: &AccountInfo<'info>,
  caller: &AccountInfo<'info>,
  system_program: &AccountInfo<'info>,
  rem: &[AccountInfo<'info>],
) -> Result<()> {
  require!(rem.len() >= 5, crate::errors::ChainbillsError::MissingRemainingAccounts);
  let (mt_program, mt_state, used_nonce, authority_pda, receiver) =
    (&rem[0], &rem[1], &rem[2], &rem[3], &rem[4]);

  let mut data = RECEIVE_MESSAGE_DISC.to_vec();
  data.extend_from_slice(&(message.len() as u32).to_le_bytes());
  data.extend_from_slice(message);
  data.extend_from_slice(&(attestation.len() as u32).to_le_bytes());
  data.extend_from_slice(attestation);

  let account_metas = vec![
    AccountMeta::new(*payer.key, true),
    AccountMeta::new_readonly(*caller.key, true),
    AccountMeta::new_readonly(*authority_pda.key, false),
    AccountMeta::new(*mt_state.key, false),
    AccountMeta::new(*used_nonce.key, false),
    AccountMeta::new_readonly(*receiver.key, false),
    AccountMeta::new_readonly(*system_program.key, false),
  ];

  let ix = Instruction { program_id: *mt_program.key, accounts: account_metas, data };

  invoke(
    &ix,
    &[payer.clone(), caller.clone(), authority_pda.clone(), mt_state.clone(),
      used_nonce.clone(), receiver.clone(), system_program.clone()],
  )
  .map_err(|e| { msg!("receive_data_message CPI failed: {:?}", e); e.into() })
}

// ── receive_message (BURN) ────────────────────────────────────────────────────

/// CCTP V2 `receive_message` for a burn message (TMM mints USDC to recipient).
/// 13 accounts in `rem` (see module doc).
#[cfg(not(feature = "skip-external-cpi"))]
pub fn receive_burn_message<'info>(
  message: &[u8],
  attestation: &[u8],
  payer: &AccountInfo<'info>,
  caller: &AccountInfo<'info>,
  mint_recipient: &AccountInfo<'info>,
  token_program: &AccountInfo<'info>,
  system_program: &AccountInfo<'info>,
  rem: &[AccountInfo<'info>],
) -> Result<()> {
  require!(rem.len() >= 13, crate::errors::ChainbillsError::MissingRemainingAccounts);
  let (mt_program, mt_state, used_nonce, authority_pda, tmm_program) =
    (&rem[0], &rem[1], &rem[2], &rem[3], &rem[4]);
  let (tmm_state, remote_tmm, token_minter, local_token, token_pair) =
    (&rem[5], &rem[6], &rem[7], &rem[8], &rem[9]);
  let (custody_token, event_authority) = (&rem[10], &rem[11]);

  let mut data = RECEIVE_MESSAGE_DISC.to_vec();
  data.extend_from_slice(&(message.len() as u32).to_le_bytes());
  data.extend_from_slice(message);
  data.extend_from_slice(&(attestation.len() as u32).to_le_bytes());
  data.extend_from_slice(attestation);

  let account_metas = vec![
    AccountMeta::new(*payer.key, true),
    AccountMeta::new_readonly(*caller.key, true),
    AccountMeta::new_readonly(*authority_pda.key, false),
    AccountMeta::new(*mt_state.key, false),
    AccountMeta::new(*used_nonce.key, false),
    AccountMeta::new_readonly(*tmm_program.key, false),
    AccountMeta::new_readonly(*system_program.key, false),
    // Additional accounts forwarded to TMM::handle_receive_message
    AccountMeta::new_readonly(*tmm_state.key, false),
    AccountMeta::new_readonly(*remote_tmm.key, false),
    AccountMeta::new_readonly(*token_minter.key, false),
    AccountMeta::new(*local_token.key, false),
    AccountMeta::new_readonly(*token_pair.key, false),
    AccountMeta::new(*mint_recipient.key, false),
    AccountMeta::new(*custody_token.key, false),
    AccountMeta::new_readonly(*event_authority.key, false),
    AccountMeta::new_readonly(*tmm_program.key, false),
    AccountMeta::new_readonly(*token_program.key, false),
  ];

  let ix = Instruction { program_id: *mt_program.key, accounts: account_metas, data };

  invoke(
    &ix,
    &[
      payer.clone(), caller.clone(), authority_pda.clone(), mt_state.clone(),
      used_nonce.clone(), tmm_program.clone(), system_program.clone(),
      tmm_state.clone(), remote_tmm.clone(), token_minter.clone(),
      local_token.clone(), token_pair.clone(), mint_recipient.clone(),
      custody_token.clone(), event_authority.clone(), tmm_program.clone(),
      token_program.clone(),
    ],
  )
  .map_err(|e| { msg!("receive_burn_message CPI failed: {:?}", e); e.into() })
}
