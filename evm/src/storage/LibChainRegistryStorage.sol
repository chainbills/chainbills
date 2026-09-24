// SPDX-License-Identifier: Apache 2
pragma solidity ^0.8.30;

import {EnumerableSet} from '@openzeppelin/contracts/utils/structs/EnumerableSet.sol';
import {ForeignChain} from '../types/CbTypes.sol';

/// Registry of foreign chains and their messaging settings.
/// @dev Append new fields at the end only.
library LibChainRegistryStorage {
  /// @custom:storage-location erc7201:chainbills.chains
  struct Layout {
    /// Currently registered foreign chains.
    EnumerableSet.Bytes32Set registeredChainIds;
    /// Foreign chain records by CAIP-2 chain identifier (kept after unregistration).
    mapping(bytes32 cbChainId => ForeignChain) chains;
    /// Registered foreign chain by Wormhole chain ID.
    mapping(uint16 wormholeChainId => bytes32 cbChainId) chainIdByWormholeChainId;
    /// Registered foreign chain by Circle domain.
    mapping(uint32 circleDomain => bytes32 cbChainId) chainIdByCircleDomain;
  }

  /// keccak256(abi.encode(uint256(keccak256('chainbills.chains')) - 1)) & ~bytes32(uint256(0xff))
  bytes32 internal constant STORAGE_SLOT = 0xd36bb9122292cfdfa7e70515711ada5c51f7ac394a1273e985cd69b7552e6e00;

  /// Returns the storage pointer.
  /// @return $ Storage pointer.
  function layout() internal pure returns (Layout storage $) {
    bytes32 slot = STORAGE_SLOT;
    assembly {
      $.slot := slot
    }
  }
}
