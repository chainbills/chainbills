// SPDX-License-Identifier: Apache 2
pragma solidity ^0.8.20;

/// Config account data. Mainly Governance.
struct Config {
  /// The number of block confirmations needed before the wormhole network
  /// will attest a message.
  uint8 wormholeFinality;
  /// Wormhole Chain ID of this chain.
  uint16 chainId;
  /// The withdrawal fee percentage with 2 decimals. 200 means 2%.
  uint16 withdrawalFeePercentage;
  /// The Circle Domain of this chain.
  uint32 circleDomain;
  /// The address that receives withdrawal fees.
  address feeCollector;
  /// The address of the Wormhole Core Contract on this chain.
  address wormhole;
  /// The address of the Circle Bridge Contract on this chain.
  address circleBridge;
  /// The address of the Circle Token Minter on this chain.
  address circleTokenMinter;
  /// The address of the Circle Transmitter contract on this chain.
  address circleTransmitter;
}

/// Keeps track of all activities on this chain. Counters for the
/// users, payables, userPayments, and withdrawals mappings.
struct ChainStats {
  /// Total number of users that have ever interacted on this chain.
  uint256 usersCount;
  /// Total number of payables that have ever been created on this chain.
  uint256 payablesCount;
  /// Total number of foreign payables that have ever been recorded.
  uint256 foreignPayablesCount;
  /// Total number of payments that users have ever been made on this chain.
  uint256 userPaymentsCount;
  /// Total number of payments that payables have ever received on this chain.
  uint256 payablePaymentsCount;
  /// Total number of withdrawals that have ever been made on this chain.
  uint256 withdrawalsCount;
  /// Total number of activities that have ever been made on this chain.
  uint256 activitiesCount;
  /// Total number of published Wormhole messages on this chain.
  uint256 publishedWormholeMessagesCount;
  /// Total number of consumed Wormhole messages on this chain.
  uint256 consumedWormholeMessagesCount;
}

/// A user is an entity that can create payables and make payments.
struct User {
  /// The nth count of users on this chain at the point this user was
  /// initialized.
  uint256 chainCount;
  /// Total number of payables that this user has ever created.
  uint256 payablesCount;
  /// Total number of payments that this user has ever made.
  uint256 paymentsCount;
  /// Total number of withdrawals that this user has ever made.
  uint256 withdrawalsCount;
  /// Total number of activities that this user has ever made.
  uint256 activitiesCount;
}

/// Keeps track of details about tokens ever supported on this chain.
struct TokenDetails {
  /// Tells whether payments are currently accepted in this token.
  bool isSupported;
  /// Tells that this token was at least ever supported on this chain.
  address token;
  /// The maximum fees for withdrawal (with its decimals).
  uint256 maxWithdrawalFees;
  /// The total amount of user payments in this token.
  uint256 totalUserPaid;
  /// The total amount of payable payments in this token.
  uint256 totalPayableReceived;
  /// The total amount of withdrawals in this token.
  uint256 totalWithdrawn;
  /// The total amount of fees collected from withdrawals in this token.
  uint256 totalWithdrawalFeesCollected;
}

/// A combination of a token address and its associated amount.
///
/// This combination is used to constrain how much of a token
/// a payable can accept. It is also used to record the details
/// of a payment or a withdrawal.
struct TokenAndAmount {
  /// The address of the associated token.
  address token;
  /// The amount of the token.
  uint256 amount;
}

/// A payable is like a public invoice through which anybody can pay to.
struct Payable {
  /// The address of the User account that owns this Payable.
  address host;
  /// The nth count of payables on this chain at the point this payable
  /// was created.
  uint256 chainCount;
  /// The nth count of payables that the host has created at the point of
  /// this payable's creation.
  uint256 hostCount;
  /// The timestamp of when this payable was created.
  uint256 createdAt;
  /// The total number of payments made to this payable, from all chains.
  uint256 paymentsCount;
  /// The total number of withdrawals made from this payable.
  uint256 withdrawalsCount;
  /// The total number of activities made on this payable.
  uint256 activitiesCount;
  /// The number of the allowedTokensAndAmounts of this Payable.
  uint8 allowedTokensAndAmountsCount;
  /// The length of the balances array in this Payable.
  uint8 balancesCount;
  /// Whether this payable is currently accepting payments.
  bool isClosed;
}

/// Receipt of a payment from any blockchain network (this-chain inclusive)
/// made to a Payable in this chain.
struct PayablePayment {
  /// The ID of the Payable to which this Payment was made.
  bytes32 payableId;
  /// The Wormhole-normalized wallet address that made this Payment.
  /// If the payer is on this chain, this will be their address with
  /// front-padded zeros.
  bytes32 payer;
  /// The nth count of payable payments on this chain at the point this payment
  /// was received.
  uint256 chainCount;
  /// The Wormhole Chain ID of the chain from which the payment was made.
  uint16 payerChainId;
  /// The nth count of payments to this payable from the payment source
  /// chain at the point this payment was recorded.
  uint256 localChainCount;
  /// The nth count of payments that the payable has received
  /// at the point when this payment was made.
  uint256 payableCount;
  /// When this payment was made.
  uint256 timestamp;
}

