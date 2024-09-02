// SPDX-License-Identifier: Apache 2
pragma solidity ^0.8.20;

import '@openzeppelin/contracts/access/Ownable.sol';
import '@openzeppelin/contracts/token/ERC20/IERC20.sol';
import '@openzeppelin/contracts/utils/ReentrancyGuard.sol';

import './CbEvents.sol';
import './CbState.sol';

contract CbGovernance is Ownable, CbEvents, CbState, ReentrancyGuard {
  constructor() Ownable(msg.sender) {}

  error InvalidWormholeChainId();
  error InvalidWormholeEmitterAddress();
  error InvalidTokenAddress();
  error ZeroAmountSpecified();

  /// Registers foreign emitters (trusted contracts).
  /// @dev Only the deployer (owner) can invoke this method
  /// @param emitterChainId Wormhole ChainId of the contract being registered.
  /// @param emitterAddress Wormhole-normalized address of the contract being
  /// registered. For EVM, contracts' first 12 bytes should be zeros.
  function registerForeignContract(
    uint16 emitterChainId,
    bytes32 emitterAddress
  ) public onlyOwner {
    if (emitterChainId == 0 || emitterChainId == chainId) {
      revert InvalidWormholeChainId();
    } else if (emitterAddress == bytes32(0)) {
      revert InvalidWormholeEmitterAddress();
    }
    // update the registeredEmitters state variable
    registeredEmitters[emitterChainId] = emitterAddress;
    emit RegisteredForeignContract(emitterChainId, emitterAddress);
  }

  /// Updates the maximum withdrawal fees for the given token.
  /// @dev Only the deployer (owner) can invoke this method
  /// @param token The address of the token to update its max fees
  /// @param maxFee The maximum cap of fees during withdrawal
  function updateMaxWithdrawalFee(
    address token,
    uint256 maxFee
  ) public onlyOwner {
    if (token == address(0)) revert InvalidTokenAddress();
    if (maxFee == 0) revert ZeroAmountSpecified();
    maxFeesPerToken[token] = maxFee;
    emit UpdatedMaxWithdrawalFee(token, maxFee);
  }

  /// Withdraws the specified `amount` of `token` to the {owner}.
  /// If token is the same as this deployed contract's address, the
  /// native token is transferred.
  function ownerWithdraw(
    address token,
    uint256 amount
  ) public onlyOwner nonReentrant {
    require(amount > 0);
    require(token != address(0));
    if (token == address(this)) (payable(owner()).call{value: amount}(''));
    else IERC20(token).transfer(owner(), amount);
    emit OwnerWithdrew(token, amount);
  }
}
