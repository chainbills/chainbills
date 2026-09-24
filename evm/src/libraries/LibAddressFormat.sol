// SPDX-License-Identifier: Apache 2
pragma solidity ^0.8.30;

import {ICbErrors} from '../interfaces/ICbErrors.sol';

/// Conversion between EVM addresses and the 32-byte cross-chain address format.
library LibAddressFormat {
  /// Left-pads `account` to 32 bytes.
  /// @param account EVM address.
  /// @return 32-byte address.
  function toBytes32(address account) internal pure returns (bytes32) {
    return bytes32(uint256(uint160(account)));
  }

  /// Converts a 32-byte address to an EVM address. Reverts when the upper 12 bytes are not zero.
  /// @param account 32-byte address.
  /// @return EVM address.
  function toAddress(bytes32 account) internal pure returns (address) {
    if (uint256(account) >> 160 != 0) revert ICbErrors.InvalidAddress();
    return address(uint160(uint256(account)));
  }
}
