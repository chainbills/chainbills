// SPDX-License-Identifier: Apache 2
pragma solidity ^0.8.30;

import {ICbPayableSync} from '../interfaces/ICbPayableSync.sol';
import {IMessageHandlerV2} from '../interfaces/circle/IMessageHandlerV2.sol';
import {CbCctpMessaging} from '../libraries/CbCctpMessaging.sol';
import {CbPayableSync} from '../libraries/CbPayableSync.sol';
import {LibRelayGuard} from '../libraries/LibRelayGuard.sol';
import {LibConfigStorage} from '../storage/LibConfigStorage.sol';
import {LibMessagingStorage} from '../storage/LibMessagingStorage.sol';
import {
  FEATURE_RECEIVE_PAYABLE_UPDATE,
  PAYABLE_ACTION_CREATE,
  PAYABLE_ACTION_UPDATE_ALLOWED_TOKENS_AND_AMOUNTS,
  PAYABLE_PAYLOAD_TYPE,
  PAYLOAD_VERSION
} from '../types/CbConstants.sol';
import {PAYABLE_SYNC_ROLE} from '../types/CbRoles.sol';
import {CctpMessageHeader, PayablePayload, TokenAndAmountForeign} from '../types/CbTypes.sol';
import {CbFacetBase} from './CbFacetBase.sol';

/// Inbound payable updates from foreign chains.
contract CbPayableSyncFacet is CbFacetBase, ICbPayableSync {
  /// @inheritdoc ICbPayableSync
  function receivePayableUpdateViaWormhole(bytes calldata encodedVaa)
    external
    nonReentrant
    whenNotPaused(FEATURE_RECEIVE_PAYABLE_UPDATE)
    onlyPermittedRelayer
  {
    CbPayableSync.receiveViaWormhole(encodedVaa);
  }

  /// @inheritdoc ICbPayableSync
  function receivePayableUpdateViaCctp(bytes calldata message, bytes calldata attestation)
    external
    nonReentrant
    whenNotPaused(FEATURE_RECEIVE_PAYABLE_UPDATE)
    onlyPermittedRelayer
  {
    /* CHECKS */
    LibRelayGuard.enforceCctpEnabled();
    CctpMessageHeader memory header = CbCctpMessaging.parseMessageHeader(message);
    if (header.destinationDomain != LibConfigStorage.layout().cctpDomain) {
      revert CircleDestinationDomainMismatch(header.destinationDomain);
    }
    LibMessagingStorage.Layout storage messaging = LibMessagingStorage.layout();
    if (messaging.isCctpDataNonceConsumed[header.sourceDomain][header.nonce]) {
      revert CctpDataNonceAlreadyConsumed(header.sourceDomain, header.nonce);
    }

    /* STATE CHANGES */
    messaging.isCctpDataNonceConsumed[header.sourceDomain][header.nonce] = true;

    /* TRANSFER */
    // Circle's transmitter calls back `handleReceiveFinalizedMessage` or `handleReceiveUnfinalizedMessage`, which
    // apply the update.
    CbCctpMessaging.receiveMessage(message, attestation);
  }

  /// @inheritdoc ICbPayableSync
  function adminSyncForeignPayable(
    bytes32 payableId,
    bytes32 cbChainId,
    uint64 nonce,
    uint64 initiatedAt,
    uint8 actionType,
    bool isClosed,
    TokenAndAmountForeign[] calldata allowedTokensAndAmounts
  ) external onlyRole(PAYABLE_SYNC_ROLE) nonReentrant {
    /* CHECKS */
    if (cbChainId == bytes32(0) || cbChainId == LibConfigStorage.layout().cbChainId) revert InvalidChainId();
    if (actionType < PAYABLE_ACTION_CREATE || actionType > PAYABLE_ACTION_UPDATE_ALLOWED_TOKENS_AND_AMOUNTS) {
      revert InvalidPayablePayloadActionType(actionType);
    }

    /* STATE CHANGES */
    PayablePayload memory payload = PayablePayload({
      payloadType: PAYABLE_PAYLOAD_TYPE,
      version: PAYLOAD_VERSION,
      actionType: actionType,
      payableId: payableId,
      nonce: nonce,
      initiatedAt: initiatedAt,
      isClosed: isClosed,
      allowedTokensAndAmounts: allowedTokensAndAmounts
    });
    CbPayableSync.applyUpdate(payload, cbChainId);
    emit ReceivedPayableUpdateViaAdminSync(payableId, cbChainId, nonce, msg.sender);
  }

  /// @inheritdoc IMessageHandlerV2
  function handleReceiveFinalizedMessage(
    uint32 sourceDomain,
    bytes32 sender,
    uint32 finalityThresholdExecuted,
    bytes calldata messageBody
  ) external whenNotPaused(FEATURE_RECEIVE_PAYABLE_UPDATE) returns (bool) {
    CbPayableSync.receiveViaCctp(sourceDomain, sender, finalityThresholdExecuted, messageBody);
    return true;
  }

  /// @inheritdoc IMessageHandlerV2
  function handleReceiveUnfinalizedMessage(
    uint32 sourceDomain,
    bytes32 sender,
    uint32 finalityThresholdExecuted,
    bytes calldata messageBody
  ) external whenNotPaused(FEATURE_RECEIVE_PAYABLE_UPDATE) returns (bool) {
    CbPayableSync.receiveViaCctp(sourceDomain, sender, finalityThresholdExecuted, messageBody);
    return true;
  }
}
