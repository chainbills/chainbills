// SPDX-License-Identifier: MIT
pragma solidity ^0.8.30;

import {IERC173} from '../interfaces/diamond/IERC173.sol';
import {LibOwnership} from '../access/LibOwnership.sol';

/// Two-step ERC-173 ownership of the diamond.
contract OwnershipFacet is IERC173 {
  /// @inheritdoc IERC173
  function owner() external view override returns (address) {
    return LibOwnership.owner();
  }

  /// Returns the account allowed to accept ownership, or zero.
  /// @return Pending owner.
  function pendingOwner() external view returns (address) {
    return LibOwnership.pendingOwner();
  }

  /// @inheritdoc IERC173
  function transferOwnership(address newOwner) external override {
    LibOwnership.enforceIsOwner();
    LibOwnership.startTransfer(newOwner);
  }

  /// Completes a pending ownership transfer. Only the pending owner can call this.
  function acceptOwnership() external {
    LibOwnership.acceptTransfer();
  }
}
