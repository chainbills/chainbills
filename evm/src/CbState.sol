// SPDX-License-Identifier: Apache 2
pragma solidity ^0.8.20;

import 'wormhole/interfaces/IWormhole.sol';
import './circle/ICircleBridge.sol';
import './circle/IMessageTransmitter.sol';
import './circle/ITokenMinter.sol';
import './CbErrors.sol';
import './CbStructs.sol';

contract CbState {
  /// Configuration of this chain.
  Config public config;
  /// Counter for activities on this chain.
  ChainStats public chainStats;
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
  /// Wormhole Chain IDs against their corresponding Emitter
  /// Contract Addresses on those chains, that is, trusted caller contracts.
  mapping(uint16 => bytes32) public registeredForeignContracts;
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
  /// The amount and token that the payers paid
  mapping(bytes32 => TokenAndAmount) public userPaymentDetails;
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
  mapping(bytes32 => TokenAndAmountForeign[]) public
    foreignPayableAllowedTokensAndAmounts;
  /// Payments to Payables, from all chains, by their IDs. The Payment IDs
  /// will be the same as the IDs of userPayments if the payment was made
  /// by a User on this chain. Otherwise, the payment ID will be different.
  mapping(bytes32 => PayablePayment) public payablePayments;
  /// The amount and token that payers paid to Payables
  mapping(bytes32 => TokenAndAmount) public payablePaymentDetails;
  /// IDs of Payments to Payables, from all chains.
  mapping(bytes32 => bytes32[]) public payablePaymentIds;
  /// Total Number of payments made to this payable, from each chain by
  /// their Wormhole Chain IDs.
  mapping(bytes32 => mapping(uint16 => uint256)) public
    payableChainPaymentsCount;
  /// Payment IDs of payments made to this payable, from each chain by
  /// their Wormhole Chain IDs.
  mapping(bytes32 => mapping(uint16 => bytes32[])) public payableChainPaymentIds;
  /// Array of IDs of Activities of payables.
  mapping(bytes32 => bytes32[]) public payableActivityIds;
  /// Withdrawals on this chain by their IDs
  mapping(bytes32 => Withdrawal) public withdrawals;
  /// Array of IDs of Withdrawals made by users.
  mapping(address => bytes32[]) public userWithdrawalIds;
  /// Array of IDs of Withdrawals made in a payable.
  mapping(bytes32 => bytes32[]) public payableWithdrawalIds;
  /// The amount and token that a host withdrew
  mapping(bytes32 => TokenAndAmount) public withdrawalDetails;
  /// Tells the token address to be used for a foreign payable's payment.
  mapping(uint16 => mapping(bytes32 => address)) public
    forForeignChainMatchingTokenAddresses;
  /// Tells the foreign chain token address for a given token and chain ID.
  mapping(address => mapping(uint16 => bytes32)) public
    forTokenAddressMatchingForeignChainTokens;
  /// Wormhole Chain ID to Circle Chain Domain Mapping
  mapping(uint16 => uint32) chainIdToCircleDomain;
  /// Circle Chain Domain to Wormhole Chain ID mapping
  mapping(uint32 => uint16) circleDomainToChainId;
  /// Whether a Wormhole message has been consumed.
  mapping(bytes32 => bool) hasConsumedWormholeMessage;
  /// Array of Consumed Wormhole messages by their Chain IDs.
  mapping(uint16 => bytes32[]) public perChainConsumedWormholeMessages;
  /// Counts for consumed Wormhole messages by their Chain IDs.
  mapping(uint16 => uint256) public perChainConsumedWormholeMessagesCount;
  /// Address of Payables Logic Contract
  address public payablesLogic;
  /// Address of Transactions Logic Contract
  address public transactionsLogic;
  /// storage gap for additional state variables in future versions
  uint256[50] __gap;

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

  function getPayable(bytes32 payableId) external view returns (Payable memory) {
    if (payableId == bytes32(0)) revert InvalidPayableId();
    if (payables[payableId].host == address(0)) revert InvalidPayableId();
    return payables[payableId];
  }

  function getAllowedTokensAndAmounts(bytes32 payableId)
    external
    view
    returns (TokenAndAmount[] memory)
  {
    if (payableId == bytes32(0)) revert InvalidPayableId();
    if (payables[payableId].host == address(0)) revert InvalidPayableId();
    return payableAllowedTokensAndAmounts[payableId];
  }

  function getBalances(bytes32 payableId)
    external
    view
    returns (TokenAndAmount[] memory)
  {
    if (payableId == bytes32(0)) revert InvalidPayableId();
    if (payables[payableId].host == address(0)) revert InvalidPayableId();
    return payableBalances[payableId];
  }

  function getForeignPayableAllowedTokensAndAmounts(bytes32 payableId)
    external
    view
    returns (TokenAndAmountForeign[] memory)
  {
    if (payableId == bytes32(0)) revert InvalidPayableId();
    if (foreignPayables[payableId].chainId == 0) {
      revert InvalidPayableId();
    }
    return foreignPayableAllowedTokensAndAmounts[payableId];
  }

  function getUserPaymentDetails(bytes32 paymentId)
    external
    view
    returns (TokenAndAmount memory)
  {
    if (paymentId == bytes32(0)) revert InvalidPaymentId();
    if (userPayments[paymentId].payer == address(0)) revert InvalidPaymentId();
    return userPaymentDetails[paymentId];
  }

  function getPayablePaymentDetails(bytes32 paymentId)
    external
    view
    returns (TokenAndAmount memory)
  {
    if (paymentId == bytes32(0)) revert InvalidPaymentId();
    if (payablePayments[paymentId].payableId == bytes32(0)) {
      revert InvalidPaymentId();
    }
    return payablePaymentDetails[paymentId];
  }

  function getWithdrawalDetails(bytes32 withdrawalId)
    external
    view
    returns (TokenAndAmount memory)
  {
    if (withdrawalId == bytes32(0)) revert InvalidWithdrawalId();
    if (withdrawals[withdrawalId].host == address(0)) {
      revert InvalidWithdrawalId();
    }
    return withdrawalDetails[withdrawalId];
  }

  function getPayableChainPaymentsCount(bytes32 payableId, uint16 chainId_)
    external
    view
    returns (uint256)
  {
    if (payableId == bytes32(0)) revert InvalidPayableId();
    if (payables[payableId].host == address(0)) revert InvalidPayableId();
    return payableChainPaymentsCount[payableId][chainId_];
  }

  function getPayableChainPaymentIds(bytes32 payableId, uint16 chainId_)
    external
    view
    returns (bytes32[] memory)
  {
    if (payableId == bytes32(0)) revert InvalidPayableId();
    if (payables[payableId].host == address(0)) revert InvalidPayableId();
    return payableChainPaymentIds[payableId][chainId_];
  }

  function getForForeignChainMatchingTokenAddress(
    uint16 chainId,
    bytes32 foreignToken
  ) external view returns (address token) {
    token = forForeignChainMatchingTokenAddresses[chainId][foreignToken];
    if (token == address(0)) revert InvalidChainIdOrForeignToken();
  }

  function getForTokenAddressMatchingForeignChainToken(
    address token,
    uint16 chainId
  ) external view returns (bytes32 foreignToken) {
    foreignToken = forTokenAddressMatchingForeignChainTokens[token][chainId];
    if (foreignToken == bytes32(0)) revert InvalidChainIdOrForeignToken();
  }
}
