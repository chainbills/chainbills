// SPDX-License-Identifier: Apache 2
pragma solidity ^0.8.30;

import {
  ForeignChainAddresses,
  ForeignChainFinality,
  ForeignChainLimits,
  ForeignChainProtocolIds,
  ForeignChainSwitches,
  TokenFeeConfig,
  TokenPaymentLimits
} from '../types/CbTypes.sol';

/// Events emitted by Chainbills facets and libraries.
interface ICbEvents {
  // -------------------------------------------------------------------------
  // Ownership, roles, and pause
  // -------------------------------------------------------------------------

  /// Ownership transfer to `newOwner` started; it completes when `newOwner` accepts.
  event OwnershipTransferStarted(address indexed previousOwner, address indexed newOwner);

  /// `role` was granted to `account` by `sender`.
  event RoleGranted(bytes32 indexed role, address indexed account, address indexed sender);

  /// `role` was revoked from `account` by `sender`.
  event RoleRevoked(bytes32 indexed role, address indexed account, address indexed sender);

  /// The admin role of `role` changed.
  event RoleAdminChanged(bytes32 indexed role, bytes32 indexed previousAdminRole, bytes32 indexed newAdminRole);

  /// The protocol was paused globally.
  event Paused(address account);

  /// The global pause was lifted.
  event Unpaused(address account);

  /// `features` were paused. `pausedFeatures` is the resulting set.
  event FeaturesPaused(uint256 features, uint256 pausedFeatures, address account);

  /// `features` were unpaused. `pausedFeatures` is the resulting set.
  event FeaturesUnpaused(uint256 features, uint256 pausedFeatures, address account);

  // -------------------------------------------------------------------------
  // Protocol configuration
  // -------------------------------------------------------------------------

  /// The protocol was initialized for `cbChainId`.
  event Initialized(bytes32 indexed cbChainId, address indexed owner);

  event FeeCollectorUpdated(address indexed feeCollector);
  event WithdrawalFeeBpsUpdated(uint16 feeBps);
  event MaxAllowedTokensAndAmountsUpdated(uint8 maxAllowedTokensAndAmounts);
  event RelayerRestrictionUpdated(bool isRelayerRestricted);
  event PublishPayableRestrictionUpdated(bool isPublishPayableRestricted);
  event WormholeConfigured(address indexed wormhole, uint16 wormholeChainId, uint8 finality);
  event WormholeEnabledUpdated(bool isEnabled);
  event WormholeFinalityUpdated(uint8 finality);
  event CctpConfigured(
    address indexed tokenMessenger, address indexed messageTransmitter, address tokenMinter, uint32 domain
  );
  event CctpEnabledUpdated(bool isEnabled);

  // -------------------------------------------------------------------------
  // Foreign chains
  // -------------------------------------------------------------------------

  event ForeignChainRegistered(bytes32 indexed cbChainId);
  event ForeignChainUnregistered(bytes32 indexed cbChainId);
  event ForeignChainProtocolIdsUpdated(bytes32 indexed cbChainId, ForeignChainProtocolIds protocolIds);
  event ForeignChainAddressesUpdated(bytes32 indexed cbChainId, ForeignChainAddresses addresses);
  event ForeignChainSwitchesUpdated(bytes32 indexed cbChainId, ForeignChainSwitches switches);
  event ForeignChainFinalityUpdated(bytes32 indexed cbChainId, ForeignChainFinality finality);
  event ForeignChainLimitsUpdated(bytes32 indexed cbChainId, ForeignChainLimits limits);

  // -------------------------------------------------------------------------
  // Tokens
  // -------------------------------------------------------------------------

  event TokenPaymentsAllowed(address indexed token);
  event TokenPaymentsStopped(address indexed token);
  event TokenTransferTaxAllowanceUpdated(address indexed token, bool isTransferTaxAllowed);
  event TokenPaymentLimitsUpdated(address indexed token, TokenPaymentLimits limits);
  event TokenFeeConfigUpdated(address indexed token, TokenFeeConfig fee);
  event MatchingTokenRegistered(bytes32 indexed cbChainId, bytes32 indexed foreignToken, address indexed localToken);
  event MatchingTokenUnregistered(bytes32 indexed cbChainId, bytes32 indexed foreignToken, address indexed localToken);

