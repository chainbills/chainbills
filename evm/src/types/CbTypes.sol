// SPDX-License-Identifier: Apache 2
pragma solidity ^0.8.30;

// ===========================================================================
// Enums
// ===========================================================================

/// Kind of event an activity record describes.
enum ActivityType {
  InitializedUser,
  CreatedPayable,
  UserPaid,
  PayableReceived,
  Withdrew,
  ClosedPayable,
  ReopenedPayable,
  UpdatedPayableAllowedTokensAndAmounts,
  UpdatedPayableAutoWithdrawStatus
}

/// Entity kind mixed into generated IDs so IDs of different entities never collide.
enum EntityType {
  Payable,
  Payment,
  Withdrawal,
  Activity
}

// ===========================================================================
// Tokens and amounts
// ===========================================================================

/// A local token and an amount of it.
struct TokenAndAmount {
  /// Token address, or the diamond address for the native token.
  address token;
  /// Amount in the token's smallest unit.
  uint256 amount;
}

/// A token and amount as carried in cross-chain payloads.
struct TokenAndAmountForeign {
  /// Token address on its home chain in 32-byte (Wormhole) format.
  bytes32 token;
  /// Amount in the token's smallest unit on its home chain.
  uint64 amount;
}

// ===========================================================================
// Protocol configuration
// ===========================================================================

/// Protocol-wide settings of this chain.
struct ProtocolConfig {
  /// CAIP-2 chain identifier of this chain: keccak256("namespace:reference").
  bytes32 cbChainId;
  /// Recipient of withdrawal fees.
  address feeCollector;
  /// Default withdrawal fee in basis points, used for tokens without an override.
  uint16 withdrawalFeeBps;
  /// Maximum number of allowed tokens and amounts a local payable may specify.
  uint8 maxAllowedTokensAndAmounts;
  /// When true, only `RELAYER_ROLE` holders may submit inbound cross-chain messages.
  bool isRelayerRestricted;
  /// When true, only the host or a `RELAYER_ROLE` holder may republish a payable.
  bool isPublishPayableRestricted;
}

/// Wormhole wiring of this chain.
struct WormholeConfig {
  /// Wormhole core bridge on this chain.
  address wormhole;
  /// Wormhole chain ID of this chain.
  uint16 wormholeChainId;
  /// Consistency level used when publishing messages.
  uint8 finality;
  /// Whether Wormhole publishing and receiving is active.
  bool isEnabled;
}

/// Circle CCTP V2 wiring of this chain.
struct CctpConfig {
  /// Circle TokenMessengerV2 on this chain.
  address tokenMessenger;
  /// Circle MessageTransmitterV2 on this chain.
  address messageTransmitter;
  /// Circle TokenMinterV2 on this chain.
  address tokenMinter;
  /// Circle domain of this chain.
  uint32 domain;
  /// Whether CCTP sending and receiving is active.
  bool isEnabled;
}

// ===========================================================================
// Foreign chains
// ===========================================================================

/// Messaging protocol identifiers of a foreign chain.
struct ForeignChainProtocolIds {
  /// Wormhole chain ID of the foreign chain. Only meaningful when `hasWormholeChainId`.
  uint16 wormholeChainId;
  /// Whether the foreign chain is reachable over Wormhole.
  bool hasWormholeChainId;
  /// Circle domain of the foreign chain. Only meaningful when `hasCircleDomain` (domain 0 is valid).
  uint32 circleDomain;
  /// Whether the foreign chain is reachable over CCTP.
  bool hasCircleDomain;
}

/// Addresses (32-byte format) that identify Chainbills on a foreign chain for each messaging role.
struct ForeignChainAddresses {
  /// Expected emitter of inbound Wormhole messages.
  bytes32 wormholeEmitter;
  /// Expected header `sender` of inbound CCTP data messages.
  bytes32 cctpMessageSender;
  /// Expected `messageSender` (depositor) in inbound CCTP burn messages.
  bytes32 cctpBurnSender;
  /// Recipient of outbound CCTP data messages.
  bytes32 cctpRecipient;
  /// Mint recipient of outbound CCTP burns.
  bytes32 cctpMintRecipient;
  /// Destination caller of outbound CCTP messages and burns. Zero lets anyone submit on the destination.
  bytes32 cctpDestinationCaller;
}

