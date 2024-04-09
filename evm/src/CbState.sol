// SPDX-License-Identifier: Apache 2
pragma solidity ^0.8.20;

import 'wormhole/interfaces/IWormhole.sol';

contract CbStorage {
  struct State {
    /// The address of the Wormhole Core Contract on this chain.
    address wormhole;
    /// The address of the Wormhole TokenBridge on this chain.
    address tokenBridge;
    /// Wormhole Chain ID of this contract.
    uint16 chainId;
    /// The number of block confirmations needed before the wormhole network
    /// will attest a message.
    uint8 wormholeFinality;
    /// Wormhole Chain IDs against their corresponding Cb Emitter
    /// Contract Addresses on those chains, that is, trusted caller contracts.
    mapping(uint16 => bytes32) registeredEmitters;
    /// The relayer's fee.
    uint256 relayerFee;
  }
}

contract CbState {
  CbStorage.State _state;
}
