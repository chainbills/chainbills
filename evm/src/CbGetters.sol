// SPDX-License-Identifier: Apache 2
pragma solidity ^0.8.20;

import 'wormhole/interfaces/ITokenBridge.sol';

import './CbSetters.sol';

contract CbGetters is CbSetters {
  function wormhole() public view returns (IWormhole) {
    return IWormhole(_state.wormhole);
  }

  function tokenBridge() public view returns (ITokenBridge) {
    return ITokenBridge(payable(_state.tokenBridge));
  }

  function chainId() public view returns (uint16) {
    return _state.chainId;
  }

  function wormholeFinality() public view returns (uint8) {
    return _state.wormholeFinality;
  }

  function getRegisteredEmitter(
    uint16 emitterChainId
  ) public view returns (bytes32) {
    return _state.registeredEmitters[emitterChainId];
  }

  function getRelayerFee() public view returns (uint256) {
    return _state.relayerFee;
  }
}