/// Per-direction switches of a foreign chain.
struct ForeignChainSwitches {
  /// Send a CCTP data message to this chain on every payable update broadcast.
  bool isCctpUpdateEnabled;
  /// Accept payable updates from this chain.
  bool isInboundUpdateEnabled;
  /// Allow paying payables hosted on this chain.
  bool isOutboundPaymentEnabled;
  /// Accept payments sent from this chain.
  bool isInboundPaymentEnabled;
}

/// CCTP finality settings of a foreign chain.
struct ForeignChainFinality {
  /// `minFinalityThreshold` on outbound CCTP payable update messages (1000 fast, 2000 finalized).
  uint32 outboundUpdateFinality;
  /// `minFinalityThreshold` on outbound CCTP payment burns (1000 fast, 2000 finalized).
  uint32 outboundPaymentFinality;
  /// Lowest `finalityThresholdExecuted` accepted on inbound CCTP payable update messages.
  uint32 minInboundUpdateFinality;
  /// Lowest `finalityThresholdExecuted` accepted on inbound CCTP payment burns.
  uint32 minInboundPaymentFinality;
}

/// Limits applied to outbound payments to a foreign chain.
struct ForeignChainLimits {
  /// Whether `maxOutboundCctpFeeBps` applies.
  bool hasMaxOutboundCctpFeeBps;
  /// Largest CCTP `maxFee` a payer may offer, in basis points of the payment amount.
  uint16 maxOutboundCctpFeeBps;
}

/// Full admin-supplied configuration of a foreign chain.
struct ForeignChainConfig {
  ForeignChainProtocolIds protocolIds;
  ForeignChainAddresses addresses;
  ForeignChainSwitches switches;
  ForeignChainFinality finality;
  ForeignChainLimits limits;
}

/// Stored record of a foreign chain.
struct ForeignChain {
  /// CAIP-2 chain identifier of the foreign chain.
  bytes32 cbChainId;
  /// Whether the chain is currently registered.
  bool isRegistered;
  /// Timestamp of the latest registration.
  uint256 registeredAt;
  /// Admin-supplied configuration.
  ForeignChainConfig config;
}

// ===========================================================================
// Token registry
// ===========================================================================

/// Withdrawal fee settings of a token.
struct TokenFeeConfig {
  /// Whether `feeBps` replaces the global withdrawal fee for this token.
  bool hasFeeBpsOverride;
  /// Token-specific withdrawal fee in basis points.
  uint16 feeBps;
  /// Whether `maxWithdrawalFee` caps the fee. Without a cap the full percentage applies.
  bool hasMaxWithdrawalFee;
  /// Largest fee charged on one withdrawal, in the token's smallest unit.
  uint256 maxWithdrawalFee;
}

/// Payment amount limits of a token.
struct TokenPaymentLimits {
  /// Whether `minPaymentAmount` applies.
  bool hasMinPaymentAmount;
  /// Smallest accepted payment amount.
  uint256 minPaymentAmount;
  /// Whether `maxPaymentAmount` applies.
  bool hasMaxPaymentAmount;
  /// Largest accepted payment amount.
  uint256 maxPaymentAmount;
}

/// Admin configuration of a token.
struct TokenConfig {
  /// Whether new payments and new allowed-token entries may use the token.
  bool isSupported;
  /// Whether incoming transfers may deliver less than the pulled amount.
  bool isTransferTaxAllowed;
  /// Withdrawal fee settings.
  TokenFeeConfig fee;
  /// Payment amount limits.
  TokenPaymentLimits limits;
}

/// Running totals of a token.
struct TokenStats {
  /// Total debited from payers on this chain (same-chain and outbound payments).
  uint256 totalUserPaid;
  /// Total credited to payables on this chain.
  uint256 totalPayableReceived;
  /// Total withdrawn from payables, fees included.
  uint256 totalWithdrawn;
  /// Total withdrawal fees sent to the fee collector.
  uint256 totalWithdrawalFeesCollected;
  /// Sum of the token's balance across all payables.
  uint256 totalPayableBalance;
}

