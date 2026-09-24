// SPDX-License-Identifier: Apache 2
pragma solidity ^0.8.30;

import {PayableForeign, TokenAndAmountForeign} from '../types/CbTypes.sol';

/// Payables hosted on foreign chains, mirrored from payable updates.
/// @dev Append new fields at the end only.
library LibForeignPayableStorage {
  /// @custom:storage-location erc7201:chainbills.foreign.payables
  struct Layout {
    /// Every mirrored foreign payable, in first-seen order.
    bytes32[] foreignPayableIds;
    /// Mirrored foreign payables by chain, in first-seen order.
    mapping(bytes32 cbChainId => bytes32[]) foreignPayableIdsByChain;
    /// Foreign payable records by ID.
    mapping(bytes32 payableId => PayableForeign) foreignPayables;
    /// Allowed tokens and amounts of each foreign payable.
    mapping(bytes32 payableId => TokenAndAmountForeign[]) allowedTokensAndAmounts;
  }

  /// keccak256(abi.encode(uint256(keccak256('chainbills.foreign.payables')) - 1)) & ~bytes32(uint256(0xff))
  bytes32 internal constant STORAGE_SLOT = 0xba6cb13eea703c59424b85e1e1c43b7ec8318ee7c605c71dba538577b7966800;

  /// Returns the storage pointer.
  /// @return $ Storage pointer.
  function layout() internal pure returns (Layout storage $) {
    bytes32 slot = STORAGE_SLOT;
    assembly {
      $.slot := slot
    }
  }
}
