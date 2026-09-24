// SPDX-License-Identifier: Apache 2
pragma solidity ^0.8.30;

import {ICbErrors} from '../interfaces/ICbErrors.sol';

/// Transient-storage reentrancy guard shared by every facet of the diamond.
library LibReentrancyGuard {
  /// keccak256(abi.encode(uint256(keccak256('chainbills.reentrancy')) - 1)) & ~bytes32(uint256(0xff))
  bytes32 internal constant TRANSIENT_SLOT = 0x868ce4309fde1ed5110d62a43cfb22888ff9a04b6f8977aa00110f3668567e00;

  /// Marks the diamond as entered. Reverts when it already is.
  function enter() internal {
    bytes32 slot = TRANSIENT_SLOT;
    uint256 status;
    assembly {
      status := tload(slot)
    }
    if (status != 0) revert ICbErrors.ReentrancyGuardReentrantCall();
    assembly {
      tstore(slot, 1)
    }
  }

  /// Clears the entered mark.
  function exit() internal {
    bytes32 slot = TRANSIENT_SLOT;
    assembly {
      tstore(slot, 0)
    }
  }

  /// Returns whether a guarded function is executing.
  /// @return True while entered.
  function isEntered() internal view returns (bool) {
    bytes32 slot = TRANSIENT_SLOT;
    uint256 status;
    assembly {
      status := tload(slot)
    }
    return status != 0;
  }
}
