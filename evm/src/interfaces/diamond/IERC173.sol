// SPDX-License-Identifier: MIT
pragma solidity ^0.8.30;

/// ERC-173 contract ownership interface.
interface IERC173 {
  /// Ownership moved from `previousOwner` to `newOwner`.
  event OwnershipTransferred(address indexed previousOwner, address indexed newOwner);

  /// Returns the owner.
  /// @return owner_ Current owner.
  function owner() external view returns (address owner_);

  /// Starts an ownership transfer to `newOwner`. The transfer completes when `newOwner` calls
  /// `acceptOwnership`. Passing the zero address cancels a pending transfer.
  /// @param newOwner Proposed owner.
  function transferOwnership(address newOwner) external;
}
