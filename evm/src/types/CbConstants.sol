// SPDX-License-Identifier: Apache 2
pragma solidity ^0.8.30;

// ---------------------------------------------------------------------------
// Cross-chain payload wire format
// ---------------------------------------------------------------------------

// First byte of every payable-state message (create, close, reopen, update of allowed tokens and amounts).
uint8 constant PAYABLE_PAYLOAD_TYPE = 1;

// First byte of every cross-chain payment message carried in CCTP burn hook data.
uint8 constant PAYMENT_PAYLOAD_TYPE = 2;

// Wire-format version written into every outbound payload.
uint8 constant PAYLOAD_VERSION = 1;

// Payable payload action for a newly created payable or a full state snapshot.
uint8 constant PAYABLE_ACTION_CREATE = 1;

// Payable payload action for closing a payable.
uint8 constant PAYABLE_ACTION_CLOSE = 2;

// Payable payload action for reopening a payable.
uint8 constant PAYABLE_ACTION_REOPEN = 3;

// Payable payload action for replacing the allowed tokens and amounts of a payable.
uint8 constant PAYABLE_ACTION_UPDATE_ALLOWED_TOKENS_AND_AMOUNTS = 4;

// Payment payload action for a cross-chain payment.
uint8 constant PAYMENT_ACTION_PAY = 5;

// Exact byte length of an encoded payment payload.
uint256 constant PAYMENT_PAYLOAD_LENGTH = 251;

// ---------------------------------------------------------------------------
// Fees
// ---------------------------------------------------------------------------

// Basis-point denominator. 10_000 bps is 100%.
uint16 constant MAX_BPS = 10_000;

// ---------------------------------------------------------------------------
// Circle CCTP V2 message layout
// ---------------------------------------------------------------------------

// CCTP V2 finality threshold for fast (soft-finality) attestation.
uint32 constant CCTP_FINALITY_FAST = 1000;

// CCTP V2 finality threshold for hard-finality attestation.
uint32 constant CCTP_FINALITY_FINALIZED = 2000;

// Byte offset of `sourceDomain` in a CCTP V2 message header.
uint256 constant CCTP_SOURCE_DOMAIN_OFFSET = 4;

// Byte offset of `destinationDomain` in a CCTP V2 message header.
uint256 constant CCTP_DESTINATION_DOMAIN_OFFSET = 8;

// Byte offset of the 32-byte `nonce` in a CCTP V2 message header.
uint256 constant CCTP_NONCE_OFFSET = 12;

// Byte offset of `sender` in a CCTP V2 message header.
uint256 constant CCTP_SENDER_OFFSET = 44;

// Byte offset of `recipient` in a CCTP V2 message header.
uint256 constant CCTP_RECIPIENT_OFFSET = 76;

// Byte offset of `destinationCaller` in a CCTP V2 message header.
uint256 constant CCTP_DESTINATION_CALLER_OFFSET = 108;

// Byte offset of `minFinalityThreshold` in a CCTP V2 message header.
uint256 constant CCTP_MIN_FINALITY_THRESHOLD_OFFSET = 140;

// Byte offset of `finalityThresholdExecuted` in a CCTP V2 message header.
uint256 constant CCTP_FINALITY_THRESHOLD_EXECUTED_OFFSET = 144;

// Byte length of a CCTP V2 message header; the message body starts here.
uint256 constant CCTP_MESSAGE_BODY_OFFSET = 148;

// Byte offset (relative to the body) of `burnToken` in a CCTP V2 burn message body.
uint256 constant CCTP_BURN_TOKEN_OFFSET = 4;

// Byte offset (relative to the body) of `mintRecipient` in a CCTP V2 burn message body.
uint256 constant CCTP_MINT_RECIPIENT_OFFSET = 36;

// Byte offset (relative to the body) of `amount` in a CCTP V2 burn message body.
uint256 constant CCTP_BURN_AMOUNT_OFFSET = 68;

// Byte offset (relative to the body) of `messageSender` in a CCTP V2 burn message body.
uint256 constant CCTP_MESSAGE_SENDER_OFFSET = 100;

// Byte offset (relative to the body) of `maxFee` in a CCTP V2 burn message body.
uint256 constant CCTP_MAX_FEE_OFFSET = 132;

// Byte offset (relative to the body) of `feeExecuted` in a CCTP V2 burn message body.
uint256 constant CCTP_FEE_EXECUTED_OFFSET = 164;

// Byte offset (relative to the body) of `expirationBlock` in a CCTP V2 burn message body.
uint256 constant CCTP_EXPIRATION_BLOCK_OFFSET = 196;

// Byte offset (relative to the body) of `hookData` in a CCTP V2 burn message body.
uint256 constant CCTP_HOOK_DATA_OFFSET = 228;

// ---------------------------------------------------------------------------
// Pausable features
// ---------------------------------------------------------------------------

// Feature flag covering `createPayable`.
uint256 constant FEATURE_CREATE_PAYABLE = 1 << 0;

// Feature flag covering host-driven payable updates (close, reopen, allowed tokens, auto-withdraw).
uint256 constant FEATURE_UPDATE_PAYABLE = 1 << 1;

// Feature flag covering `publishPayableDetails`.
uint256 constant FEATURE_PUBLISH_PAYABLE = 1 << 2;

// Feature flag covering same-chain `pay`.
uint256 constant FEATURE_PAY = 1 << 3;

// Feature flag covering outbound cross-chain payments.
uint256 constant FEATURE_PAY_FOREIGN = 1 << 4;

// Feature flag covering inbound cross-chain payments.
uint256 constant FEATURE_RECEIVE_FOREIGN_PAYMENT = 1 << 5;

// Feature flag covering inbound payable updates (Wormhole, CCTP, and admin sync).
uint256 constant FEATURE_RECEIVE_PAYABLE_UPDATE = 1 << 6;

// Feature flag covering host withdrawals.
uint256 constant FEATURE_WITHDRAW = 1 << 7;

// Feature flag covering automatic withdrawals after a payment. When paused, funds stay in the payable balance.
uint256 constant FEATURE_AUTO_WITHDRAW = 1 << 8;

// Union of every defined feature flag.
uint256 constant ALL_FEATURES = (1 << 9) - 1;
