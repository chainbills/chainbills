//! Program-wide constants: program IDs, sentinel values, payload type bytes,
//! chain identifiers, and fee denominator.

use anchor_lang::{prelude::*, solana_program::system_program};

// ── CCTP V2 Program IDs (Solana Mainnet) ─────────────────────────────────────

/// Circle CCTP V2 MessageTransmitter program on Solana mainnet.
/// Live since October 2025.
pub const CCTP_V2_MESSAGE_TRANSMITTER_MAINNET: &str =
  "CCTPV2Sm4AdWt5296sk4P66VBZ7bEhcARwFaaS9YPbeC";

/// Circle CCTP V2 TokenMessengerMinter program on Solana mainnet.
pub const CCTP_V2_TOKEN_MESSENGER_MINTER_MAINNET: &str =
  "CCTPV2vPZJS2u2BBsUoscuikbYjnpFmbFsvVuJdgUMQe";

/// Circle CCTP V1 MessageTransmitter program on Solana devnet (testnet).
pub const CCTP_V1_MESSAGE_TRANSMITTER_DEVNET: &str =
  "CCTPmbSD7gX1bxKPAmg77w8oFzNFpaQiQUWD43TKaecd";

// ── Wormhole Program IDs
// ──────────────────────────────────────────────────────

/// Wormhole Core Bridge program on Solana mainnet.
pub const WORMHOLE_CORE_MAINNET: &str =
  "worm2ZoG2kUd4vFXhvjh93UUH596ayRfgQ2MgjNMTth";

/// Wormhole Core Bridge program on Solana devnet.
pub const WORMHOLE_CORE_DEVNET: &str =
  "3u8hJUVTA4jH1wYAyUur7FFZVQ8H635K3tSHHF4ssjQ5";

/// Wormhole Post-Message Shim program (reuses per-emitter PDA, saves ~0.002 SOL
/// per message vs posting directly to Core Bridge).
pub const WORMHOLE_POST_MESSAGE_SHIM: &str =
  "EtZMZM22ViKMo4r5y4Anovs3wKQ2owUmDpjygnMMcdEX";

// ── USDC Mint Addresses
// ───────────────────────────────────────────────────────

/// USDC mint on Solana mainnet-beta (SPL Token, not Token-2022).
pub const USDC_MINT_MAINNET: &str =
  "EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v";

/// USDC mint on Solana devnet.
pub const USDC_MINT_DEVNET: &str =
  "4zMMC9srt5Ri5X14GAgXhaHii3GnPAEERYPJgZJDncDU";

// ── Chain Identifiers
// ─────────────────────────────────────────────────────────

/// Wormhole chain ID for Solana. Used in VAA emitter_chain field validation.
pub const SOLANA_WORMHOLE_CHAIN_ID: u16 = 1;

/// Circle CCTP domain for Solana. Used in CCTP burn message destination_domain.
pub const SOLANA_CIRCLE_DOMAIN: u32 = 5;

/// cbChainId for Solana mainnet-beta:
/// keccak256("solana:5eykt4UsFv8P8NJdTREpY1vzqKqZKvdp"). This is the universal
/// cross-chain key used in all Chainbills cross-chain references.
/// Never use Wormhole u16 IDs or Circle u32 domains as app-level chain keys.
pub const SOLANA_MAINNET_CB_CHAIN_ID: [u8; 32] = [
  0x16, 0x50, 0x1b, 0x46, 0x1b, 0x4b, 0x6e, 0x0d, 0xf2, 0x23, 0x37, 0x3a, 0x7e,
  0xe5, 0xf8, 0x86, 0x1b, 0xf5, 0xd5, 0x2f, 0x36, 0x1e, 0x67, 0xf4, 0x25, 0x6e,
  0x02, 0xb7, 0xb0, 0x39, 0xc2, 0x12,
];

/// cbChainId for Solana devnet:
/// keccak256("solana:EtWTRABZaYq6iMfeYKouRu166VU2xqa1").
pub const SOLANA_DEVNET_CB_CHAIN_ID: [u8; 32] = [
  0x31, 0x8e, 0x88, 0x6b, 0x7d, 0x5a, 0x2e, 0x6f, 0x89, 0xc5, 0x0c, 0xd1, 0xcd,
  0xc3, 0x61, 0x4e, 0x5f, 0x66, 0x53, 0x2f, 0x67, 0x3b, 0x5f, 0x14, 0x44, 0x8b,
  0x9b, 0x58, 0xc1, 0x2e, 0x0e, 0x6e,
];

// ── Sentinel Values
// ───────────────────────────────────────────────────────────

/// Sentinel pubkey representing native SOL in token mappings.
/// Using system_program::ID mirrors EVM's address(this) convention.
/// When token_mint == NATIVE_SOL_MINT, route through native SOL instruction
/// variants.
pub fn native_sol_mint() -> Pubkey { system_program::ID }

// ── Payload Type Bytes
// ────────────────────────────────────────────────────────

/// Payload type byte for PayablePayload (cross-chain payable state sync).
/// Must match EVM's PAYLOAD_TYPE_PAYABLE = 0x01.
pub const PAYLOAD_TYPE_PAYABLE: u8 = 0x01;

/// Payload type byte for PaymentPayload (cross-chain payment data).
/// Must match EVM's PAYLOAD_TYPE_PAYMENT = 0x02.
pub const PAYLOAD_TYPE_PAYMENT: u8 = 0x02;

/// Payload version byte. Both payload types use version 0x01.
pub const PAYLOAD_VERSION: u8 = 0x01;

/// Exact byte length of a serialized PaymentPayload.
/// Fixed at 251 bytes, byte-for-byte compatible with EVM encoding.
pub const PAYMENT_PAYLOAD_SIZE: usize = 251;

// ── PayablePayload Action Types
// ───────────────────────────────────────────────

/// Payable action type: create (includes full ATAA list).
pub const ACTION_CREATE: u8 = 1;
/// Payable action type: close (is_closed = true).
pub const ACTION_CLOSE: u8 = 2;
/// Payable action type: reopen (is_closed = false).
pub const ACTION_REOPEN: u8 = 3;
/// Payable action type: update ATAA list.
pub const ACTION_UPDATE_ATAA: u8 = 4;
/// Payment action type (used in PaymentPayload actionType field).
pub const ACTION_PAYMENT: u8 = 5;

// ── Limits ────────────────────────────────────────────────────────────────────

/// Maximum number of allowed tokens and amounts per payable.
/// Wire format uses 1-byte length field (u8), so max is 255.
/// Mirrors EVM's SafeCast.toUint8(allowedTokensAndAmounts.length).
pub const MAX_ATAA_COUNT: u8 = 255;

// ── Fee Settings
// ──────────────────────────────────────────────────────────────

/// Denominator for fee basis points calculation.
/// fee = amount * fee_bps / FEE_DENOMINATOR.
/// e.g., fee_bps = 200 → 2% fee.
pub const FEE_DENOMINATOR: u64 = 10_000;

/// Default fee in basis points (2%).
pub const DEFAULT_FEE_BPS: u16 = 200;
