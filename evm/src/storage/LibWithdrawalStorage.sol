// SPDX-License-Identifier: Apache 2
pragma solidity ^0.8.30;

import {Withdrawal} from '../types/CbTypes.sol';

/// Withdrawals recorded on this chain.
/// @dev Append new fields at the end only.
library LibWithdrawalStorage {
  /// @custom:storage-location erc7201:chainbills.withdrawals
  struct Layout {
    /// Every withdrawal, in order.
    bytes32[] withdrawalIds;
    /// Withdrawals by ID.
    mapping(bytes32 withdrawalId => Withdrawal) withdrawals;
  }

  /// keccak256(abi.encode(uint256(keccak256('chainbills.withdrawals')) - 1)) & ~bytes32(uint256(0xff))
  bytes32 internal constant STORAGE_SLOT = 0x9025ab934cc48305c66dadf83aeb70deaedb5a878c1f14eb5da40c76cf055a00;

  /// Returns the storage pointer.
  /// @return $ Storage pointer.
  function layout() internal pure returns (Layout storage $) {
    bytes32 slot = STORAGE_SLOT;
    assembly {
      $.slot := slot
    }
  }
}
