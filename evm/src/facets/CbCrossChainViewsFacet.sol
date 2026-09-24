// SPDX-License-Identifier: Apache 2
pragma solidity ^0.8.30;

import {ICbCrossChainViews} from '../interfaces/ICbCrossChainViews.sol';
import {CbFacetBase} from './CbFacetBase.sol';

contract CbCrossChainViewsFacet is CbFacetBase, ICbCrossChainViews {
  function isWormholeMessageConsumed(bytes32 wormholeHash) external view returns (bool) {
    revert('unimplemented');
  }

  function getConsumedWormholeMessageCount() external view returns (uint256) {
    revert('unimplemented');
  }

  function getConsumedWormholeMessages(uint256 offset, uint256 limit) external view returns (bytes32[] memory) {
    revert('unimplemented');
  }

  function getConsumedWormholeMessagesDesc(uint256 offset, uint256 limit) external view returns (bytes32[] memory) {
    revert('unimplemented');
  }

  function getConsumedWormholeMessageCountByChain(uint16 wormholeChainId) external view returns (uint256) {
    revert('unimplemented');
  }

  function getConsumedWormholeMessagesByChain(uint16 wormholeChainId, uint256 offset, uint256 limit)
    external
    view
    returns (bytes32[] memory)
  {
    revert('unimplemented');
  }

  function getConsumedWormholeMessagesByChainDesc(uint16 wormholeChainId, uint256 offset, uint256 limit)
    external
    view
    returns (bytes32[] memory)
  {
    revert('unimplemented');
  }

  function isCctpBurnNonceConsumed(uint32 sourceDomain, bytes32 nonce) external view returns (bool) {
    revert('unimplemented');
  }

  function isCctpDataNonceConsumed(uint32 sourceDomain, bytes32 nonce) external view returns (bool) {
    revert('unimplemented');
  }

  function isPaymentNonceConsumed(bytes32 payerChainId, bytes32 payer, uint64 nonce) external view returns (bool) {
    revert('unimplemented');
  }

  function getForeignPayableUpdateNonce(bytes32 payableId) external view returns (uint64) {
    revert('unimplemented');
  }

  function getLastPayableUpdateNonce() external view returns (uint64) {
    revert('unimplemented');
  }

  function getNextPaymentNonce(address payer) external view returns (uint64) {
    revert('unimplemented');
  }
}
