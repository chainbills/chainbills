// SPDX-License-Identifier: Apache 2
pragma solidity ^0.8.30;

import {IERC20} from '@openzeppelin/contracts/token/ERC20/IERC20.sol';
import {SafeERC20} from '@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol';
import {AccessControlUpgradeable} from '@openzeppelin/contracts-upgradeable/access/AccessControlUpgradeable.sol';
import {OwnableUpgradeable} from '@openzeppelin/contracts-upgradeable/access/OwnableUpgradeable.sol';
import {Initializable} from '@openzeppelin/contracts-upgradeable/proxy/utils/Initializable.sol';
import {ReentrancyGuardUpgradeable} from '@openzeppelin/contracts-upgradeable/utils/ReentrancyGuardUpgradeable.sol';
import {PausableUpgradeable} from '@openzeppelin/contracts-upgradeable/utils/PausableUpgradeable.sol';
import {UUPSUpgradeable} from '@openzeppelin/contracts-upgradeable/proxy/utils/UUPSUpgradeable.sol';
import {toWormholeFormat} from 'wormhole/Utils.sol';
import {ICircleBridge} from './circle/ICircleBridge.sol';
import {IMessageTransmitter} from './circle/IMessageTransmitter.sol';
import {ITokenMinter} from './circle/ITokenMinter.sol';
import {CbUtils} from './CbUtils.sol';

