// SPDX-License-Identifier: Apache 2
pragma solidity ^0.8.20;

import '@openzeppelin/contracts-upgradeable/access/OwnableUpgradeable.sol';

import './CbErrors.sol';
import './CbGetters.sol';

contract CbGovernance is OwnableUpgradeable, CbGetters, CbErrors {
  /// Registers foreign emitters (trusted Cb contracts).
  /// @dev Only the deployer (owner) can invoke this method
  /// @param emitterChainId Wormhole ChainId of the contract being registered.
  /// @param emitterAddress Wormhole-normalized address of the contract being
  /// registered. For EVM, contracts' first 12 bytes should be zeros.
  function registerEmitter(
    uint16 emitterChainId,
    bytes32 emitterAddress
  ) public onlyOwner {
    if (emitterChainId == 0 && emitterChainId == chainId()) {
      revert InvalidWormholeChainId();
    } else if (emitterAddress == bytes32(0)) {
      revert InvalidWormholeEmitterAddress();
    }

    // update the registeredEmitters state variable
    setEmitter(emitterChainId, emitterAddress);
  }

  /// Updates the relayer's fee.
  /// @dev Only the deployer (owner) can invoke this method
  /// @param relayerFee_ The relayer's fee
  function updateRelayerFee(uint256 relayerFee_) public onlyOwner {
    setRelayerFee(relayerFee_);
  }

  /// Withdraws the specified `amount` to the {owner}.
  function ownerWithdraw(uint256 amount) public onlyOwner {
    require(amount > 0);
    require(address(this).balance >= amount);
    payable(owner()).transfer(amount);
  }

  /// Withdraws the specified `amount` of `token` to the {owner}.
  function ownerWithdrawToken(uint256 amount, address token) public onlyOwner {
    require(token != address(0));
    require(amount > 0);
    require(IERC20(token).balanceOf(address(this)) >= amount);
    require(IERC20(token).transfer(owner(), amount));
  }
}
