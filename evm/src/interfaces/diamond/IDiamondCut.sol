// SPDX-License-Identifier: MIT
pragma solidity ^0.8.30;

/// ERC-2535 diamond cut interface.
interface IDiamondCut {
  /// Selector-table operation applied to one facet.
  enum FacetCutAction {
    Add,
    Replace,
    Remove
  }

  /// One facet's selector-table change.
  struct FacetCut {
    /// Facet receiving the selectors, or zero for `Remove`.
    address facetAddress;
    /// Operation to apply.
    FacetCutAction action;
    /// Selectors to add, replace, or remove.
    bytes4[] functionSelectors;
  }

  /// Emitted after every diamond cut.
  event DiamondCut(FacetCut[] diamondCut, address init, bytes calldata_);

  /// Adds, replaces, or removes selectors, then optionally delegatecalls `init` with `calldata_`.
  /// @param diamondCut Selector-table changes.
  /// @param init Initializer delegatecall target, or zero.
  /// @param calldata_ Initializer calldata, empty when `init` is zero.
  function diamondCut(FacetCut[] calldata diamondCut, address init, bytes calldata calldata_) external;
}
