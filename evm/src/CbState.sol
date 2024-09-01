// SPDX-License-Identifier: Apache 2
pragma solidity ^0.8.20;

contract CbState {
  error InvalidChainId();
  error InvalidPayableId();
  error InvalidPageNumber();

  /// The maximum number of tokens a payable can hold balances in.
  /// Also the maximum number of tokens that a payable can specify
  /// that it can accept payments in.
  uint256 public constant MAX_PAYABLES_TOKENS = 10;

  /// The address that receives withdrawal fees.
  address public feeCollector;
  /// The address of the Wormhole Core Contract on this chain.
  address public wormhole;
  /// Wormhole Chain ID of this contract.
  uint16 public chainId;
  /// The number of block confirmations needed before the wormhole network
  /// will attest a message.
  uint8 public wormholeFinality;
  /// Counter for activities on this chain.
  ChainStats public chainStats;
  /// Wormhole Chain IDs against their corresponding Emitter
  /// Contract Addresses on those chains, that is, trusted caller contracts.
  mapping(uint16 => bytes32) public registeredEmitters;
  /// Maximum Fees per token withdrawals.
  mapping(address => uint256) public maxFeesPerToken;
  /// User accounts on this chain.
  mapping(address => User) public users;
  /// Array of IDs of Payable created by users.
  mapping(address => bytes32[]) public userPayableIds;
  /// Array of IDs of Payment made by users.
  mapping(address => bytes32[]) public userPaymentIds;
  /// Payments on this chain by their IDs by users.
  mapping(bytes32 => UserPayment) public userPayments;
  /// Payables on this chain by their IDs
  mapping(bytes32 => Payable) public payables;
  /// Payments to Payables, from all chains, by their IDs. The Payment IDs
  /// will be the same as the IDs of userPayments if the payment was made
  /// by a User on this chain. Otherwise, the payment ID will be different.
  mapping(bytes32 => PayablePayment) public payablePayments;
  /// IDs of Payments to Payables, from all chains.
  mapping(bytes32 => bytes32[]) public payablePaymentIds;
  /// Total Number of payments made to this payable, from each chain by
  /// their Wormhole Chain IDs.
  mapping(bytes32 => mapping(uint16 => uint256))
    public payableChainPaymentsCount;
  /// Payment IDs of payments made to this payable, from each chain by
  /// their Wormhole Chain IDs.
  mapping(bytes32 => mapping(uint16 => bytes32[]))
    public payableChainPaymentIds;
  /// Withdrawals on this chain by their IDs
  mapping(bytes32 => Withdrawal) public withdrawals;
  /// Array of IDs of Withdrawals made by users.
  mapping(address => bytes32[]) public userWithdrawalIds;
  /// Array of IDs of Withdrawals made in a payable.
  mapping(bytes32 => bytes32[]) public payableWithdrawalIds;

  /// Keeps track of all activities on this chain. Counters for the
  /// users, payables, userPayments, and withdrawals mappings.
  struct ChainStats {
    /// Total number of users that have ever interacted on this chain.
    uint256 usersCount;
    /// Total number of payables that have ever been created on this chain.
    uint256 payablesCount;
    /// Total number of payments that have ever been made on this chain.
    uint256 paymentsCount;
    /// Total number of withdrawals that have ever been made on this chain.
    uint256 withdrawalsCount;
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
    /// Whether this payable is currently accepting payments.
    bool isClosed;
    /// The allowed tokens (and their amounts) on this payable.
    TokenAndAmount[] allowedTokensAndAmounts;
    /// Records of how much is in this payable.
    TokenAndAmount[] balances;
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
    /// The Wormhole Chain ID of the chain from which the payment was made.
    uint16 payerChainId;
    /// The nth count of payments to this payable from the payment source
    /// chain at the point this payment was recorded.
    uint256 localChainCount;
    /// The nth count of payments that the payable has received
    /// at the point when this payment was made.
    uint256 payableCount;
    /// The nth count of payments that the payer has made
    /// at the point this payment was recorded.
    uint256 payerCount;
    /// When this payment was made.
    uint256 timestamp;
    /// The amount and token that the payer paid
    TokenAndAmount details;
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
    /// The nth count of payments that the payable has received
    /// at the point when this payment was made.
    uint256 payableCount;
    /// When this payment was made.
    uint256 timestamp;
    /// The amount and token that the payer paid
    TokenAndAmount details;
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
    /// The amount and token that the host withdrew
    TokenAndAmount details;
  }

  function getPayableChainPaymentsCount(
    bytes32 payableId,
    uint16 chainId_
  ) external view returns (uint256) {
    if (payableId == bytes32(0)) revert InvalidPayableId();
    if (payables[payableId].host == address(0)) revert InvalidPayableId();
    return payableChainPaymentsCount[payableId][chainId_];
  }
}
