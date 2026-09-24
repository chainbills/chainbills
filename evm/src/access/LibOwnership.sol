// SPDX-License-Identifier: Apache 2
pragma solidity ^0.8.30;

import {ICbErrors} from '../interfaces/ICbErrors.sol';
import {ICbEvents} from '../interfaces/ICbEvents.sol';
import {IERC173} from '../interfaces/diamond/IERC173.sol';

/// Two-step ownership of the diamond. The owner is the only account that can cut the diamond.
library LibOwnership {
  /// @custom:storage-location erc7201:chainbills.ownership
  struct Layout {
    /// Current owner.
    address owner;
    /// Account allowed to accept ownership, or zero when no transfer is pending.
    address pendingOwner;
  }

  /// keccak256(abi.encode(uint256(keccak256('chainbills.ownership')) - 1)) & ~bytes32(uint256(0xff))
  bytes32 internal constant STORAGE_SLOT = 0x6f9fb6af8e42b51e00c46e11d01fe170c9b344f3d1b1a8be077b6d218fa76400;

  /// Returns the ownership storage.
  /// @return $ Storage pointer.
  function layout() internal pure returns (Layout storage $) {
    bytes32 slot = STORAGE_SLOT;
    assembly {
      $.slot := slot
    }
  }

  /// Returns the current owner.
  /// @return Current owner.
  function owner() internal view returns (address) {
    return layout().owner;
  }

  /// Returns the pending owner.
  /// @return Pending owner, or zero.
  function pendingOwner() internal view returns (address) {
    return layout().pendingOwner;
  }

  /// Reverts unless the caller is the owner.
  function enforceIsOwner() internal view {
    if (msg.sender != layout().owner) revert ICbErrors.NotContractOwner(msg.sender);
  }

  /// Sets the owner immediately and clears any pending transfer.
  /// @param newOwner New owner.
  function setOwner(address newOwner) internal {
    Layout storage $ = layout();
    address previousOwner = $.owner;
    $.owner = newOwner;
    delete $.pendingOwner;
    emit IERC173.OwnershipTransferred(previousOwner, newOwner);
  }

  /// Records `newOwner` as the pending owner. Zero cancels a pending transfer.
  /// @param newOwner Proposed owner.
  function startTransfer(address newOwner) internal {
    Layout storage $ = layout();
    $.pendingOwner = newOwner;
    emit ICbEvents.OwnershipTransferStarted($.owner, newOwner);
  }

  /// Completes a pending transfer. Reverts unless the caller is the pending owner.
  function acceptTransfer() internal {
    if (msg.sender != layout().pendingOwner) revert ICbErrors.NotPendingOwner(msg.sender);
    setOwner(msg.sender);
  }
}
