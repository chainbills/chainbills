// SPDX-License-Identifier: Apache 2
pragma solidity ^0.8.30;

import {ICbOwnership} from '../interfaces/ICbOwnership.sol';
import {IERC173} from '../interfaces/diamond/IERC173.sol';

/// Selectors routed to `OwnershipFacet`.
library OwnershipFacetSelectors {
  /// Returns every selector served by `OwnershipFacet`.
  /// @return sels Function selectors.
  function selectors() internal pure returns (bytes4[] memory sels) {
    sels = new bytes4[](4);
    sels[0] = ICbOwnership.pendingOwner.selector;
    sels[1] = ICbOwnership.acceptOwnership.selector;
    sels[2] = IERC173.owner.selector;
    sels[3] = IERC173.transferOwnership.selector;
  }
}
