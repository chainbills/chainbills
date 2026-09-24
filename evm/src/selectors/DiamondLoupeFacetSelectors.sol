// SPDX-License-Identifier: Apache 2
pragma solidity ^0.8.30;

import {IDiamondLoupe} from '../interfaces/diamond/IDiamondLoupe.sol';
import {IERC165} from '@openzeppelin/contracts/utils/introspection/IERC165.sol';

/// Selectors routed to `DiamondLoupeFacet`.
library DiamondLoupeFacetSelectors {
  /// Returns every selector served by `DiamondLoupeFacet`.
  /// @return sels Function selectors.
  function selectors() internal pure returns (bytes4[] memory sels) {
    sels = new bytes4[](5);
    sels[0] = IDiamondLoupe.facets.selector;
    sels[1] = IDiamondLoupe.facetFunctionSelectors.selector;
    sels[2] = IDiamondLoupe.facetAddresses.selector;
    sels[3] = IDiamondLoupe.facetAddress.selector;
    sels[4] = IERC165.supportsInterface.selector;
  }
}
