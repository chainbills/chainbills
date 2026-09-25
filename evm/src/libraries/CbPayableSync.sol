// SPDX-License-Identifier: Apache 2
pragma solidity ^0.8.30;

import {EnumerableSet} from '@openzeppelin/contracts/utils/structs/EnumerableSet.sol';
import {ICbErrors} from '../interfaces/ICbErrors.sol';
import {ICbEvents} from '../interfaces/ICbEvents.sol';
import {LibChainRegistryStorage} from '../storage/LibChainRegistryStorage.sol';
import {LibConfigStorage} from '../storage/LibConfigStorage.sol';
import {LibForeignPayableStorage} from '../storage/LibForeignPayableStorage.sol';
import {LibMessagingStorage} from '../storage/LibMessagingStorage.sol';
import {LibStatsStorage} from '../storage/LibStatsStorage.sol';
import {
  PAYABLE_ACTION_CLOSE,
  PAYABLE_ACTION_CREATE,
  PAYABLE_ACTION_REOPEN,
  PAYABLE_ACTION_UPDATE_ALLOWED_TOKENS_AND_AMOUNTS,
  PAYABLE_PAYLOAD_TYPE,
  PAYLOAD_VERSION
} from '../types/CbConstants.sol';
import {ForeignChain, PayableForeign, PayablePayload, TokenAndAmountForeign} from '../types/CbTypes.sol';
import {CbCctpMessaging} from './CbCctpMessaging.sol';
import {CbPayloadCodec} from './CbPayloadCodec.sol';
import {CbWormholeMessaging} from './CbWormholeMessaging.sol';
import {LibRelayGuard} from './LibRelayGuard.sol';

