// SPDX-License-Identifier: Apache 2
pragma solidity ^0.8.30;

/// Stores all thrown errors in Chainbills
contract CbErrors {
  /// @notice Thrown when Circle token minting operation fails.
  error CircleMintingFailed();
  /// @notice Thrown when the nonce in the Circle message does not match the expected payload nonce.
  error CircleNonceMismatch();
  /// @notice Thrown when the caller is not the authorized Circle Transmitter.
  error CircleTransmitterOnly();
  /// @notice Thrown when an invalid or unknown Circle domain is encountered.
  error InvalidCircleDomain();
  /// @notice Thrown when the Circle message recipient does not match this contract.
  error CircleRecipientMismatch();
  /// @notice Thrown when the Circle message sender does not match the registered foreign contract.
  error CircleSenderMismatch();
  /// @notice Thrown when the Circle source domain does not match the expected domain.
  error CircleSourceDomainMismatch();
  /// @notice Thrown when the Circle target domain does not match the expected local domain.
  error CircleTargetDomainMismatch();
  /// @notice Thrown when the token being minted does not match the expected token in the payload.
  error CircleTokenMismatch();
  /// @notice Thrown when a message comes from an unregistered Wormhole emitter.
  error EmitterNotRegistered();
  /// @notice Thrown when attempting to process a Wormhole message that was already consumed.
  error HasAlreadyConsumedMessage();
  /// @notice Thrown when the native token payment value does not exactly match the expected amount.
  error IncorrectPaymentValue();
  /// @notice Thrown when the provided Wormhole fee is incorrect.
  error IncorrectWormholeFees();
  /// @notice Thrown when the native token payment value is less than the expected amount.
  error InsufficientPaymentValue();
  /// @notice Thrown when a payable has insufficient balance for a withdrawal.
  error InsufficientWithdrawAmount();
  /// @notice Thrown when the provided Wormhole fee is insufficient.
  error InsufficientWormholeFees();
  /// @notice Thrown when providing a zero or invalid activity ID.
  error InvalidActivityId();
  /// @notice Thrown when providing a zero or invalid chain ID.
  error InvalidChainId();
  /// @notice Thrown when the chain ID or foreign token address is invalid or unregistered.
  error InvalidChainIdOrForeignToken();
  /// @notice Thrown when an invalid Circle Bridge address is provided.
  error InvalidCircleBridge();
  /// @notice Thrown when an invalid Circle Token Minter address is provided.
  error InvalidCircleTokenMinter();
  /// @notice Thrown when an invalid Circle Transmitter address is provided.
  error InvalidCircleTransmitter();
  /// @notice Thrown when an invalid fee collector address is provided.
  error InvalidFeeCollector();
  /// @notice Thrown when the configured local Circle domain is invalid (e.g. zero).
  error InvalidLocalCircleDomain();
  /// @notice Thrown when an invalid Payables logic contract address is provided.
  error InvalidPayablesLogic();
  /// @notice Thrown when providing a zero or invalid payable ID.
  error InvalidPayableId();
  /// @notice Thrown when an unknown action type is parsed from a PayablePayload.
  error InvalidPayablePayloadActionType();
  /// @notice Thrown when providing a zero or invalid payment ID.
  error InvalidPaymentId();
  /// @notice Thrown when decoding an invalid or truncated payload.
  error InvalidPayload();
  /// @notice Thrown when an invalid Transactions logic contract address is provided.
  error InvalidTransactionsLogic();
  /// @notice Thrown when an invalid token address (e.g. zero address for ERC20) is provided.
  error InvalidTokenAddress();
  /// @notice Thrown when an invalid wallet address (e.g. zero address) is provided.
  error InvalidWalletAddress();
  /// @notice Thrown when providing a zero or invalid withdrawal ID.
  error InvalidWithdrawalId();
  /// @notice Thrown when an invalid Wormhole core contract address is provided.
  error InvalidWormholeAddress();
  /// @notice Thrown when an invalid Wormhole Chain ID (e.g. zero) is provided.
  error InvalidWormholeChainId();
  /// @notice Thrown when an invalid or zero Wormhole Emitter address is provided.
  error InvalidWormholeEmitterAddress();
  /// @notice Thrown when an invalid Wormhole finality value (e.g. zero) is provided.
  error InvalidWormholeFinality();
  /// @notice Thrown when paying with a token/amount that does not match the payable's allowed list.
  error MatchingTokenAndAmountNotFound();
  /// @notice Thrown when attempting to withdraw a token that the payable has no balance of.
  error NoBalanceForWithdrawalToken();
  /// @notice Thrown when a caller attempts to modify a payable they do not own.
  error NotYourPayable();
  /// @notice Thrown when a restricted function is called by someone other than the main Chainbills contract.
  error OnlyChainbillsCanCall();
  /// @notice Thrown when a restricted function is called by someone other than a logic contract.
  error OnlyLogicContractsCanCall();
  /// @notice Thrown when attempting to close a payable that is already closed.
  error PayableIsAlreadyClosed();
  /// @notice Thrown when attempting to interact with a closed payable (e.g. paying into it).
  error PayableIsClosed();
  /// @notice Thrown when attempting to reopen a payable that is not currently closed.
  error PayableIsNotClosed();
  /// @notice Thrown when a cross-chain payable update has a nonce older or equal to the last recorded nonce.
  error StalePayableUpdateNonce();
  /// @notice Thrown when a native token fee withdrawal transfer fails.
  error UnsuccessfulFeesWithdrawal();
  /// @notice Thrown when a native token payment transfer fails.
  error UnsuccessfulPayment();
  /// @notice Thrown when a native token withdrawal transfer fails.
  error UnsuccessfulWithdrawal();
  /// @notice Thrown when attempting to use a token that has not been enabled by governance.
  error UnsupportedToken();
  /// @notice Thrown when a zero token amount is specified for a payment or withdrawal.
  error ZeroAmountSpecified();
}
