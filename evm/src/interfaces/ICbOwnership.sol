// SPDX-License-Identifier: Apache 2
pragma solidity ^0.8.30;

import {IERC173} from './diamond/IERC173.sol';

/// Two-step ERC-173 ownership. The owner is the only account that can cut the diamond.
interface ICbOwnership is IERC173 {
  /// Returns the account allowed to accept ownership, or zero.
  function pendingOwner() external view returns (address);

  /// Completes a pending ownership transfer. Only the pending owner can call this.
  function acceptOwnership() external;
}
