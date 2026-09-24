// SPDX-License-Identifier: Apache 2
pragma solidity ^0.8.30;

/// Replay-protection and nonce reads for relayers and indexers.
/// @dev Paginated functions return empty arrays when `offset` is past the end. `...Desc` variants count `offset`
/// from the newest entry and return newest first.
interface ICbCrossChainViews {
  function isWormholeMessageConsumed(bytes32 wormholeHash) external view returns (bool);
  function getConsumedWormholeMessageCount() external view returns (uint256);
  function getConsumedWormholeMessages(uint256 offset, uint256 limit) external view returns (bytes32[] memory);
  function getConsumedWormholeMessagesDesc(uint256 offset, uint256 limit) external view returns (bytes32[] memory);
  function getConsumedWormholeMessageCountByChain(uint16 wormholeChainId) external view returns (uint256);
  function getConsumedWormholeMessagesByChain(uint16 wormholeChainId, uint256 offset, uint256 limit)
    external
    view
    returns (bytes32[] memory);
  function getConsumedWormholeMessagesByChainDesc(uint16 wormholeChainId, uint256 offset, uint256 limit)
    external
    view
    returns (bytes32[] memory);

  function isCctpBurnNonceConsumed(uint32 sourceDomain, bytes32 nonce) external view returns (bool);
  function isCctpDataNonceConsumed(uint32 sourceDomain, bytes32 nonce) external view returns (bool);
  function isPaymentNonceConsumed(bytes32 payerChainId, bytes32 payer, uint64 nonce) external view returns (bool);

  /// Returns the last applied update nonce of a foreign payable.
  function getForeignPayableUpdateNonce(bytes32 payableId) external view returns (uint64);

  /// Returns the nonce assigned to the latest outbound payable update.
  function getLastPayableUpdateNonce() external view returns (uint64);

  /// Returns the payment nonce the next outbound payment of `payer` will carry.
  function getNextPaymentNonce(address payer) external view returns (uint64);
}
