// SPDX-License-Identifier: Apache 2
pragma solidity ^0.8.30;

/// Custom errors raised by Chainbills facets and libraries.
interface ICbErrors {
  // -------------------------------------------------------------------------
  // Access and lifecycle
  // -------------------------------------------------------------------------

  /// Caller is not the diamond owner.
  error NotContractOwner(address caller);

  /// Caller is not the pending owner.
  error NotPendingOwner(address caller);

  /// Caller lacks `role`.
  error AccessControlUnauthorizedAccount(address account, bytes32 role);

  /// `renounceRole` was called for an account other than the caller.
  error AccessControlBadConfirmation();

  /// Removing the account would leave `DEFAULT_ADMIN_ROLE` without any holder.
  error LastDefaultAdmin();

  /// The initializer already ran.
  error AlreadyInitialized();

  /// The protocol is paused.
  error EnforcedPause();

  /// The protocol is not paused.
  error ExpectedPause();

  /// A feature covered by `features` is paused.
  error FeaturePaused(uint256 features);

  /// `features` contains bits that do not name a feature.
  error InvalidFeatures(uint256 features);

  /// A nonReentrant function was entered while another was executing.
  error ReentrancyGuardReentrantCall();

  /// Only `RELAYER_ROLE` holders may submit inbound messages while relaying is restricted.
  error RelayerOnly(address caller);

  /// The address is zero or otherwise unusable.
  error InvalidAddress();

  /// The address has no contract code.
  error AddressHasNoCode(address account);

  // -------------------------------------------------------------------------
  // Configuration
  // -------------------------------------------------------------------------

  /// The CAIP-2 chain identifier is zero, equals this chain, or is otherwise invalid.
  error InvalidChainId();

  /// The fee collector is the zero address.
  error InvalidFeeCollector();

  /// Basis points exceed 10_000.
  error InvalidFeeBps(uint16 feeBps);

  /// The maximum allowed-tokens count is zero.
  error InvalidMaxAllowedTokensAndAmounts();

  /// The Wormhole address, chain ID, or finality is invalid.
  error InvalidWormholeConfig();

  /// The CCTP token messenger wiring is invalid.
  error InvalidCctpConfig();

  /// Wormhole is not configured or not enabled on this chain.
  error WormholeNotEnabled();

  /// CCTP is not configured or not enabled on this chain.
  error CctpNotEnabled();

  // -------------------------------------------------------------------------
  // Foreign chain registry
  // -------------------------------------------------------------------------

  /// The foreign chain is not registered.
  error ForeignChainNotRegistered(bytes32 cbChainId);

  /// The foreign chain is already registered.
  error ForeignChainAlreadyRegistered(bytes32 cbChainId);

  /// The Wormhole chain ID is already mapped to another foreign chain.
  error WormholeChainIdTaken(uint16 wormholeChainId, bytes32 cbChainId);

  /// The Circle domain is already mapped to another foreign chain.
  error CircleDomainTaken(uint32 circleDomain, bytes32 cbChainId);

  /// A CCTP finality threshold is neither 1000 nor 2000 (outbound) or above 2000 (inbound).
  error InvalidFinalityThreshold(uint32 threshold);

  /// A required foreign chain address is zero.
  error InvalidForeignChainAddress();

  /// Outbound payments to the chain are disabled.
  error OutboundPaymentsDisabled(bytes32 cbChainId);

  /// Inbound payments from the chain are disabled.
  error InboundPaymentsDisabled(bytes32 cbChainId);

  /// Inbound payable updates from the chain are disabled.
  error InboundUpdatesDisabled(bytes32 cbChainId);

  /// The foreign chain has no Circle domain.
  error ForeignChainHasNoCircleDomain(bytes32 cbChainId);

  // -------------------------------------------------------------------------
  // Token registry
  // -------------------------------------------------------------------------

  /// The token address is zero or otherwise invalid.
  error InvalidTokenAddress();

  /// The token is not supported for payments.
  error UnsupportedToken(address token);

  /// The foreign token address is zero.
  error InvalidForeignToken();

  /// The payment limits are inconsistent (minimum above maximum).
  error InvalidPaymentLimits();

  /// The foreign token has no matching local token.
  error MatchingTokenNotFound(bytes32 cbChainId, bytes32 foreignToken);

  // -------------------------------------------------------------------------
  // Payables
  // -------------------------------------------------------------------------

  /// The payable does not exist.
  error InvalidPayableId();

  /// The caller is not the host of the payable.
  error NotYourPayable();

  /// The payable is closed.
  error PayableIsClosed();

  /// The payable is already closed.
  error PayableIsAlreadyClosed();

  /// The payable is not closed.
  error PayableIsNotClosed();

  /// The allowed tokens and amounts exceed the configured maximum.
  error TooManyAllowedTokensAndAmounts(uint256 count, uint256 max);

  /// The same token and amount appears twice.
  error DuplicateTokenAndAmount();

  /// The amount is zero.
  error ZeroAmountSpecified();

