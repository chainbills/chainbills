// SPDX-License-Identifier: Apache 2
pragma solidity ^0.8.20;

import '@openzeppelin/contracts/token/ERC20/IERC20.sol';
import '@openzeppelin/contracts-upgradeable/access/OwnableUpgradeable.sol';
import '@openzeppelin/contracts-upgradeable/proxy/utils/Initializable.sol';
import
  '@openzeppelin/contracts-upgradeable/utils/ReentrancyGuardUpgradeable.sol';
import '@openzeppelin/contracts-upgradeable/proxy/utils/UUPSUpgradeable.sol';
import './CbErrors.sol';
import './CbEvents.sol';
import './CbUtils.sol';

contract CbGovernance is
  CbUtils,
  Initializable,
  OwnableUpgradeable,
  ReentrancyGuardUpgradeable,
  UUPSUpgradeable
{
  function __CbGovernance_init() public onlyInitializing {
    __Ownable_init(msg.sender);
    __ReentrancyGuard_init();
    __UUPSUpgradeable_init();
  }

  function _authorizeUpgrade(address newImpl) internal override onlyOwner {}

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
    tokenDetails[token].maxWithdrawalFees = maxWithdrawalFees;
    emit UpdatedMaxWithdrawalFees(token, maxWithdrawalFees);
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
    } else if (emitterAddress == bytes32(0)) {
      revert InvalidWormholeEmitterAddress();
    }
    // update the registeredEmitters state variable
    registeredEmitters[emitterChainId] = emitterAddress;
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
}
