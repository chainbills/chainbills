// SPDX-License-Identifier: Apache 2
pragma solidity ^0.8.30;

import {ChainStats} from '../types/CbTypes.sol';

/// Entity counters of this chain.
/// @dev Append new fields at the end only.
library LibStatsStorage {
  /// @custom:storage-location erc7201:chainbills.stats
  struct Layout {
    /// Entity counters.
    ChainStats chainStats;
  }

  /// keccak256(abi.encode(uint256(keccak256('chainbills.stats')) - 1)) & ~bytes32(uint256(0xff))
  bytes32 internal constant STORAGE_SLOT = 0x015ec2dcebf64515dd281b18dc7def44103a9324e0f8c898d1b478e2b6af9000;

  /// Returns the storage pointer.
  /// @return $ Storage pointer.
  function layout() internal pure returns (Layout storage $) {
    bytes32 slot = STORAGE_SLOT;
    assembly {
      $.slot := slot
    }
  }
}