/// Full view of a token.
struct TokenDetails {
  /// Token address, or the diamond address for the native token.
  address token;
  /// Whether an admin has ever configured the token.
  bool isRegistered;
  /// Admin configuration.
  TokenConfig config;
  /// Running totals.
  TokenStats stats;
}

/// A foreign token and the local token it maps to.
struct MatchingToken {
  /// Token on the foreign chain in 32-byte format.
  bytes32 foreignToken;
  /// Matching token on this chain.
  address localToken;
}

// ===========================================================================
// Protocol statistics
// ===========================================================================

/// Entity counters of this chain.
struct ChainStats {
  uint256 usersCount;
  uint256 payablesCount;
  uint256 foreignPayablesCount;
  uint256 userPaymentsCount;
  uint256 payablePaymentsCount;
  uint256 withdrawalsCount;
  uint256 activitiesCount;
}

/// Wormhole message counters of this chain.
struct WormholeStats {
  uint256 publishedWormholeMessagesCount;
  uint256 consumedWormholeMessagesCount;
}

/// CCTP message counters of this chain.
struct CctpStats {
  uint256 emittedCctpPaymentMessagesCount;
  uint256 emittedCctpPayableUpdateMessagesCount;
  uint256 receivedCctpPaymentMessagesCount;
  uint256 receivedCctpPayableUpdateMessagesCount;
}

// ===========================================================================
// Core entities
// ===========================================================================

/// A wallet that has interacted with Chainbills on this chain.
struct User {
  /// Position of the user among all users of this chain (1-based).
  uint256 chainCount;
  uint256 payablesCount;
  uint256 paymentsCount;
  uint256 withdrawalsCount;
  uint256 activitiesCount;
}

/// A payable hosted on this chain.
struct Payable {
  /// Owner of the payable; receives withdrawals.
  address host;
  /// Position of the payable among all payables of this chain (1-based).
  uint256 chainCount;
  /// Position of the payable among the host's payables (1-based).
  uint256 hostCount;
  /// Creation timestamp.
  uint256 createdAt;
  uint256 paymentsCount;
  uint256 withdrawalsCount;
  uint256 activitiesCount;
  /// Number of allowed tokens and amounts. Zero accepts any supported token and amount.
  uint8 allowedTokensAndAmountsCount;
  /// Number of distinct tokens that have ever been credited to the payable.
  uint8 balancesCount;
  /// Whether the payable currently rejects payments.
  bool isClosed;
  /// Whether each payment is withdrawn to the host immediately.
  bool isAutoWithdraw;
}

/// A payable hosted on another chain, mirrored from payable updates.
struct PayableForeign {
  /// CAIP-2 chain identifier of the chain hosting the payable.
  bytes32 chainId;
  /// Number of allowed tokens and amounts. Zero accepts any matching token and amount.
  uint8 allowedTokensAndAmountsCount;
  /// Whether the payable currently rejects payments.
  bool isClosed;
  /// Highest update nonce applied.
  uint64 lastUpdateNonce;
  /// `initiatedAt` of the latest applied update, as set on the hosting chain.
  uint64 lastUpdateInitiatedAt;
  /// Local timestamp when the latest update was applied.
  uint256 lastSyncedAt;
}

/// A payer's receipt, stored on the payer's chain.
struct UserPayment {
  bytes32 payableId;
  address payer;
  /// Token debited from the payer.
  address token;
  /// CAIP-2 chain identifier of the chain hosting the payable.
  bytes32 payableChainId;
  uint256 chainCount;
  uint256 payerCount;
  uint256 timestamp;
  /// Price of the payment (the amount matched against allowed tokens and amounts).
  uint256 requestedAmount;
  /// Total amount debited from the payer, including any transfer-tax buffer or CCTP fee allowance.
  uint256 amount;
}

/// A payable's receipt, stored on the payable's chain.
struct PayablePayment {
  bytes32 payableId;
  /// Payer in 32-byte format.
  bytes32 payer;
  /// Token credited to the payable.
  address token;
  uint256 chainCount;
  /// CAIP-2 chain identifier of the payer's chain.
  bytes32 payerChainId;
  /// Position of this payment among payments to the payable from `payerChainId` (1-based).
  uint256 localChainCount;
  /// Position of this payment among all payments to the payable (1-based).
  uint256 payableCount;
  uint256 timestamp;
  /// Price of the payment.
  uint256 requestedAmount;
  /// Amount actually credited to the payable.
  uint256 amount;
  /// ID of the matching user payment on the payer's chain.
  bytes32 payerPaymentId;
}