/// Outbound broadcasting and inbound application of payable updates. Linked library.
library CbPayableSync {
  using EnumerableSet for EnumerableSet.Bytes32Set;

  // ---------------------------------------------------------------------------
  // Outbound
  // ---------------------------------------------------------------------------

  /// Assigns the next update nonce to `payload` and broadcasts it: one Wormhole message when Wormhole is active,
  /// plus one CCTP data message per registered chain with CCTP updates enabled when CCTP is active.
  /// @param payload Payable payload; type, version, and nonce are set here.
  /// @param wormholeFee Wormhole message fee, already checked against `msg.value` by the caller.
  /// @return wormholeSequence Wormhole sequence, or zero when Wormhole is not active.
  function broadcast(PayablePayload memory payload, uint256 wormholeFee) public returns (uint64 wormholeSequence) {
    // Stamp the payload with the next chain-wide update nonce.
    LibMessagingStorage.Layout storage messaging = LibMessagingStorage.layout();
    messaging.lastPayableUpdateNonce++;
    payload.payloadType = PAYABLE_PAYLOAD_TYPE;
    payload.version = PAYLOAD_VERSION;
    payload.nonce = messaging.lastPayableUpdateNonce;
    bytes memory encoded = CbPayloadCodec.encodePayablePayload(payload);

    // One Wormhole message reaches every Wormhole-connected chain.
    if (LibRelayGuard.isWormholeActive()) wormholeSequence = CbWormholeMessaging.publish(encoded, wormholeFee);

    // One CCTP data message per chain that opted in and has a Circle domain.
    uint256 cctpMessagesCount;
    if (LibRelayGuard.isCctpActive()) {
      LibChainRegistryStorage.Layout storage registry = LibChainRegistryStorage.layout();
      uint256 count = registry.registeredChainIds.length();
      for (uint256 i; i < count; i++) {
        bytes32 cbChainId = registry.registeredChainIds.at(i);
        ForeignChain storage chain = registry.chains[cbChainId];
        if (chain.config.switches.isCctpUpdateEnabled && chain.config.protocolIds.hasCircleDomain) {
          CbCctpMessaging.sendPayableUpdate(cbChainId, payload.payableId, payload.nonce, encoded);
          cctpMessagesCount++;
          emit ICbEvents.SentPayableUpdateViaCctp(payload.payableId, cbChainId, payload.nonce);
        }
      }
    }

    emit ICbEvents.PayableUpdateBroadcasted(
      payload.payableId, payload.nonce, payload.actionType, wormholeSequence, cctpMessagesCount
    );
  }

  // ---------------------------------------------------------------------------
  // Inbound
  // ---------------------------------------------------------------------------

  /// Verifies and applies a payable update from a Wormhole VAA.
  /// @param encodedVaa Signed Wormhole VAA.
  function receiveViaWormhole(bytes calldata encodedVaa) public {
    (bytes32 srcCbChainId, bytes32 wormholeHash, bytes memory encoded) =
      CbWormholeMessaging.verifyAndConsume(encodedVaa);
    _enforceInboundUpdatesEnabled(srcCbChainId);
    PayablePayload memory payload = CbPayloadCodec.decodePayablePayload(encoded);
    applyUpdate(payload, srcCbChainId);
    emit ICbEvents.ReceivedPayableUpdateViaWormhole(payload.payableId, srcCbChainId, payload.nonce, wormholeHash);
  }

  /// Verifies and applies a payable update delivered by Circle's transmitter through `IMessageHandlerV2`.
  /// @param sourceDomain Circle domain of the source chain.
  /// @param sender Header sender of the message.
  /// @param finalityThresholdExecuted Finality at which Circle attested the message.
  /// @param messageBody Encoded payable payload.
  function receiveViaCctp(
    uint32 sourceDomain,
    bytes32 sender,
    uint32 finalityThresholdExecuted,
    bytes calldata messageBody
  ) public {
    // Only Circle's transmitter delivers verified messages.
    if (msg.sender != LibConfigStorage.layout().cctpMessageTransmitter) revert ICbErrors.CircleTransmitterOnly();
    LibRelayGuard.enforceCctpEnabled();

    // Require a registered source chain that accepts updates, its registered sender, and enough finality.
    (bytes32 srcCbChainId, ForeignChain storage chain) = LibRelayGuard.chainByCircleDomain(sourceDomain);
    _enforceInboundUpdatesEnabled(srcCbChainId);
    if (sender != chain.config.addresses.cctpMessageSender) revert ICbErrors.CircleSenderMismatch(sender);
    uint32 minimumFinality = chain.config.finality.minInboundUpdateFinality;
    if (finalityThresholdExecuted < minimumFinality) {
      revert ICbErrors.InsufficientFinality(finalityThresholdExecuted, minimumFinality);
    }

    // Decode and apply.
    PayablePayload memory payload = CbPayloadCodec.decodePayablePayload(messageBody);
    applyUpdate(payload, srcCbChainId);
    LibMessagingStorage.layout().cctpStats.receivedCctpPayableUpdateMessagesCount++;
    emit ICbEvents.ReceivedPayableUpdateViaCctp(
      payload.payableId, srcCbChainId, payload.nonce, finalityThresholdExecuted
    );
  }

  /// Applies a payable update from `srcCbChainId` to the mirrored foreign payable.
  /// @param payload Decoded payable payload.
  /// @param srcCbChainId CAIP-2 chain identifier of the hosting chain.
  /// @dev A foreign payable is bound to the chain it was first seen from. Nonces strictly increase per payable, so
  /// duplicate deliveries over Wormhole, CCTP, and admin sync apply once.
  function applyUpdate(PayablePayload memory payload, bytes32 srcCbChainId) public {
    LibForeignPayableStorage.Layout storage foreign = LibForeignPayableStorage.layout();
    bytes32 payableId = payload.payableId;
    PayableForeign storage payable_ = foreign.foreignPayables[payableId];

    /* CHECKS */
    // Reject empty IDs, updates from a different hosting chain, and stale nonces.
    if (payableId == bytes32(0)) revert ICbErrors.InvalidPayableId();
    if (payable_.chainId != bytes32(0) && payable_.chainId != srcCbChainId) {
      revert ICbErrors.ForeignPayableChainMismatch(payableId, payable_.chainId, srcCbChainId);
    }
    if (payload.nonce <= payable_.lastUpdateNonce) {
      revert ICbErrors.StalePayableUpdateNonce(payload.nonce, payable_.lastUpdateNonce);
    }

    /* STATE CHANGES */
    // Index the payable the first time it is seen.
    if (payable_.chainId == bytes32(0)) {
      payable_.chainId = srcCbChainId;
      foreign.foreignPayableIds.push(payableId);
      foreign.foreignPayableIdsByChain[srcCbChainId].push(payableId);
      LibStatsStorage.layout().chainStats.foreignPayablesCount++;
    }

    // Apply the action.
    uint8 actionType = payload.actionType;
    if (actionType == PAYABLE_ACTION_CREATE || actionType == PAYABLE_ACTION_UPDATE_ALLOWED_TOKENS_AND_AMOUNTS) {
      TokenAndAmountForeign[] storage stored = foreign.allowedTokensAndAmounts[payableId];
      delete foreign.allowedTokensAndAmounts[payableId];
      uint256 count = payload.allowedTokensAndAmounts.length;
      if (count > type(uint8).max) revert ICbErrors.InvalidPayload();
      for (uint256 i; i < count; i++) {
        stored.push(payload.allowedTokensAndAmounts[i]);
      }
      // forge-lint: disable-next-line(unsafe-typecast)
      payable_.allowedTokensAndAmountsCount = uint8(count);
      // A create action is a full snapshot and restates the closed status.
      if (actionType == PAYABLE_ACTION_CREATE) payable_.isClosed = payload.isClosed;
    } else if (actionType == PAYABLE_ACTION_CLOSE || actionType == PAYABLE_ACTION_REOPEN) {
      payable_.isClosed = payload.isClosed;
    } else {
      revert ICbErrors.InvalidPayablePayloadActionType(actionType);
    }

    // Record the sync position.
    payable_.lastUpdateNonce = payload.nonce;
    payable_.lastUpdateInitiatedAt = payload.initiatedAt;
    payable_.lastSyncedAt = block.timestamp;
  }

  /// Reverts unless the registered chain accepts inbound payable updates.
  function _enforceInboundUpdatesEnabled(bytes32 cbChainId) private view {
    if (!LibRelayGuard.registeredChain(cbChainId).config.switches.isInboundUpdateEnabled) {
      revert ICbErrors.InboundUpdatesDisabled(cbChainId);
    }
  }
}
