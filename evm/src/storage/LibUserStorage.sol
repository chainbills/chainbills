// SPDX-License-Identifier: Apache 2
pragma solidity ^0.8.30;

import {User} from '../types/CbTypes.sol';

/// Users of this chain and their entity lists.
/// @dev Append new fields at the end only.
library LibUserStorage {
  /// @custom:storage-location erc7201:chainbills.users
  struct Layout {
    /// Every user wallet, in initialization order.
    address[] userAddresses;
    /// User records by wallet.
    mapping(address wallet => User) users;
    /// Payables hosted by each user.
    mapping(address wallet => bytes32[]) userPayableIds;
    /// User payments made by each user.
    mapping(address wallet => bytes32[]) userPaymentIds;
    /// Withdrawals made by each user.
    mapping(address wallet => bytes32[]) userWithdrawalIds;
    /// Activities of each user.
    mapping(address wallet => bytes32[]) userActivityIds;
  }

  /// keccak256(abi.encode(uint256(keccak256('chainbills.users')) - 1)) & ~bytes32(uint256(0xff))
  bytes32 internal constant STORAGE_SLOT = 0x0e7916a2ef3bed724f8da8bf255ed1418603ae034aa308a25e3811840dff8a00;

  /// Returns the storage pointer.
  /// @return $ Storage pointer.
  function layout() internal pure returns (Layout storage $) {
    bytes32 slot = STORAGE_SLOT;
    assembly {
      $.slot := slot
    }
  }
}
