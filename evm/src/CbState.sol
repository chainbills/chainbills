// SPDX-License-Identifier: Apache 2
pragma solidity ^0.8.30;

import 'wormhole/interfaces/IWormhole.sol';
import './circle/ICircleBridge.sol';
import './circle/IMessageTransmitter.sol';
import './circle/ITokenMinter.sol';
import './CbStructs.sol';

contract CbState is CbStructs {
  /// Configuration of this chain.
  Config public config;
  /// Counter for activities on this chain.
  ChainStats public chainStats;
  /// Role identifier for addresses authorized to sync foreign payables.
  bytes32 public constant ADMIN_ROLE = keccak256('ADMIN_ROLE');
  /// Array of Wallet Addresses of Users on this chain.
  address[] public chainUserAddresses;
  /// Array of Payable IDs on this chain.
  bytes32[] public chainPayableIds;
  /// Array of foreign Payable IDs on this chain.
  bytes32[] public chainForeignPayableIds;
  /// Array of User Payment IDs on this chain.
  bytes32[] public chainUserPaymentIds;
  /// Array of Payable Payment IDs on this chain.
  bytes32[] public chainPayablePaymentIds;
  /// Array of Withdrawal IDs on this chain.
  bytes32[] public chainWithdrawalIds;
  /// Array of IDs of Activities on this chain.
  bytes32[] public chainActivityIds;
  /// Array of Consumed Wormhole messages.
  bytes32[] public consumedWormholeMessages;
  /// CAIP-2 cbChainIds against their corresponding Emitter Contract Addresses
  /// on those chains, that is, trusted caller contracts.
  mapping(bytes32 => bytes32) public registeredForeignContracts;
  /// Details of Supported Tokens on this chain.
  mapping(address => TokenDetails) public tokenDetails;
  /// Activities on this chain.
  mapping(bytes32 => ActivityRecord) public activities;
  /// User accounts on this chain.
  mapping(address => User) public users;
  /// Array of IDs of Payable created by users.
  mapping(address => bytes32[]) public userPayableIds;
  /// Array of IDs of Payment made by users.
  mapping(address => bytes32[]) public userPaymentIds;
  /// Payments on this chain by their IDs by users.
  mapping(bytes32 => UserPayment) public userPayments;
  /// Array of IDs of Activities made by users.
  mapping(address => bytes32[]) public userActivityIds;
  /// Payables on this chain by their IDs
  mapping(bytes32 => Payable) public payables;
  /// The allowed tokens (and their amounts) on payables.
  mapping(bytes32 => TokenAndAmount[]) public payableAllowedTokensAndAmounts;
  /// Records of how much is in payables.
  mapping(bytes32 => TokenAndAmount[]) public payableBalances;
  /// Payables that exist on other chains.
  mapping(bytes32 => PayableForeign) public foreignPayables;
  /// Allowed tokens and amounts of foreign payables.
  mapping(bytes32 => TokenAndAmountForeign[]) public foreignPayableAllowedTokensAndAmounts;
  /// Payments to Payables, from all chains, by their IDs. The Payment IDs
  /// will be the same as the IDs of userPayments if the payment was made
  /// by a User on this chain. Otherwise, the payment ID will be different.
  mapping(bytes32 => PayablePayment) public payablePayments;
  /// IDs of Payments to Payables, from all chains.
  mapping(bytes32 => bytes32[]) public payablePaymentIds;
  /// Total Number of payments made to this payable, from each chain by
  /// their CAIP-2 cbChainIds, indexed by config.cbChainId if in this chain.
  mapping(bytes32 => mapping(bytes32 => uint256)) public payableChainPaymentsCount;
  /// Payment IDs of payments made to this payable, from each chain by
  /// their CAIP-2 cbChainIds, indexed by config.cbChainId if in this chain.
  mapping(bytes32 => mapping(bytes32 => bytes32[])) public payableChainPaymentIds;
  /// Array of IDs of Activities of payables.
  mapping(bytes32 => bytes32[]) public payableActivityIds;
  /// Withdrawals on this chain by their IDs
  mapping(bytes32 => Withdrawal) public withdrawals;
  /// Array of IDs of Withdrawals made by users.
  mapping(address => bytes32[]) public userWithdrawalIds;
  /// Array of IDs of Withdrawals made in a payable.
  mapping(bytes32 => bytes32[]) public payableWithdrawalIds;
  /// Tells the token address to be used for a foreign payable's payment.
  mapping(bytes32 => mapping(bytes32 => address)) public forForeignChainMatchingTokenAddresses;
  /// Tells the foreign chain token address for a given token and cbChainId.
  mapping(address => mapping(bytes32 => bytes32)) public forTokenAddressMatchingForeignChainTokens;
  /// CAIP-2 cbChainId to Circle Chain Domain Mapping
  mapping(bytes32 => uint32) public cbChainIdToCircleDomain;
  /// Circle Chain Domain to CAIP-2 cbChainId mapping
  mapping(uint32 => bytes32) public circleDomainToCbChainId;
  /// Whether a Wormhole message has been consumed.
  mapping(bytes32 => bool) hasConsumedWormholeMessage;
  /// Array of Consumed Wormhole messages by their Wormhole Chain IDs.
  mapping(uint16 => bytes32[]) public perChainConsumedWormholeMessages;
  /// Counts for consumed Wormhole messages by their Wormhole Chain IDs.
  mapping(uint16 => uint256) public perChainConsumedWormholeMessagesCount;
  /// Address of Payables Logic Contract
  address public payablesLogic;
  /// Address of Transactions Logic Contract
  address public transactionsLogic;
  /// Data messaging protocol configured per foreign CAIP-2 cbChainId.
  /// Determines whether payable update broadcasts use Wormhole or CCTP.
  mapping(bytes32 => DataMessagingProtocol) public chainDataMessagingProtocol;
  /// Tracks the highest nonce seen per (payableId, cbChainId).
  /// Used to deduplicate payable updates delivered by multiple protocols
  /// (Wormhole and CCTP). Only nonces strictly greater than the stored value
  /// are accepted; stale or duplicate deliveries revert.
  mapping(bytes32 => mapping(bytes32 => uint64)) public payableUpdateNonces;
  /// Ordered list of registered foreign CAIP-2 cbChainIds.
  /// Iterated in _broadcastPayableUpdate to send CCTP messages to CCTP-capable
  /// chains. Populated by registerForeignContract.
  bytes32[] public registeredCbChainIds;
  /// Monotonically increasing counter for generating payable update nonces.
  /// Incremented on every _broadcastPayableUpdate call. Internal only.
  uint64 internal _payableUpdateCounter;
  /// Wormhole Chain ID to CAIP-2 cbChainId reverse lookup.
  /// Set by registerChainWormholeId. Used in VAA verification to resolve the
  /// emitter chain to its cbChainId for registeredForeignContracts lookup.
  mapping(uint16 => bytes32) public wormholeChainIdToCbChainId;
  /// storage gap for additional state variables in future versions
  uint256[50] __gap;

  function hasWormhole() public view returns (bool) {
    return config.wormhole != address(0);
  }

  function hasCCTP() public view returns (bool) {
    return config.circleTransmitter != address(0);
  }

  function supportsWormhole(bytes32 cbChainId) public view returns (bool) {
    return chainDataMessagingProtocol[cbChainId] == DataMessagingProtocol.WORMHOLE;
  }

  function supportsCCTP(bytes32 cbChainId) public view returns (bool) {
    return chainDataMessagingProtocol[cbChainId] == DataMessagingProtocol.CCTP;
  }

  function wormhole() public view returns (IWormhole) {
    return IWormhole(config.wormhole);
  }

  function circleBridge() public view returns (ICircleBridge) {
    return ICircleBridge(config.circleBridge);
  }

  function circleTransmitter() public view returns (IMessageTransmitter) {
    return IMessageTransmitter(config.circleTransmitter);
  }

  function circleTokenMinter() public view returns (ITokenMinter) {
    return ITokenMinter(config.circleTokenMinter);
  }
}
