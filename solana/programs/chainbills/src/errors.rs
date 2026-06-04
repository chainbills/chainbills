//! Program error codes. Mirrors EVM's `CbErrors.sol` naming conventions.
//! Every variant has a `#[msg("...")]` with a human-readable explanation.

use anchor_lang::prelude::*;

/// All errors the Chainbills program can return.
#[error_code]
pub enum ChainbillsError {
  // ── Payable errors ────────────────────────────────────────────────────
  /// The payable has been closed by its host. No new payments accepted.
  #[msg("Payable is closed")]
  PayableClosed,

  /// The payable is not closed. Only callable on closed payables.
  #[msg("Payable is not closed")]
  PayableNotClosed,

  /// No payable account found at the derived PDA address.
  #[msg("Payable not found")]
  PayableNotFound,

  // ── Token errors ──────────────────────────────────────────────────────
  /// The token mint is not in GlobalConfig's allowed list.
  #[msg("Token is not allowed")]
  TokenNotAllowed,

  /// Attempted to allow a token that is already allowed.
  #[msg("Token is already allowed")]
  TokenAlreadyAllowed,

  /// Payment token or amount does not match any entry in the payable's ATAA
  /// list.
  #[msg("Token or amount does not match payable's allowed list")]
  TokenAmountMismatch,

  /// Two entries in the ATAA list reference the same token mint.
  #[msg("Duplicate token in allowed tokens and amounts")]
  DuplicateTokenAndAmount,

  // ── Balance errors ────────────────────────────────────────────────────
  /// Withdrawal amount exceeds the payable's current balance for this token.
  #[msg("Insufficient balance for withdrawal")]
  InsufficientBalance,

  /// Payment amount is below the minimum required by the payable's ATAA entry.
  #[msg("Payment amount is below the required minimum")]
  InsufficientPaymentAmount,

  // ── Authorization errors ───────────────────────────────────────────────
  /// Signer is not the host of this payable.
  #[msg("Unauthorized: signer is not the payable host")]
  UnauthorizedHost,

  /// Signer is not the program owner (GlobalConfig.owner).
  #[msg("Unauthorized: signer is not the program owner")]
  UnauthorizedOwner,

  // ── Foreign payable errors ────────────────────────────────────────────
  /// No ForeignPayable PDA found for the given payable_id.
  #[msg("Foreign payable not found")]
  ForeignPayableNotFound,

  /// The foreign payable is closed. Cannot accept cross-chain payments.
  #[msg("Foreign payable is closed")]
  ForeignPayableClosed,

  /// Incoming payable update nonce is <= the stored nonce. Stale or replayed
  /// update.
  #[msg("Stale payable update nonce — update already applied or out of order")]
  StalePayableUpdateNonce,

  // ── Payload errors ────────────────────────────────────────────────────
  /// Payload type byte does not match expected value (0x01 or 0x02).
  #[msg("Invalid payload type byte")]
  InvalidPayloadType,

  /// Payload version byte is not 0x01.
  #[msg("Invalid payload version byte")]
  InvalidPayloadVersion,

  /// Payload byte length does not match the expected size for its type.
  #[msg("Invalid payload length")]
  InvalidPayloadLength,

  // ── VAA / cross-chain errors ───────────────────────────────────────────
  /// VAA emitter address does not match the registered contract for this
  /// chain.
  #[msg("Invalid VAA emitter address")]
  InvalidEmitter,

  /// VAA emitter_chain does not match the expected Wormhole chain ID.
  #[msg("Invalid VAA emitter chain ID")]
  InvalidVaaEmitterChain,

  /// This VAA hash has already been consumed. Replay attempt rejected.
  #[msg("VAA already consumed — replay protection triggered")]
  VaaAlreadyConsumed,

  /// This payer+nonce combination has already been processed.
  #[msg("Payment nonce already consumed — replay protection triggered")]
  PaymentNonceAlreadyConsumed,

  // ── Arithmetic errors ─────────────────────────────────────────────────
  /// Integer overflow during arithmetic operation. Should never happen with
  /// valid inputs — indicates a logic error or malicious oversized values.
  #[msg("Math overflow")]
  MathOverflow,

  /// Integer underflow during arithmetic operation.
  #[msg("Math underflow")]
  MathUnderflow,

  // ── Program data / upgrade errors ─────────────────────────────────────
  /// The program_data account does not match the program's data address.
  #[msg("Invalid program data account")]
  InvalidProgramData,

  /// The signer is not the upgrade authority of this program.
  #[msg("Unauthorized: signer is not the program upgrade authority")]
  UnauthorizedUpgradeAuthority,

  // ── Accounts errors ───────────────────────────────────────────────────
  /// An instruction that uses remaining_accounts did not receive enough.
  #[msg("Missing required remaining accounts")]
  MissingRemainingAccounts,

  /// A remaining_account key does not match the expected derived address.
  #[msg("Invalid remaining account — key mismatch")]
  InvalidRemainingAccount,

  // ── ATAA validation errors ────────────────────────────────────────────
  /// The ATAA list would exceed the 255-entry wire format limit.
  #[msg("Allowed tokens and amounts list exceeds maximum of 255 entries")]
  MaxAtaaExceeded,

  /// An ATAA entry has amount = 0, which is invalid (0 means any amount is
  /// allowed only when the whole ATAA list is empty).
  #[msg(
    "ATAA entry amount cannot be zero — use an empty ATAA list to accept any \
     amount"
  )]
  AtaaAmountZero,

  // ── Fee errors ────────────────────────────────────────────────────────
  /// fee_bps > 10_000 (would be more than 100%).
  #[msg("Invalid fee settings: fee_bps must be <= 10000")]
  InvalidFeeSettings,

  // ── Input validation errors ───────────────────────────────────────────
  /// An amount argument is zero. All amounts must be > 0.
  #[msg("Amount must be greater than zero")]
  ZeroAmount,

  /// Auto-withdraw failed during an inline withdrawal triggered by a payment.
  #[msg("Auto-withdraw failed")]
  AutoWithdrawFailed,

  /// At least one of has_wormhole or has_cctp must be true when registering a
  /// chain.
  #[msg("Chain must support at least one of Wormhole or CCTP")]
  ChainHasNoProtocol,
}
