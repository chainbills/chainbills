// SPDX-License-Identifier: Apache 2
pragma solidity ^0.8.30;

import {CbFacetSet} from '../../src/CbFacetSet.sol';
import {CbLibrarySet} from './CbLibrarySet.sol';

/// Deploys and predicts the facets listed by `CbFacetSet`, linking whichever of the six libraries each one needs.
abstract contract CbFacetDeployer is CbLibrarySet {
  /// Deploys (or reuses) every facet in `CbFacetSet` order under `salt`, linked against `libs`.
  /// @param salt CREATE2 salt shared by every Chainbills deployment on this chain.
  /// @param libs The six linked libraries, addressed (see `_deployLibraries`).
  /// @return implementations Facet addresses, in `CbFacetSet` order.
  function _deployFacets(bytes32 salt, LinkedLibrary[] memory libs)
    internal
    returns (address[] memory implementations)
  {
    CbFacetSet.FacetEntry[] memory entries = CbFacetSet.facets();
    implementations = new address[](entries.length);
    for (uint256 i; i < entries.length; i++) {
      bytes memory code = _decode(_linkAllHex(_rawCodeHex(entries[i].name), libs));
      (implementations[i],) = _deployIfNeeded(salt, code, entries[i].name);
    }
  }

  /// Predicts every facet address in `CbFacetSet` order under `salt`, without deploying anything.
  /// @param salt CREATE2 salt shared by every Chainbills deployment on this chain.
  /// @param libs The six linked libraries, addressed (see `_predictLibraries`).
  /// @return implementations Predicted facet addresses, in `CbFacetSet` order.
  function _predictFacets(bytes32 salt, LinkedLibrary[] memory libs)
    internal
    view
    returns (address[] memory implementations)
  {
    CbFacetSet.FacetEntry[] memory entries = CbFacetSet.facets();
    implementations = new address[](entries.length);
    for (uint256 i; i < entries.length; i++) {
      bytes memory code = _decode(_linkAllHex(_rawCodeHex(entries[i].name), libs));
      implementations[i] = _predict(salt, code);
    }
  }
}
