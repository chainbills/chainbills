// SPDX-License-Identifier: Apache 2
pragma solidity ^0.8.30;

import {EnumerableSet} from '@openzeppelin/contracts/utils/structs/EnumerableSet.sol';
import {TokenConfig, TokenStats} from '../types/CbTypes.sol';

/// Token configuration, running totals, and foreign token mappings.
/// @dev Append new fields at the end only.
library LibTokenRegistryStorage {
  /// @custom:storage-location erc7201:chainbills.tokens
  struct Layout {
    /// Every token an admin has configured.
    EnumerableSet.AddressSet registeredTokens;
    /// Admin configuration by token.
    mapping(address token => TokenConfig) configs;
    /// Running totals by token.
    mapping(address token => TokenStats) stats;
    /// Local token matching a foreign token on a foreign chain.
    mapping(bytes32 cbChainId => mapping(bytes32 foreignToken => address localToken)) localTokenByForeignToken;
    /// Foreign token on a foreign chain matching a local token.
    mapping(address localToken => mapping(bytes32 cbChainId => bytes32 foreignToken)) foreignTokenByLocalToken;
    /// Foreign tokens with a registered match, per foreign chain.
    mapping(bytes32 cbChainId => EnumerableSet.Bytes32Set) matchedForeignTokens;
  }

  /// keccak256(abi.encode(uint256(keccak256('chainbills.tokens')) - 1)) & ~bytes32(uint256(0xff))
  bytes32 internal constant STORAGE_SLOT = 0xa08f4163769b46f61974e323294d10921b9b758e4fd960786a89aaf18ee71d00;

  /// Returns the storage pointer.
  /// @return $ Storage pointer.
  function layout() internal pure returns (Layout storage $) {
    bytes32 slot = STORAGE_SLOT;
    assembly {
      $.slot := slot
    }
  }
}