/// A Cross-Chain Payment Gateway.
/// @custom:oz-upgrades-unsafe-allow delegatecall
contract Chainbills is
  CbUtils,
  Initializable,
  OwnableUpgradeable,
  AccessControlUpgradeable,
  ReentrancyGuardUpgradeable,
  PausableUpgradeable,
  UUPSUpgradeable
{
  using SafeERC20 for IERC20;

  /// @custom:oz-upgrades-unsafe-allow constructor
  constructor() {
    _disableInitializers();
  }

  /// Sets up this smart contract when it is deployed.
  /// @param feeCollector The address that will collect withdrawal fees.
  /// @param feePercent The percentage of withdrawals to collect as fees.
  /// The percentage should account for 2 decimal places. That is, 200 means 2%.
  function initialize(address feeCollector, uint16 feePercent) public initializer {
    if (feeCollector == address(0)) revert InvalidFeeCollector();
    config.feeCollector = feeCollector;
    config.withdrawalFeePercentage = feePercent;

    emit SetFeeCollectorAddress(feeCollector);
    emit SetWithdrawalFeePercentage(feePercent);

    __Ownable_init(msg.sender);
    __AccessControl_init();
    __ReentrancyGuard_init();
    __Pausable_init();
    __UUPSUpgradeable_init();

    _grantRole(DEFAULT_ADMIN_ROLE, owner());
    _grantRole(ADMIN_ROLE, owner());
  }

  function _authorizeUpgrade(address newImpl) internal override onlyOwner {}

  /// Pauses contract operations to prevent new interactions
  function pause() external onlyOwner nonReentrant whenNotPaused {
    _pause();
  }

  /// Unpauses contract operations to resume normal functionality
  function unpause() external onlyOwner nonReentrant whenPaused {
    _unpause();
  }

  /// Grants admin role for syncing foreign payables and other admin operations
  /// @param admin Address to receive admin privileges
  function grantAdminRole(address admin) external onlyOwner {
    if (admin == address(0)) revert InvalidWalletAddress();
    _grantRole(ADMIN_ROLE, admin);
  }

  /// Revokes admin role from an address
  /// @param admin Address to remove admin privileges from
  function revokeAdminRole(address admin) external onlyOwner {
    if (admin == address(0)) revert InvalidWalletAddress();
    _revokeRole(ADMIN_ROLE, admin);
  }

  /// Sets up Wormhole and Circle Bridge contracts.
  /// @param wormhole The address of the Wormhole contract.
  /// @param circleBridge The address of the Circle Bridge contract.
  /// @param wormholeChainId The Wormhole Chain ID of the chain.
  /// @param wormholeFinality Confirmed/Finalized for Wormhole messages.
  /// @param cbChainId CAIP-2 chain identifier for this chain
  ///        (keccak256 of "namespace:reference", e.g. keccak256("eip155:1")).
  /// @dev Only the deployer (owner) can invoke this method
  function setupWormholeAndCircle(
    address wormhole,
    address circleBridge,
    uint16 wormholeChainId,
    uint8 wormholeFinality,
    bytes32 cbChainId
  ) public onlyOwner {
    if (wormhole == address(0)) revert InvalidWormholeAddress();
    else if (wormholeChainId == 0) revert InvalidWormholeChainId();
    else if (wormholeFinality == 0) revert InvalidWormholeFinality();
    else if (circleBridge == address(0)) revert InvalidCircleBridge();
    else if (cbChainId == bytes32(0)) revert InvalidChainId();

    IMessageTransmitter circleTransmitter = ICircleBridge(circleBridge).localMessageTransmitter();
    uint32 circleDomain = circleTransmitter.localDomain();
    ITokenMinter circleTokenMinter = ICircleBridge(circleBridge).localMinter();

    config.wormholeFinality = wormholeFinality;
    config.wormholeChainId = wormholeChainId;
    config.circleDomain = circleDomain;
    config.wormhole = wormhole;
    config.circleBridge = circleBridge;
    config.circleTransmitter = address(circleTransmitter);
    config.circleTokenMinter = address(circleTokenMinter);
    config.cbChainId = cbChainId;

    // Emit event.
    emit SetupWormholeAndCircle();
  }

  /// Sets up Circle CCTP on chains where Wormhole is not deployed.
  /// Allows this contract to send and receive payable-update messages via CCTP
  /// without requiring Wormhole.
  /// @param circleTransmitterAddr Address of Circle's MessageTransmitter on this chain.
  /// @param circleDomain Circle domain ID of this chain.
  /// @param cbChainId CAIP-2 chain identifier for this chain
  ///        (keccak256 of "namespace:reference", e.g. keccak256("eip155:8453")).
  /// @dev Only the deployer (owner) can invoke this method.
  function setupCctpOnly(address circleTransmitterAddr, uint32 circleDomain, bytes32 cbChainId) public onlyOwner {
    if (circleTransmitterAddr == address(0)) revert InvalidCircleTransmitter();
    if (circleDomain == 0) revert InvalidLocalCircleDomain();
    if (cbChainId == bytes32(0)) revert InvalidChainId();
    config.circleTransmitter = circleTransmitterAddr;
    config.circleDomain = circleDomain;
    config.cbChainId = cbChainId;
    emit SetupCCTPOnly();
  }

  /// Configures the data messaging protocol for a registered foreign chain.
  /// This determines how payable updates are broadcast to that chain.
  ///
  /// Protocol values:
  ///   0 = NONE     — no cross-chain data messaging (chain skipped in broadcast)
  ///   1 = WORMHOLE — Wormhole VAA covers this chain; no CCTP needed
  ///   2 = CCTP     — no Wormhole; CCTP message sent per broadcast
  ///
  /// @param cbChainId CAIP-2 cbChainId of the foreign chain.
  /// @param protocol DataMessagingProtocol enum value (0–2).
  /// @dev Only the deployer (owner) can invoke this method.
  function setChainDataMessagingProtocol(bytes32 cbChainId, uint8 protocol) public onlyOwner {
    if (cbChainId == bytes32(0)) revert InvalidChainId();
    if (protocol > 2) revert InvalidChainId();
    chainDataMessagingProtocol[cbChainId] = DataMessagingProtocol(protocol);
    emit SetChainDataMessagingProtocol(cbChainId, protocol);
  }

  /// Withdraws the specified `amount` of `token` to the {owner}.
  /// If token is the same as this deployed contract's address, the
  /// native token is transferred.
  function ownerWithdraw(address token, uint256 amount) public onlyOwner nonReentrant {
    require(amount > 0);
    require(token != address(0));
    if (token == address(this)) {
      (payable(owner()).call{value: amount}(''));
    } else {
      IERC20(token).safeTransfer(owner(), amount);
    }
    emit OwnerWithdrew(token, amount);
  }

  /// Registers the Circle Domain for a foreign chain.
  /// @dev Only the deployer (owner) can invoke this method
  /// @param cbChainId CAIP-2 cbChainId of the foreign chain.
  /// @param circleDomain The Circle Domain of that chain.
  function registerChainCircleDomain(bytes32 cbChainId, uint32 circleDomain) public onlyOwner {
    if (cbChainId == bytes32(0) || circleDomain == 0) revert InvalidChainId();
    cbChainIdToCircleDomain[cbChainId] = circleDomain;
    circleDomainToCbChainId[circleDomain] = cbChainId;
    emit RegisteredChainCircleDomain(cbChainId, circleDomain);
  }

  /// Registers the Wormhole Chain ID for a foreign chain.
  /// Required for Wormhole VAA emitter verification: when a VAA arrives,
  /// the emitterChainId (uint16) is resolved to a cbChainId via this mapping.
  /// @dev Only the deployer (owner) can invoke this method
  /// @param cbChainId CAIP-2 cbChainId of the foreign chain.
  /// @param wormholeChainId Wormhole Chain ID of that chain.
  function registerChainWormholeId(bytes32 cbChainId, uint16 wormholeChainId) public onlyOwner {
    if (cbChainId == bytes32(0) || wormholeChainId == 0) revert InvalidChainId();
    wormholeChainIdToCbChainId[wormholeChainId] = cbChainId;
    emit RegisteredChainWormholeId(cbChainId, wormholeChainId);
  }

  /// Registers foreign emitters (trusted contracts).
  /// @dev Only the deployer (owner) can invoke this method
  /// @param cbChainId CAIP-2 cbChainId of the chain being registered.
  /// @param emitterAddress Wormhole-normalized address of the contract being
  /// registered. For EVM, contracts' first 12 bytes should be zeros.
  function registerForeignContract(bytes32 cbChainId, bytes32 emitterAddress) public onlyOwner {
    if (cbChainId == bytes32(0) || cbChainId == config.cbChainId) {
      revert InvalidChainId();
    } else if (emitterAddress == bytes32(0) || emitterAddress == toWormholeFormat(address(this))) {
      revert InvalidWormholeEmitterAddress();
    }
    // Track cbChainId for CCTP iteration in _broadcastPayableUpdate.
    // Only push if this is a genuinely new registration (not an update).
    if (registeredForeignContracts[cbChainId] == bytes32(0)) {
      registeredCbChainIds.push(cbChainId);
    }
    registeredForeignContracts[cbChainId] = emitterAddress;
    emit RegisteredForeignContract(cbChainId, emitterAddress);
  }

  /// Registers a matching token address for a foreign token.
  /// @dev Only the deployer (owner) can invoke this method
  /// @param cbChainId CAIP-2 cbChainId of the foreign chain.
  /// @param foreignToken The address of the token in the foreign chain.
  /// @param token The address of corresponding token in this chain.
  function registerMatchingTokenForForeignChain(bytes32 cbChainId, bytes32 foreignToken, address token)
    public
    onlyOwner
  {
    if (cbChainId == bytes32(0) || cbChainId == config.cbChainId) {
      revert InvalidChainId();
    } else if (token == address(0) || foreignToken == bytes32(0)) {
      revert InvalidTokenAddress();
    }
    forForeignChainMatchingTokenAddresses[cbChainId][foreignToken] = token;
    forTokenAddressMatchingForeignChainTokens[token][cbChainId] = foreignToken;
    emit RegisteredMatchingTokenForForeignChain(cbChainId, foreignToken, token);
  }

  /// Sets the Payables Logic Contract address.
  /// @dev Only the deployer (owner) can invoke this method
  /// @param payablesLogicAddress The address of the Payables Logic Contract.
  function setPayablesLogic(address payablesLogicAddress) public onlyOwner {
    if (payablesLogicAddress == address(0)) revert InvalidPayablesLogic();
    payablesLogic = payablesLogicAddress;
    emit SetPayablesLogic(payablesLogicAddress);
  }

  /// Sets the Transactions Logic Contract address.
  /// @dev Only the deployer (owner) can invoke this method
  /// @param transactionsLogicAddress The address of the Transactions Logic Contract.
  function setTransactionsLogic(address transactionsLogicAddress) public onlyOwner {
    if (transactionsLogicAddress == address(0)) {
      revert InvalidTransactionsLogic();
    }
    transactionsLogic = transactionsLogicAddress;
    emit SetTransactionsLogic(transactionsLogicAddress);
  }

  /// Updates the maximum withdrawal fees for the given token.
  /// @dev Only the deployer (owner) can invoke this method
  /// @param token The address of the token to update its max fees
  /// @param maxWithdrawalFees The maximum cap of fees during withdrawal
  function updateMaxWithdrawalFees(address token, uint256 maxWithdrawalFees) public onlyOwner {
    if (token == address(0)) revert InvalidTokenAddress();
    tokenDetails[token].token = token;
    tokenDetails[token].maxWithdrawalFees = maxWithdrawalFees;
    emit UpdatedMaxWithdrawalFees(token, maxWithdrawalFees);
  }

  /// Allows payments in a given token.
  /// @dev Only the deployer (owner) can invoke this method
  /// @param token The address of the token to support for payments
  function allowPaymentsForToken(address token) public onlyOwner {
    if (token == address(0)) revert InvalidTokenAddress();
    tokenDetails[token].token = token;
    tokenDetails[token].isSupported = true;
    emit AllowedPaymentsForToken(token);
  }

  /// Stops payments in a given token.
  /// @dev Only the deployer (owner) can invoke this method
  /// @param token The address of the token to stop supporting
  function stopPaymentsForToken(address token) public onlyOwner {
    if (token == address(0)) revert InvalidTokenAddress();
    tokenDetails[token].isSupported = false;
    emit StoppedPaymentsForToken(token);
  }

  /// Sets the withdrawal fee percentage to the provided input.
  /// @param feePercent The percentage with 2 decimals. 200 means 2%.
  /// @dev Only the deployer (owner) can invoke this method.
  function setWithdrawalFeePercentage(uint16 feePercent) public onlyOwner {
    config.withdrawalFeePercentage = feePercent;
    emit SetWithdrawalFeePercentage(feePercent);
  }

  /// Sets the wallet address for collecting fees.
  /// @param feeCollector The wallet address to collect fees.
  /// @dev Only the deployer (owner) can invoke this method.
  function setFeeCollectorAddress(address feeCollector) public onlyOwner {
    config.feeCollector = feeCollector;
    emit SetFeeCollectorAddress(feeCollector);
  }

  function createPayable(
    TokenAndAmount[] calldata,
    /* allowedTokensAndAmounts */
    bool /* isAutoWithdraw */
  )
    public
    payable
    nonReentrant
    whenNotPaused
    returns (bytes32 payableId, uint64 wormholeMessageSequence)
  {
    (bool success, bytes memory result) = payablesLogic.delegatecall(msg.data);
    if (!success) {
      assembly {
        revert(add(result, 32), mload(result))
      }
    } else {
      return abi.decode(result, (bytes32, uint64));
    }
  }

  function closePayable(
    bytes32 /* payableId */
  )
    public
    payable
    nonReentrant
    whenNotPaused
    returns (uint64 wormholeMessageSequence)
  {
    (bool success, bytes memory result) = payablesLogic.delegatecall(msg.data);
    if (!success) {
      assembly {
        revert(add(result, 32), mload(result))
      }
    } else {
      return abi.decode(result, (uint64));
    }
  }

  function reopenPayable(
    bytes32 /* payableId */
  )
    public
    payable
    nonReentrant
    whenNotPaused
    returns (uint64 wormholeMessageSequence)
  {
    (bool success, bytes memory result) = payablesLogic.delegatecall(msg.data);
    if (!success) {
      assembly {
        revert(add(result, 32), mload(result))
      }
    } else {
      return abi.decode(result, (uint64));
    }
  }

  function updatePayableAllowedTokensAndAmounts(
    bytes32, /* payableId */
    TokenAndAmount[] calldata /* allowedTokensAndAmounts */
  )
    public
    payable
    nonReentrant
    whenNotPaused
    returns (uint64 wormholeMessageSequence)
  {
    (bool success, bytes memory result) = payablesLogic.delegatecall(msg.data);
    if (!success) {
      assembly {
        revert(add(result, 32), mload(result))
      }
    } else {
      return abi.decode(result, (uint64));
    }
  }

  function updatePayableAutoWithdraw(
    bytes32,
    /* payableId */
    bool /* isAutoWithdraw */
  )
    public
    nonReentrant
    whenNotPaused
  {
    (bool success, bytes memory result) = payablesLogic.delegatecall(msg.data);
    if (!success) {
      assembly {
        revert(add(result, 32), mload(result))
      }
    }
  }

  function publishPayableDetails(
    bytes32 /* payableId */
  )
    public
    payable
    nonReentrant
    returns (uint64 wormholeMessageSequence)
  {
    (bool success, bytes memory result) = payablesLogic.delegatecall(msg.data);
    if (!success) {
      assembly {
        revert(add(result, 32), mload(result))
      }
    } else {
      return abi.decode(result, (uint64));
    }
  }

  function receivePayableUpdateViaWormhole(
    bytes memory /* wormholeEncoded */
  )
    public
    nonReentrant
    whenNotPaused
  {
    (bool success, bytes memory result) = payablesLogic.delegatecall(msg.data);
    if (!success) {
      assembly {
        revert(add(result, 32), mload(result))
      }
    }
  }

  function receivePayableUpdateViaCircle(
    bytes calldata,
    /* message */
    bytes calldata /* attestation */
  )
    public
    nonReentrant
    whenNotPaused
  {
    (bool success, bytes memory result) = payablesLogic.delegatecall(msg.data);
    if (!success) {
      assembly {
        revert(add(result, 32), mload(result))
      }
    }
  }

  /// Circle CCTP IMessageHandler callback. Called by Circle's MessageTransmitter
  /// after verifying the attestation when a payable-update message arrives from
  /// another chain. Delegates to CbPayables for nonce dedup and state updates.
  function handleReceiveMessage(
    uint32,
    /* sourceDomain */
    bytes32,
    /* sender */
    bytes calldata /* messageBody */
  )
    external
    nonReentrant
    whenNotPaused
    returns (bool)
  {
    (bool success, bytes memory result) = payablesLogic.delegatecall(msg.data);
    if (!success) {
      assembly {
        revert(add(result, 32), mload(result))
      }
    }
    return abi.decode(result, (bool));
  }

  function adminSyncForeignPayable(
    bytes32, /* payableId */
    bytes32, /* cbChainId */
    uint64, /* nonce */
    uint8, /* actionType */
    bool, /* isClosed */
    TokenAndAmountForeign[] calldata /* ataa */
  )
    public
    onlyRole(ADMIN_ROLE)
    nonReentrant
    whenNotPaused
  {
    (bool success, bytes memory result) = payablesLogic.delegatecall(msg.data);
    if (!success) {
      assembly {
        revert(add(result, 32), mload(result))
      }
    }
  }

  function pay(
    bytes32,
    /* payableId */
    address,
    /* token */
    uint256 /* amount */
  )
    public
    payable
    nonReentrant
    whenNotPaused
    returns (bytes32 userPaymentId, bytes32 payablePaymentId)
  {
    (bool success, bytes memory result) = transactionsLogic.delegatecall(msg.data);
    if (!success) {
      assembly {
        revert(add(result, 32), mload(result))
      }
    } else {
      return abi.decode(result, (bytes32, bytes32));
    }
  }

  function payForeignWithCircle(
    bytes32,
    /* payableId */
    address,
    /* token */
    uint256 /* amount */
  )
    public
    payable
    nonReentrant
    whenNotPaused
    returns (bytes32 userPaymentId, uint64 wormholeMessageSequence)
  {
    (bool success, bytes memory result) = transactionsLogic.delegatecall(msg.data);
    if (!success) {
      assembly {
        revert(add(result, 32), mload(result))
      }
    } else {
      return abi.decode(result, (bytes32, uint64));
    }
  }

  function receiveForeignPaymentWithCircle(
    RedeemCirclePaymentParameters memory /* params */
  )
    public
    nonReentrant
    whenNotPaused
    returns (bytes32 payablePaymentId)
  {
    (bool success, bytes memory result) = transactionsLogic.delegatecall(msg.data);
    if (!success) {
      assembly {
        revert(add(result, 32), mload(result))
      }
    } else {
      return abi.decode(result, (bytes32));
    }
  }

  function withdraw(
    bytes32,
    /* payableId */
    address,
    /* token */
    uint256 /* amount */
  )
    public
    nonReentrant
    whenNotPaused
    returns (bytes32 withdrawalId)
  {
    (bool success, bytes memory result) = transactionsLogic.delegatecall(msg.data);
    if (!success) {
      assembly {
        revert(add(result, 32), mload(result))
      }
    } else {
      return abi.decode(result, (bytes32));
    }
  }
}
