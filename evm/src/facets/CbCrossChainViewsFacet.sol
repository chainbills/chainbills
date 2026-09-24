// SPDX-License-Identifier: Apache 2
pragma solidity ^0.8.30;

import {ICbCrossChainViews} from '../interfaces/ICbCrossChainViews.sol';
import {CbPagination} from '../libraries/CbPagination.sol';
import {LibForeignPayableStorage} from '../storage/LibForeignPayableStorage.sol';
import {LibMessagingStorage} from '../storage/LibMessagingStorage.sol';
import {LibUserStorage} from '../storage/LibUserStorage.sol';
import {CbFacetBase} from './CbFacetBase.sol';

/// Replay-protection and nonce reads for relayers and indexers.
contract CbCrossChainViewsFacet is CbFacetBase, ICbCrossChainViews {
  /// @inheritdoc ICbCrossChainViews
  function isWormholeMessageConsumed(bytes32 wormholeHash) external view returns (bool) {
    return LibMessagingStorage.layout().isWormholeMessageConsumed[wormholeHash];
  }

  /// @inheritdoc ICbCrossChainViews
  function getConsumedWormholeMessageCount() external view returns (uint256) {
    return LibMessagingStorage.layout().consumedWormholeMessages.length;
  }

  /// @inheritdoc ICbCrossChainViews
  function getConsumedWormholeMessages(uint256 offset, uint256 limit) external view returns (bytes32[] memory) {
    return CbPagination.bytes32Page(LibMessagingStorage.layout().consumedWormholeMessages, offset, limit);
  }

  /// @inheritdoc ICbCrossChainViews
  function getConsumedWormholeMessagesDesc(uint256 offset, uint256 limit) external view returns (bytes32[] memory) {
    return CbPagination.bytes32PageDesc(LibMessagingStorage.layout().consumedWormholeMessages, offset, limit);
  }

  /// @inheritdoc ICbCrossChainViews
  function getConsumedWormholeMessageCountByChain(uint16 wormholeChainId) external view returns (uint256) {
    return LibMessagingStorage.layout().consumedWormholeMessagesByChain[wormholeChainId].length;
  }

  /// @inheritdoc ICbCrossChainViews
  function getConsumedWormholeMessagesByChain(uint16 wormholeChainId, uint256 offset, uint256 limit)
    external
    view
    returns (bytes32[] memory)
  {
    return CbPagination.bytes32Page(
      LibMessagingStorage.layout().consumedWormholeMessagesByChain[wormholeChainId], offset, limit
    );
  }

  /// @inheritdoc ICbCrossChainViews
  function getConsumedWormholeMessagesByChainDesc(uint16 wormholeChainId, uint256 offset, uint256 limit)
    external
    view
    returns (bytes32[] memory)
  {
    return CbPagination.bytes32PageDesc(
      LibMessagingStorage.layout().consumedWormholeMessagesByChain[wormholeChainId], offset, limit
    );
  }

  /// @inheritdoc ICbCrossChainViews
  function isCctpBurnNonceConsumed(uint32 sourceDomain, bytes32 nonce) external view returns (bool) {
    return LibMessagingStorage.layout().isCctpBurnNonceConsumed[sourceDomain][nonce];
  }

  /// @inheritdoc ICbCrossChainViews
  function isCctpDataNonceConsumed(uint32 sourceDomain, bytes32 nonce) external view returns (bool) {
    return LibMessagingStorage.layout().isCctpDataNonceConsumed[sourceDomain][nonce];
  }

  /// @inheritdoc ICbCrossChainViews
  function isPaymentNonceConsumed(bytes32 payerChainId, bytes32 payer, uint64 nonce) external view returns (bool) {
    return LibMessagingStorage.layout().isPaymentNonceConsumed[payerChainId][payer][nonce];
  }

  /// @inheritdoc ICbCrossChainViews
  function getForeignPayableUpdateNonce(bytes32 payableId) external view returns (uint64) {
    return LibForeignPayableStorage.layout().foreignPayables[payableId].lastUpdateNonce;
  }

  /// @inheritdoc ICbCrossChainViews
  function getLastPayableUpdateNonce() external view returns (uint64) {
    return LibMessagingStorage.layout().lastPayableUpdateNonce;
  }

  /// @inheritdoc ICbCrossChainViews
  function getNextPaymentNonce(address payer) external view returns (uint64) {
    return uint64(LibUserStorage.layout().users[payer].paymentsCount + 1);
  }
}