  /// The amount does not fit the 64-bit cross-chain amount field.
  error AmountExceedsCrossChainLimit();

  /// The payable has reached the maximum number of distinct balance tokens.
  error TooManyBalanceTokens();

  /// The caller may not republish the payable while publishing is restricted.
  error PublishPayableRestricted(address caller);

  // -------------------------------------------------------------------------
  // Payments
  // -------------------------------------------------------------------------

  /// The token and amount are not among the payable's allowed tokens and amounts.
  error MatchingTokenAndAmountNotFound();

  /// The amount is below the token's minimum payment amount.
  error PaymentBelowMinimum(uint256 amount, uint256 minimum);

  /// The amount is above the token's maximum payment amount.
  error PaymentAboveMaximum(uint256 amount, uint256 maximum);

  /// `maxAmountIn` is below the payment amount.
  error InvalidMaxAmountIn(uint256 maxAmountIn, uint256 amount);

  /// A buffer above the amount was offered for a token that does not allow transfer taxes.
  error TransferTaxNotAllowed(address token);

  /// Fewer tokens arrived than the payment amount.
  error TransferTaxExceededBuffer(uint256 received, uint256 amount);

  /// A different number of tokens arrived than expected.
  error UnexpectedAmountReceived(uint256 received, uint256 expected);

  /// `msg.value` does not match the required native amount.
  error IncorrectNativeValue(uint256 value, uint256 expected);

  /// A native transfer failed.
  error NativeTransferFailed(address to, uint256 amount);

  /// The native token cannot be sent cross-chain.
  error NativeTokenNotBridgeable();

  /// The CCTP `maxFee` exceeds the chain's limit.
  error CctpMaxFeeTooHigh(uint256 maxFee, uint256 limit);

  // -------------------------------------------------------------------------
  // Withdrawals
  // -------------------------------------------------------------------------

  /// The payable has no balance in the token.
  error NoBalanceForWithdrawalToken();

  /// The payable balance is below the requested amount.
  error InsufficientWithdrawAmount(uint256 balance, uint256 amount);

  /// The rescue amount exceeds the untracked balance.
  error NothingToRescue(address token);

  // -------------------------------------------------------------------------
  // Messaging
  // -------------------------------------------------------------------------

  /// The Wormhole fee in `msg.value` is incorrect.
  error IncorrectWormholeFee(uint256 value, uint256 expected);

  /// The Wormhole core bridge rejected the message.
  error InvalidWormholeMessage(string reason);

  /// The Wormhole emitter chain is not registered.
  error UnknownWormholeChain(uint16 wormholeChainId);

  /// The Wormhole emitter is not the registered Chainbills emitter of its chain.
  error EmitterNotRegistered(uint16 wormholeChainId, bytes32 emitter);

  /// The Wormhole message was already consumed.
  error WormholeMessageAlreadyConsumed(bytes32 hash);

  /// The payload is malformed.
  error InvalidPayload();

  /// The payable payload action type is invalid.
  error InvalidPayablePayloadActionType(uint8 actionType);

  /// The payable update nonce is not above the last applied nonce.
  error StalePayableUpdateNonce(uint64 nonce, uint64 lastNonce);

  /// The update refers to a foreign payable mirrored from another chain.
  error ForeignPayableChainMismatch(bytes32 payableId, bytes32 expected, bytes32 actual);

  /// The CCTP message is shorter than its fixed layout.
  error InvalidCctpMessageLength(uint256 length);

  /// The CCTP source domain is not registered.
  error UnknownCircleDomain(uint32 circleDomain);

  /// The CCTP destination domain is not this chain.
  error CircleDestinationDomainMismatch(uint32 destinationDomain);

  /// The CCTP sender is not the registered Chainbills sender of its chain.
  error CircleSenderMismatch(bytes32 sender);

  /// The CCTP recipient, mint recipient, or destination caller is not this diamond.
  error CircleRecipientMismatch(bytes32 recipient);

  /// The CCTP burn token does not match the payload's token on this chain.
  error CircleTokenMismatch(bytes32 burnToken, bytes32 payableChainToken);

  /// The CCTP attestation finality is below the chain's minimum.
  error InsufficientFinality(uint32 executed, uint32 minimum);

  /// The payload chain fields do not match the CCTP route.
  error PaymentChainMismatch();

  /// The minted amount is below the payment amount.
  error CircleMintedLessThanAmount(uint256 minted, uint256 amount);

  /// Circle's message transmitter rejected the message.
  error CircleMessageReceivingFailed();

  /// The CCTP burn nonce was already consumed.
  error CctpBurnNonceAlreadyConsumed(uint32 sourceDomain, bytes32 nonce);

  /// The CCTP data message nonce was already consumed.
  error CctpDataNonceAlreadyConsumed(uint32 sourceDomain, bytes32 nonce);

  /// The payment nonce was already consumed.
  error PaymentNonceAlreadyConsumed(bytes32 payerChainId, bytes32 payer, uint64 nonce);

  /// Only Circle's message transmitter may call the CCTP handlers.
  error CircleTransmitterOnly();
}