  // -------------------------------------------------------------------------
  // Users and payables
  // -------------------------------------------------------------------------

  event InitializedUser(address indexed wallet, uint256 chainCount);
  event CreatedPayable(bytes32 indexed payableId, address indexed host, uint256 chainCount, uint256 hostCount);
  event ClosedPayable(bytes32 indexed payableId, address indexed host);
  event ReopenedPayable(bytes32 indexed payableId, address indexed host);
  event UpdatedPayableAllowedTokensAndAmounts(bytes32 indexed payableId, address indexed host);
  event UpdatedPayableAutoWithdrawStatus(bytes32 indexed payableId, address indexed host, bool isAutoWithdraw);

  // -------------------------------------------------------------------------
  // Payments and withdrawals
  // -------------------------------------------------------------------------

  /// A payer on this chain paid a payable (on this or another chain).
  event UserPaid(
    bytes32 indexed payableId,
    address indexed payer,
    bytes32 indexed userPaymentId,
    bytes32 payableChainId,
    address token,
    uint256 requestedAmount,
    uint256 amount,
    uint256 chainCount,
    uint256 payerCount
  );

  /// A payable on this chain received a payment (from this or another chain).
  event PayableReceived(
    bytes32 indexed payableId,
    bytes32 indexed payer,
    bytes32 indexed payablePaymentId,
    bytes32 payerChainId,
    address token,
    uint256 requestedAmount,
    uint256 amount,
    uint256 chainCount,
    uint256 payableCount
  );

  /// A host withdrew from a payable.
  event Withdrew(
    bytes32 indexed payableId,
    address indexed host,
    bytes32 indexed withdrawalId,
    address token,
    uint256 amount,
    uint256 fee,
    uint256 chainCount,
    uint256 hostCount,
    uint256 payableCount
  );

  /// An automatic withdrawal was skipped because the auto-withdraw feature is paused.
  event AutoWithdrawSkipped(bytes32 indexed payableId, address indexed token, uint256 amount);

  /// Tokens held above the sum of payable balances were moved out.
  event UntrackedBalanceRescued(address indexed token, address indexed to, uint256 amount);

  // -------------------------------------------------------------------------
  // Cross-chain messaging
  // -------------------------------------------------------------------------

  /// A payable update was broadcast to foreign chains.
  event PayableUpdateBroadcasted(
    bytes32 indexed payableId, uint64 nonce, uint8 actionType, uint64 wormholeSequence, uint256 cctpMessagesCount
  );

  /// A payable update was sent to `cbChainId` as a CCTP data message.
  event SentPayableUpdateViaCctp(bytes32 indexed payableId, bytes32 indexed cbChainId, uint64 nonce);

  event ReceivedPayableUpdateViaWormhole(
    bytes32 indexed payableId, bytes32 indexed cbChainId, uint64 nonce, bytes32 wormholeHash
  );
  event ReceivedPayableUpdateViaCctp(
    bytes32 indexed payableId, bytes32 indexed cbChainId, uint64 nonce, uint32 finalityThresholdExecuted
  );
  event ReceivedPayableUpdateViaAdminSync(
    bytes32 indexed payableId, bytes32 indexed cbChainId, uint64 nonce, address indexed syncer
  );

  /// A payer on this chain sent a payment to a foreign payable through a CCTP burn with hook data.
  event SentForeignPaymentViaCctp(
    bytes32 indexed payableId,
    bytes32 indexed payableChainId,
    bytes32 indexed userPaymentId,
    uint64 paymentNonce,
    uint256 burnAmount,
    uint256 maxFee,
    uint32 minFinalityThreshold
  );

  /// A payment from a foreign chain was minted and credited to a payable on this chain.
  event ReceivedForeignPaymentViaCctp(
    bytes32 indexed payableId,
    bytes32 indexed payerChainId,
    bytes32 indexed payablePaymentId,
    bytes32 burnNonce,
    uint256 mintedAmount,
    uint32 finalityThresholdExecuted
  );
}
