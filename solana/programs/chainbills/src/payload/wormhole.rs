//! Wormhole PostedVAA account data parsing.
//!
//! The Wormhole Core Bridge stores PostedVAA accounts using an 8-byte prefix
//! `b"vaa\x01\0\0\0\0"` followed by Borsh-serialized fields. This format is
//! NOT the standard Anchor sha256 discriminator; the SDK wrapper
//! (`wormhole-anchor-sdk`) treats this prefix as an Anchor-compatible
//! discriminator.
//!
//! We parse the raw account bytes manually to avoid adding a conflicting
//! dependency. Ownership is verified via account constraint (`posted_vaa.owner
//! == wormhole_program.key()`).

use std::str::FromStr;

use anchor_lang::prelude::*;

use crate::errors::ChainbillsError;

/// Parsed fields from a Wormhole Core Bridge `PostedVaaV1` account.
///
/// Only the fields needed for Chainbills logic are extracted. The full account
/// also contains `consistency_level`, `timestamp`, `signature_set`,
/// `guardian_set_index`, and `nonce`, which are skipped.
pub struct PostedVaaData {
  /// VAA sequence number from the emitter's sequence counter.
  pub sequence: u64,

  /// Wormhole chain ID (u16) of the chain that emitted this VAA.
  /// Used to look up the `ChainRegistry` and validate `registered_contract`.
  pub emitter_chain: u16,

  /// 32-byte emitter address in Wormhole-normalized format.
  /// For EVM: left-padded 20-byte address. For Solana: program's pubkey bytes.
  pub emitter_address: [u8; 32],

  /// Raw payload bytes from the VAA body. For Chainbills messages:
  /// - `payload[0] == 0x01` → PayablePayload
  /// - `payload[0] == 0x02` → PaymentPayload
  pub payload: Vec<u8>,
}

/// Parse the raw data bytes of a Wormhole Core Bridge `PostedVaaV1` account.
///
/// # Byte layout (after the 8-byte discriminator `b"vaa\x01\0\0\0\0"`):
/// ```text
/// [8]:      consistency_level: u8        (skipped)
/// [9..13]:  timestamp: u32 LE            (skipped)
/// [13..45]: signature_set: Pubkey        (skipped — 32 bytes)
/// [45..49]: guardian_set_index: u32 LE   (skipped)
/// [49..53]: nonce: u32 LE               (skipped)
/// [53..61]: sequence: u64 LE
/// [61..63]: emitter_chain: u16 LE
/// [63..95]: emitter_address: [u8;32]
/// [95..99]: payload_len: u32 LE          (Borsh Vec length prefix)
/// [99+]:    payload bytes
/// ```
///
/// Source: `wormhole-anchor-sdk 0.3.0` `PostedVaaV1` field layout, verified
/// against the deployed Wormhole Core Bridge on Solana mainnet and devnet.
///
/// # Arguments
/// * `data` — raw bytes of the PostedVAA account (including the 8-byte
///   discriminator)
pub fn parse_posted_vaa(data: &[u8]) -> Result<PostedVaaData> {
  // Minimum: 8 (disc) + 1 + 4 + 32 + 4 + 4 + 8 + 2 + 32 + 4 (payload len
  // prefix) + 1 = 100
  require!(data.len() >= 100, ChainbillsError::InvalidPayloadLength);

  // offset 53..61: sequence (u64 LE)
  let sequence = u64::from_le_bytes(data[53..61].try_into().unwrap());

  // offset 61..63: emitter_chain (u16 LE)
  let emitter_chain = u16::from_le_bytes(data[61..63].try_into().unwrap());

  // offset 63..95: emitter_address ([u8;32])
  let mut emitter_address = [0u8; 32];
  emitter_address.copy_from_slice(&data[63..95]);

  // offset 95..99: payload_len (u32 LE) — Borsh Vec<u8> length prefix
  let payload_len =
    u32::from_le_bytes(data[95..99].try_into().unwrap()) as usize;
  require!(
    data.len() >= 99 + payload_len,
    ChainbillsError::InvalidPayloadLength
  );

  let payload = data[99..99 + payload_len].to_vec();

  Ok(PostedVaaData {
    sequence,
    emitter_chain,
    emitter_address,
    payload,
  })
}

/// Extract the 32-byte VAA body hash from the PostedVAA account key.
///
/// The Wormhole Core Bridge derives the PostedVAA PDA as:
/// `find_program_address([b"PostedVAA", &vaa_hash], &core_bridge_program_id)`
///
/// Verifying this PDA matches the provided `vaa_hash` + `wormhole_program_id`
/// ensures the relayer cannot substitute a valid VAA for a different one.
///
/// # Arguments
/// * `posted_vaa_key`       — the PostedVAA account's public key
/// * `vaa_hash`             — the 32-byte hash provided by the relayer
/// * `wormhole_program_id`  — the Core Bridge program ID
pub fn verify_posted_vaa_pda(
  posted_vaa_key: &Pubkey,
  vaa_hash: &[u8; 32],
  wormhole_program_id: &Pubkey,
) -> Result<()> {
  let (expected, _) = Pubkey::find_program_address(
    &[b"PostedVAA", vaa_hash.as_ref()],
    wormhole_program_id,
  );
  require!(expected == *posted_vaa_key, ChainbillsError::InvalidEmitter);
  Ok(())
}

/// Validate that `wormhole_program` is the known mainnet or devnet Core Bridge.
///
/// Using the owner check on PostedVAA alone is the primary security guarantee —
/// this is an additional sanity check so a misconfigured relayer fails loudly.
pub fn validate_wormhole_program(wormhole_program_id: &Pubkey) -> Result<()> {
  let mainnet =
    Pubkey::from_str("worm2ZoG2kUd4vFXhvjh93UUH596ayRfgQ2MgjNMTth").unwrap();
  let devnet =
    Pubkey::from_str("3u8hJUVTA4jH1wYAyUur7FFZVQ8H635K3tSHHF4ssjQ5").unwrap();
  require!(
    *wormhole_program_id == mainnet || *wormhole_program_id == devnet,
    ChainbillsError::InvalidEmitter
  );
  Ok(())
}

/// Validate that the CCTP MessageTransmitter is the known mainnet or devnet
/// program.
pub fn validate_cctp_transmitter(cctp_program_id: &Pubkey) -> Result<()> {
  let mainnet =
    Pubkey::from_str("CCTPV2Sm4AdWt5296sk4P66VBZ7bEhcARwFaaS9YPbeC").unwrap();
  let devnet =
    Pubkey::from_str("CCTPmbSD7gX1bxKPAmg77w8oFzNFpaQiQUWD43TKaecd").unwrap();
  require!(
    *cctp_program_id == mainnet || *cctp_program_id == devnet,
    ChainbillsError::InvalidEmitter
  );
  Ok(())
}
