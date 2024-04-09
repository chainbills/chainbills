// SPDX-License-Identifier: Apache 2
pragma solidity ^0.8.20;

import './CbState.sol';

contract CbSetters is CbState {
  function setWormhole(address wormhole_) internal {
    _state.wormhole = payable(wormhole_);
  }

  function setTokenBridge(address tokenBridge_) internal {
    _state.tokenBridge = payable(tokenBridge_);
  }

  function setChainId(uint16 chainId_) internal {
    _state.chainId = chainId_;
  }

  function setWormholeFinality(uint8 finality) internal {
    _state.wormholeFinality = finality;
  }

  function setEmitter(uint16 chainId, bytes32 emitter) internal {
    _state.registeredEmitters[chainId] = emitter;
  }

  function setRelayerFee(uint256 relayerFee_) internal {
    _state.relayerFee = relayerFee_;
  }
}
