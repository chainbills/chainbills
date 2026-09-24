// SPDX-License-Identifier: Apache 2
pragma solidity ^0.8.30;

import {IWormhole} from 'wormhole/interfaces/IWormhole.sol';
import {ICbErrors} from '../interfaces/ICbErrors.sol';
import {LibConfigStorage} from '../storage/LibConfigStorage.sol';
import {LibMessagingStorage} from '../storage/LibMessagingStorage.sol';
import {ForeignChain} from '../types/CbTypes.sol';
import {LibRelayGuard} from './LibRelayGuard.sol';

/// Wormhole publishing and verified consumption. Linked library.
library CbWormholeMessaging {
  /// Publishes `payload` through Wormhole, paying `fee` from the diamond's balance.
  /// @param payload Message payload.
  /// @param fee Wormhole message fee.
  /// @return sequence Wormhole sequence of the message.
  function publish(bytes memory payload, uint256 fee) public returns (uint64 sequence) {
    LibConfigStorage.Layout storage config = LibConfigStorage.layout();
    sequence = IWormhole(config.wormhole).publishMessage{value: fee}(0, payload, config.wormholeFinality);
    LibMessagingStorage.layout().wormholeStats.publishedWormholeMessagesCount++;
  }

  /// Verifies a VAA, checks its emitter against the registered foreign chain, and marks it consumed.
  /// @param encodedVaa Signed Wormhole VAA.
  /// @return srcCbChainId CAIP-2 chain identifier of the emitter chain.
  /// @return wormholeHash Hash of the VAA body.
  /// @return payload Message payload.
  function verifyAndConsume(bytes memory encodedVaa)
    public
    returns (bytes32 srcCbChainId, bytes32 wormholeHash, bytes memory payload)
  {
    LibRelayGuard.enforceWormholeEnabled();

    // Let the core bridge verify guardian signatures.
    (IWormhole.VM memory vm, bool isValid, string memory reason) =
      IWormhole(LibConfigStorage.layout().wormhole).parseAndVerifyVM(encodedVaa);
    if (!isValid) revert ICbErrors.InvalidWormholeMessage(reason);

    // Require the registered Chainbills emitter of a registered chain.
    ForeignChain storage chain;
    (srcCbChainId, chain) = LibRelayGuard.chainByWormholeChainId(vm.emitterChainId);
    if (vm.emitterAddress != chain.config.addresses.wormholeEmitter) {
      revert ICbErrors.EmitterNotRegistered(vm.emitterChainId, vm.emitterAddress);
    }

    // Consume the message exactly once.
    LibMessagingStorage.Layout storage messaging = LibMessagingStorage.layout();
    if (messaging.isWormholeMessageConsumed[vm.hash]) revert ICbErrors.WormholeMessageAlreadyConsumed(vm.hash);
    messaging.isWormholeMessageConsumed[vm.hash] = true;
    messaging.consumedWormholeMessages.push(vm.hash);
    messaging.consumedWormholeMessagesByChain[vm.emitterChainId].push(vm.hash);
    messaging.wormholeStats.consumedWormholeMessagesCount++;

    wormholeHash = vm.hash;
    payload = vm.payload;
  }
}
