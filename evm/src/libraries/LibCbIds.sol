// SPDX-License-Identifier: Apache 2
pragma solidity ^0.8.30;

import {EntityType} from '../types/CbTypes.sol';

/// Deterministic entity IDs.
library LibCbIds {
  /// Returns a unique ID for the `count`-th entity of kind `salt` related to `entity`.
  /// @param entity Related entity (wallet in 32-byte format or payable ID).
  /// @param salt Kind of the new entity.
  /// @param count Position of the new entity among its kind for `entity` (1-based).
  /// @return ID of the new entity.
  function createId(bytes32 entity, EntityType salt, uint256 count) internal view returns (bytes32) {
    return keccak256(abi.encodePacked(block.chainid, block.timestamp, entity, salt, count));
  }
}
