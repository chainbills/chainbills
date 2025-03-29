// SPDX-License-Identifier: Apache 2
pragma solidity ^0.8.20;

import '@openzeppelin/contracts/token/ERC20/IERC20.sol';
import '@openzeppelin/contracts-upgradeable/access/OwnableUpgradeable.sol';
import '@openzeppelin/contracts-upgradeable/proxy/utils/Initializable.sol';
import
  '@openzeppelin/contracts-upgradeable/utils/ReentrancyGuardUpgradeable.sol';
import '@openzeppelin/contracts-upgradeable/proxy/utils/UUPSUpgradeable.sol';
import 'wormhole/interfaces/IWormhole.sol';
import 'wormhole/Utils.sol';
import './circle/ICircleBridge.sol';
import './circle/IMessageTransmitter.sol';
import './circle/ITokenMinter.sol';
import './CbErrors.sol';
import './CbEvents.sol';
import './CbUtils.sol';
import './CbPayables.sol';
import './CbTransactions.sol';

/// A Cross-Chain Payment Gateway.
contract Chainbills is
  CbUtils,
  Initializable,
  OwnableUpgradeable,
  ReentrancyGuardUpgradeable,
  UUPSUpgradeable
{
  fallback() external payable {}

  receive() external payable {}

  /// Sets up this smart contract when it is deployed.
  /// @param feeCollector The address that will collect withdrawal fees.
  function initialize(address feeCollector) public initializer {
    if (feeCollector == address(0)) revert InvalidFeeCollector();
    config.feeCollector = feeCollector;

    // 200 means 2% withdrawal fee (with 2 decimal places)
    config.withdrawalFeePercentage = 200;

    __Ownable_init(msg.sender);
    __ReentrancyGuard_init();
    __UUPSUpgradeable_init();
  }

  function _authorizeUpgrade(address newImpl) internal override onlyOwner {}

  /// Sets up Wormhole and Circle Bridge contracts.
  /// @param wormhole The address of the Wormhole contract.
  /// @param circleBridge The address of the Circle Bridge contract.
  /// @param chainId The Wormhole Chain ID of the chain.
  /// @param wormholeFinality Confirmed/Finalized for Wormhole messages.
  /// @dev Only the deployer (owner) can invoke this method
  function setupWormholeAndCircle(
    address wormhole,
    address circleBridge,
    uint16 chainId,
    uint8 wormholeFinality
  ) public onlyOwner {
    if (wormhole == address(0)) revert InvalidWormholeAddress();
    else if (chainId == 0) revert InvalidWormholeChainId();
    else if (wormholeFinality == 0) revert InvalidWormholeFinality();
    else if (circleBridge == address(0)) revert InvalidCircleBridge();

    IMessageTransmitter circleTransmitter =
      ICircleBridge(circleBridge).localMessageTransmitter();
    uint32 circleDomain = circleTransmitter.localDomain();
    ITokenMinter circleTokenMinter = ICircleBridge(circleBridge).localMinter();

    // Set necessary config variables like feeCollector, wormhole, chainId, and
    // wormholeFinality, circleDomain, circleBridge, circleTransmitter, and
    // circleTokenMinter.
    config.wormholeFinality = wormholeFinality;
    config.chainId = chainId;
    config.circleDomain = circleDomain;
    config.wormhole = wormhole;
    config.circleBridge = circleBridge;
    config.circleTransmitter = address(circleTransmitter);
    config.circleTokenMinter = address(circleTokenMinter);
  }

  /// Withdraws the specified `amount` of `token` to the {owner}.
  /// If token is the same as this deployed contract's address, the
  /// native token is transferred.
  function ownerWithdraw(address token, uint256 amount)
    public
    onlyOwner
    nonReentrant
  {
    require(amount > 0);
    require(token != address(0));
    if (token == address(this)) (payable(owner()).call{value: amount}(''));
    else IERC20(token).transfer(owner(), amount);
    emit OwnerWithdrew(token, amount);
  }

  /// Registers a Circle Chain Domain and its matching Wormhole Chain ID.
  /// @dev Only the deployer (owner) can invoke this method
  /// @param circleDomain The Circle Chain Domain.
  /// @param chainId The Wormhole Chain ID.
  function registerCircleDomainToWormholeChainId(
    uint32 circleDomain,
    uint16 chainId
  ) public onlyOwner {
    if (circleDomain == 0 || chainId == 0) revert InvalidChainId();
    chainIdToCircleDomain[chainId] = circleDomain;
    circleDomainToChainId[circleDomain] = chainId;
    emit RegisteredCircleDomainToWormholeChainId(circleDomain, chainId);
  }

  /// Registers foreign emitters (trusted contracts).
  /// @dev Only the deployer (owner) can invoke this method
  /// @param emitterChainId Wormhole ChainId of the contract being registered.
  /// @param emitterAddress Wormhole-normalized address of the contract being
  /// registered. For EVM, contracts' first 12 bytes should be zeros.
  function registerForeignContract(
    uint16 emitterChainId,
    bytes32 emitterAddress
  ) public onlyOwner {
    if (emitterChainId == 0 || emitterChainId == config.chainId) {
      revert InvalidWormholeChainId();
    } else if (
      emitterAddress == bytes32(0)
        || emitterAddress == toWormholeFormat(address(this))
    ) {
      revert InvalidWormholeEmitterAddress();
    }
    // update the registeredForeignContracts state variable
    registeredForeignContracts[emitterChainId] = emitterAddress;
    emit RegisteredForeignContract(emitterChainId, emitterAddress);
  }

  /// Registers a matching token address for a foreign token.
  /// @dev Only the deployer (owner) can invoke this method
  /// @param chainId The chainId of the foreign chain.
  /// @param foreignToken The address of the token in the foreign chain.
  /// @param token The address of corresponding token in this chain.
  function registerMatchingTokenForForeignChain(
    uint16 chainId,
    bytes32 foreignToken,
    address token
  ) public onlyOwner {
    if (chainId == 0 || chainId == config.chainId) {
      revert InvalidWormholeChainId();
    } else if (token == address(0) || foreignToken == bytes32(0)) {
      revert InvalidTokenAddress();
    }
    forForeignChainMatchingTokenAddresses[chainId][foreignToken] = token;
    forTokenAddressMatchingForeignChainTokens[token][chainId] = foreignToken;
    emit RegisteredMatchingTokenForForeignChain(chainId, foreignToken, token);
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
  function setTransactionsLogic(address transactionsLogicAddress)
    public
    onlyOwner
  {
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
  function updateMaxWithdrawalFees(address token, uint256 maxWithdrawalFees)
    public
    onlyOwner
  {
    if (token == address(0)) revert InvalidTokenAddress();
    tokenDetails[token].isSupported = true;
    tokenDetails[token].token = token;
    tokenDetails[token].maxWithdrawalFees = maxWithdrawalFees;
    emit UpdatedMaxWithdrawalFees(token, maxWithdrawalFees);
  }

  /// Stops payments in a given token.
  /// @dev Only the deployer (owner) can invoke this method
  /// @param token The address of the token to stop supporting
  function stopPaymentsForToken(address token) public onlyOwner {
    if (token == address(0)) revert InvalidTokenAddress();
    tokenDetails[token].isSupported = false;
    emit StoppedPaymentsForToken(token);
  }

  function createPayable(
    TokenAndAmount[] calldata /* allowedTokensAndAmounts */
  )
    public
    payable
    nonReentrant
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

  function closePayable(bytes32 /* payableId */ )
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

  function reopenPayable(bytes32 /* payableId */ )
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

  function updatePayableAllowedTokensAndAmounts(
    bytes32, /* payableId */
    TokenAndAmount[] calldata /* allowedTokensAndAmounts */
  ) public payable nonReentrant returns (uint64 wormholeMessageSequence) {
    (bool success, bytes memory result) = payablesLogic.delegatecall(msg.data);
    if (!success) {
      assembly {
        revert(add(result, 32), mload(result))
      }
    } else {
      return abi.decode(result, (uint64));
    }
  }

  function publishPayableDetails(bytes32 /* payableId */ )
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

  function recordForeignPayableUpdate(bytes memory /* wormholeEncoded */ )
    public
  {
    (bool success, bytes memory result) = payablesLogic.delegatecall(msg.data);
    if (!success) {
      assembly {
        revert(add(result, 32), mload(result))
      }
    }
  }

  function pay(
    bytes32, /* payableId */
    address, /* token */
    uint256 /* amount */
  )
    public
    payable
    nonReentrant
    returns (bytes32 userPaymentId, bytes32 payablePaymentId)
  {
    (bool success, bytes memory result) =
      transactionsLogic.delegatecall(msg.data);
    if (!success) {
      assembly {
        revert(add(result, 32), mload(result))
      }
    } else {
      return abi.decode(result, (bytes32, bytes32));
    }
  }

  function payForeignWithCircle(
    bytes32, /* payableId */
    address, /* token */
    uint256 /* amount */
  )
    public
    payable
    nonReentrant
    returns (bytes32 userPaymentId, uint64 wormholeMessageSequence)
  {
    (bool success, bytes memory result) =
      transactionsLogic.delegatecall(msg.data);
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
  ) public returns (bytes32 payablePaymentId) {
    (bool success, bytes memory result) =
      transactionsLogic.delegatecall(msg.data);
    if (!success) {
      assembly {
        revert(add(result, 32), mload(result))
      }
    } else {
      return abi.decode(result, (bytes32));
    }
  }

  function withdraw(
    bytes32, /* payableId */
    address, /* token */
    uint256 /* amount */
  ) public nonReentrant returns (bytes32 withdrawalId) {
    (bool success, bytes memory result) =
      transactionsLogic.delegatecall(msg.data);
    if (!success) {
      assembly {
        revert(add(result, 32), mload(result))
      }
    } else {
      return abi.decode(result, (bytes32));
    }
  }
}
