// SPDX-License-Identifier: MIT
pragma solidity ^0.8.30;

/// ERC-2535 diamond loupe interface.
interface IDiamondLoupe {
  /// A facet and the selectors routed to it.
  struct Facet {
    address facetAddress;
    bytes4[] functionSelectors;
  }

  /// Returns every facet and its selectors.
  /// @return facets_ Facets with their selectors.
  function facets() external view returns (Facet[] memory facets_);

  /// Returns the selectors routed to `facet`.
  /// @param facet Facet address.
  /// @return facetFunctionSelectors_ Selectors routed to the facet.
  function facetFunctionSelectors(address facet) external view returns (bytes4[] memory facetFunctionSelectors_);

  /// Returns every facet address.
  /// @return facetAddresses_ Facet addresses.
  function facetAddresses() external view returns (address[] memory facetAddresses_);

  /// Returns the facet that serves `functionSelector`, or zero.
  /// @param functionSelector Selector to look up.
  /// @return facetAddress_ Facet address.
  function facetAddress(bytes4 functionSelector) external view returns (address facetAddress_);
}
