// SPDX-License-Identifier: Apache 2
pragma solidity ^0.8.30;

import {ActivityRecord} from '../types/CbTypes.sol';

/// Activity records of this chain.
/// @dev Append new fields at the end only.
library LibActivityStorage {
  /// @custom:storage-location erc7201:chainbills.activities
  struct Layout {
    /// Every activity, in order.
    bytes32[] activityIds;
    /// Activity records by ID.
    mapping(bytes32 activityId => ActivityRecord) activities;
  }

  /// keccak256(abi.encode(uint256(keccak256('chainbills.activities')) - 1)) & ~bytes32(uint256(0xff))
  bytes32 internal constant STORAGE_SLOT = 0x49e18ec189daeb42abbe5ee4a9b30a74adae19ca26e22f02aee695f39e53b400;

  /// Returns the storage pointer.
  /// @return $ Storage pointer.
  function layout() internal pure returns (Layout storage $) {
    bytes32 slot = STORAGE_SLOT;
    assembly {
      $.slot := slot
    }
  }
}