/// A user's receipt of a payment made in this chain to a Payable on any
/// blockchain network (this-chain inclusive).
struct UserPayment {
  /// The ID of the Payable to which this Payment was made.
  bytes32 payableId;
  /// The address of the User account that made this Payment.
  address payer;
  /// The Wormhole Chain ID of the chain into which the payment was made.
  uint16 payableChainId;
  /// The nth count of payments on this chain at the point this payment
  /// was made.
  uint256 chainCount;
  /// The nth count of payments that the payer has made
  /// at the point of making this payment.
  uint256 payerCount;
  /// When this payment was made.
  uint256 timestamp;
}

/// A receipt of a withdrawal made by a Host from a Payable.
struct Withdrawal {
  /// The ID of the Payable from which this Withdrawal was made.
  bytes32 payableId;
  /// The address of the User account (payable's owner)
  /// that made this Withdrawal.
  address host;
  /// The nth count of withdrawals on this chain at the point
  /// this withdrawal was made.
  uint256 chainCount;
  /// The nth count of withdrawals that the host has made
  /// at the point of making this withdrawal.
  uint256 hostCount;
  /// The nth count of withdrawals that has been made from
  /// this payable at the point when this withdrawal was made.
  uint256 payableCount;
  /// When this withdrawal was made.
  uint256 timestamp;
}

/// A record of an activity.
enum ActivityType {
  /// A user was initialized.
  InitializedUser,
  /// A payable was created.
  CreatedPayable,
  /// A payment was made by a user.
  UserPaid,
  /// A payment was made to the payable.
  PayableReceived,
  /// A withdrawal was made by a payable.
  Withdrew,
  /// The payable was closed and is no longer accepting payments.
  ClosedPayable,
  /// The payable was reopened and is now accepting payments.
  ReopenedPayable,
  /// The payable's allowed tokens and amounts were updated.
  UpdatedPayableAllowedTokensAndAmounts
}

/// A record of an activity.
struct ActivityRecord {
  /// The nth count of activities on this chain at the point this activity
  /// was recorded.
  uint256 chainCount;
  /// The nth count of activities that the user has made at the point
  /// of this activity.
  uint256 userCount;
  /// The nth count of activities on the related payable at the point
  /// of this activity.
  uint256 payableCount;
  /// The timestamp of when this activity was recorded.
  uint256 timestamp;
  /// The ID of the entity (Payable, Payment, or Withdrawal) that is relevant
  /// to this activity.
  bytes32 entity;
  /// The type of activity.
  ActivityType activityType;
}

/// The type of entity that an ID is associated with. Used as a salt in
/// generating unique IDs for Payables, Payments, Withdrawals, and Activities.
///
/// @dev Using this enum instead of a strings to save gas.
enum EntityType {
  Payable,
  Payment,
  Withdrawal,
  Activity
}

/// Emitted when a payable is created.
struct PayablePayload {
  /// Version of the payload.
  uint8 version;
  /// Type of the payable activity.
  ///
  /// 1 - CreatedPayable
  /// 2 - ClosedPayable
  /// 3 - ReopenedPayable
  /// 4 - UpdatedPayableAllowedTokensAndAmounts
  uint8 actionType;
  /// The Payable's ID.
  bytes32 payableId;
  /// Whether the payable is closed or not.
  bool isClosed;
  /// The allowed tokens and their amounts.
  TokenAndAmountForeign[] allowedTokensAndAmounts;
}

/// Necessary info to record a payable's payment if the involved blockchain
/// networks are different. That is the when a user is on a different chain
/// from the payable.
struct PaymentPayload {
  /// Version of the payload.
  uint8 version;
  /// The Payable's ID.
  bytes32 payableId;
  /// The Wormhole-normalized address of the involved token on the payable
  /// (destination) chain.
  bytes32 payableChainToken;
  /// Wormhole Chain ID of where the Payable was created.
  uint16 payableChainId;
  /// Who made the payment.
  bytes32 payer;
  /// The Wormhole-normalized address of the involved token on the payer
  /// (source) chain.
  bytes32 payerChainToken;
  /// Wormhole Chain ID of where the User made the payment.
  uint16 payerChainId;
  /// The amount paid on for the transaction.
  uint64 amount;
  /// Circle Nonce of the payment.
  uint64 circleNonce;
}

/// A combination of a token address and its amount from another chain.
struct TokenAndAmountForeign {
  /// The address of the associated token.
  bytes32 token;
  /// The amount of the token.
  uint64 amount;
}

/// A Payable that exists on another chain.
struct PayableForeign {
  /// The Wormhole Chain ID of the chain on which this Payable exists.
  uint16 chainId;
  /// The number of the allowedTokensAndAmounts of this Payable.
  uint8 allowedTokensAndAmountsCount;
  /// Whether this payable is currently accepting payments.
  bool isClosed;
}

/// Necessary params for receiving payments from a foreign chain.
struct RedeemCirclePaymentParameters {
  /// The encoded message published to Wormhole from the source chain.
  bytes wormholeEncoded;
  /// Message emitted by circle bridge contract on source chain about token burn
  bytes circleBridgeMessage;
  /// Circle's Serialized EC Signature attesting the cross-chain transfer
  bytes circleAttestation;
}
