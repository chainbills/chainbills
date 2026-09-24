// SPDX-License-Identifier: Apache 2
pragma solidity ^0.8.30;

import {PayablePayment, UserPayment} from '../types/CbTypes.sol';

/// User payments and payable payments recorded on this chain.
/// @dev Append new fields at the end only.
library LibPaymentStorage {
  /// @custom:storage-location erc7201:chainbills.payments
  struct Layout {
    /// Every user payment, in order.
    bytes32[] userPaymentIds;
    /// Every payable payment, in order.
    bytes32[] payablePaymentIds;
    /// User payments by ID.
    mapping(bytes32 paymentId => UserPayment) userPayments;
    /// Payable payments by ID.
    mapping(bytes32 paymentId => PayablePayment) payablePayments;
  }

  /// keccak256(abi.encode(uint256(keccak256('chainbills.payments')) - 1)) & ~bytes32(uint256(0xff))
  bytes32 internal constant STORAGE_SLOT = 0x45de8e76c3725489c6e72e4d20bfd2a19ef0d59ac699053117eeab5337362e00;

  /// Returns the storage pointer.
  /// @return $ Storage pointer.
  function layout() internal pure returns (Layout storage $) {
    bytes32 slot = STORAGE_SLOT;
    assembly {
      $.slot := slot
    }
  }
}