/// A host withdrawal from a payable.
struct Withdrawal {
  bytes32 payableId;
  address host;
  address token;
  uint256 chainCount;
  uint256 hostCount;
  uint256 payableCount;
  uint256 timestamp;
  /// Amount deducted from the payable balance.
  uint256 amount;
  /// Portion of `amount` sent to the fee collector. The host receives `amount - fee`.
  uint256 fee;
}

/// Audit-log entry.
struct ActivityRecord {
  uint256 chainCount;
  /// Position among the user's activities, or zero when no user is involved.
  uint256 userCount;
  /// Position among the payable's activities, or zero when no payable is involved.
  uint256 payableCount;
  uint256 timestamp;
  /// ID of the entity the activity refers to (payable, payment, withdrawal, or user).
  bytes32 entity;
  ActivityType activityType;
}

// ===========================================================================
// Cross-chain payloads
// ===========================================================================

/// Payable state message (payload type 1).
struct PayablePayload {
  uint8 payloadType;
  uint8 version;
  uint8 actionType;
  bytes32 payableId;
  uint64 nonce;
  uint64 initiatedAt;
  bool isClosed;
  TokenAndAmountForeign[] allowedTokensAndAmounts;
}

/// Cross-chain payment message (payload type 2).
struct PaymentPayload {
  uint8 payloadType;
  uint8 version;
  uint8 actionType;
  bytes32 payableId;
  uint64 nonce;
  uint64 initiatedAt;
  uint64 amount;
  bytes32 payableChainToken;
  bytes32 payableChainId;
  bytes32 payer;
  bytes32 payerChainToken;
  bytes32 payerChainId;
  bytes32 payerPaymentId;
}

/// Parsed CCTP V2 message header.
struct CctpMessageHeader {
  uint32 version;
  uint32 sourceDomain;
  uint32 destinationDomain;
  bytes32 nonce;
  bytes32 sender;
  bytes32 recipient;
  bytes32 destinationCaller;
  uint32 minFinalityThreshold;
  uint32 finalityThresholdExecuted;
}

/// Parsed CCTP V2 burn message (header and burn body).
struct CctpBurnMessage {
  CctpMessageHeader header;
  bytes32 burnToken;
  bytes32 mintRecipient;
  uint256 amount;
  bytes32 messageSender;
  uint256 maxFee;
  uint256 feeExecuted;
  uint256 expirationBlock;
  bytes hookData;
}

// ===========================================================================
// View models
// ===========================================================================

/// A local payable with its lists.
struct PayableView {
  bytes32 payableId;
  Payable info;
  TokenAndAmount[] allowedTokensAndAmounts;
  TokenAndAmount[] balances;
}

/// A foreign payable with its allowed tokens and amounts.
struct ForeignPayableView {
  bytes32 payableId;
  PayableForeign info;
  TokenAndAmountForeign[] allowedTokensAndAmounts;
}

/// A user with its wallet.
struct UserView {
  address wallet;
  User info;
}

/// Breakdown of a withdrawal before it happens.
struct WithdrawalQuote {
  /// Amount deducted from the payable balance.
  uint256 amount;
  /// Fee sent to the fee collector.
  uint256 fee;
  /// Amount the host receives.
  uint256 net;
  /// Basis points applied before any cap.
  uint16 feeBps;
  /// Whether the token's fee cap reduced the fee.
  bool isFeeCapped;
}

/// Everything a client needs to render protocol status in one call.
struct ProtocolOverview {
  ProtocolConfig protocol;
  WormholeConfig wormhole;
  CctpConfig cctp;
  ChainStats chainStats;
  WormholeStats wormholeStats;
  CctpStats cctpStats;
  bool isPaused;
  uint256 pausedFeatures;
  uint256 foreignChainsCount;
  uint256 registeredTokensCount;
  uint64 lastPayableUpdateNonce;
}
