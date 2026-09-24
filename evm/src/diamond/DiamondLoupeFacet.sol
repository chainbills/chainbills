// SPDX-License-Identifier: MIT
pragma solidity ^0.8.30;

import {IERC165} from '@openzeppelin/contracts/utils/introspection/IERC165.sol';
import {IDiamondLoupe} from '../interfaces/diamond/IDiamondLoupe.sol';
import {LibDiamond} from './LibDiamond.sol';

/// ERC-2535 loupe and ERC-165 support.
contract DiamondLoupeFacet is IDiamondLoupe, IERC165 {
  /// @inheritdoc IDiamondLoupe
  function facets() external view override returns (Facet[] memory facets_) {
    LibDiamond.Layout storage $ = LibDiamond.layout();
    uint256 count = $.facetAddresses.length;
    facets_ = new Facet[](count);
    for (uint256 i; i < count; i++) {
      address facet = $.facetAddresses[i];
      facets_[i] = Facet({facetAddress: facet, functionSelectors: $.facetFunctionSelectors[facet].functionSelectors});
    }
  }

  /// @inheritdoc IDiamondLoupe
  function facetFunctionSelectors(address facet) external view override returns (bytes4[] memory) {
    return LibDiamond.layout().facetFunctionSelectors[facet].functionSelectors;
  }

  /// @inheritdoc IDiamondLoupe
  function facetAddresses() external view override returns (address[] memory) {
    return LibDiamond.layout().facetAddresses;
  }

  /// @inheritdoc IDiamondLoupe
  function facetAddress(bytes4 functionSelector) external view override returns (address) {
    return LibDiamond.layout().selectorToFacetAndPosition[functionSelector].facetAddress;
  }

  /// @inheritdoc IERC165
  function supportsInterface(bytes4 interfaceId) external view override returns (bool) {
    return LibDiamond.layout().supportedInterfaces[interfaceId];
  }
}
