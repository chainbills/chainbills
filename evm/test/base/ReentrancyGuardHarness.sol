// SPDX-License-Identifier: Apache 2
pragma solidity ^0.8.30;

import {LibReentrancyGuard} from 'src/access/LibReentrancyGuard.sol';

/// Exposes the internal helpers of `LibReentrancyGuard` for tests.
contract ReentrancyGuardHarness {
  function isEntered() external view returns (bool) {
    return LibReentrancyGuard.isEntered();
  }

  function enter() external {
    LibReentrancyGuard.enter();
  }

  function exit() external {
    LibReentrancyGuard.exit();
  }

  function isEnteredAcrossEnterAndExit() external returns (bool before_, bool during_, bool after_) {
    before_ = LibReentrancyGuard.isEntered();
    LibReentrancyGuard.enter();
    during_ = LibReentrancyGuard.isEntered();
    LibReentrancyGuard.exit();
    after_ = LibReentrancyGuard.isEntered();
  }
}
