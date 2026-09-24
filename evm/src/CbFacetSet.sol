// SPDX-License-Identifier: Apache 2
pragma solidity ^0.8.30;

import {IDiamondCut} from './interfaces/diamond/IDiamondCut.sol';
import {CbActivityViewsFacetSelectors} from './selectors/CbActivityViewsFacetSelectors.sol';
import {CbChainRegistryFacetSelectors} from './selectors/CbChainRegistryFacetSelectors.sol';
import {CbConfigFacetSelectors} from './selectors/CbConfigFacetSelectors.sol';
import {CbCoreViewsFacetSelectors} from './selectors/CbCoreViewsFacetSelectors.sol';
import {CbCrossChainViewsFacetSelectors} from './selectors/CbCrossChainViewsFacetSelectors.sol';
import {CbGovernanceFacetSelectors} from './selectors/CbGovernanceFacetSelectors.sol';
import {CbPayableSyncFacetSelectors} from './selectors/CbPayableSyncFacetSelectors.sol';
import {CbPayableViewsFacetSelectors} from './selectors/CbPayableViewsFacetSelectors.sol';
import {CbPayablesFacetSelectors} from './selectors/CbPayablesFacetSelectors.sol';
import {CbPaymentViewsFacetSelectors} from './selectors/CbPaymentViewsFacetSelectors.sol';
import {CbPaymentsFacetSelectors} from './selectors/CbPaymentsFacetSelectors.sol';
import {CbQuoteViewsFacetSelectors} from './selectors/CbQuoteViewsFacetSelectors.sol';
import {CbRegistryViewsFacetSelectors} from './selectors/CbRegistryViewsFacetSelectors.sol';
import {CbTokenRegistryFacetSelectors} from './selectors/CbTokenRegistryFacetSelectors.sol';
import {CbWithdrawalViewsFacetSelectors} from './selectors/CbWithdrawalViewsFacetSelectors.sol';
import {CbWithdrawalsFacetSelectors} from './selectors/CbWithdrawalsFacetSelectors.sol';
import {DiamondLoupeFacetSelectors} from './selectors/DiamondLoupeFacetSelectors.sol';
import {OwnershipFacetSelectors} from './selectors/OwnershipFacetSelectors.sol';

/// Canonical ordered list of facets installed by the first diamond cut. `DiamondCutFacet` is installed by the
/// diamond constructor and is not listed.
library CbFacetSet {
  /// The number of implementations differs from the number of facets.
  error FacetCountMismatch(uint256 expected, uint256 actual);

  /// One facet of the set.
  struct FacetEntry {
    /// Contract name, also the artifact name used by deploy tooling.
    string name;
    /// Selectors routed to the facet.
    bytes4[] selectors;
  }

  /// Returns the facets in deployment order.
  /// @return entries Facet names and selectors.
  function facets() internal pure returns (FacetEntry[] memory entries) {
    entries = new FacetEntry[](18);
    entries[0] = FacetEntry('DiamondLoupeFacet', DiamondLoupeFacetSelectors.selectors());
    entries[1] = FacetEntry('OwnershipFacet', OwnershipFacetSelectors.selectors());
    entries[2] = FacetEntry('CbGovernanceFacet', CbGovernanceFacetSelectors.selectors());
    entries[3] = FacetEntry('CbConfigFacet', CbConfigFacetSelectors.selectors());
    entries[4] = FacetEntry('CbChainRegistryFacet', CbChainRegistryFacetSelectors.selectors());
    entries[5] = FacetEntry('CbTokenRegistryFacet', CbTokenRegistryFacetSelectors.selectors());
    entries[6] = FacetEntry('CbPayablesFacet', CbPayablesFacetSelectors.selectors());
    entries[7] = FacetEntry('CbPayableSyncFacet', CbPayableSyncFacetSelectors.selectors());
    entries[8] = FacetEntry('CbPaymentsFacet', CbPaymentsFacetSelectors.selectors());
    entries[9] = FacetEntry('CbWithdrawalsFacet', CbWithdrawalsFacetSelectors.selectors());
    entries[10] = FacetEntry('CbCoreViewsFacet', CbCoreViewsFacetSelectors.selectors());
    entries[11] = FacetEntry('CbRegistryViewsFacet', CbRegistryViewsFacetSelectors.selectors());
    entries[12] = FacetEntry('CbPayableViewsFacet', CbPayableViewsFacetSelectors.selectors());
    entries[13] = FacetEntry('CbPaymentViewsFacet', CbPaymentViewsFacetSelectors.selectors());
    entries[14] = FacetEntry('CbWithdrawalViewsFacet', CbWithdrawalViewsFacetSelectors.selectors());
    entries[15] = FacetEntry('CbActivityViewsFacet', CbActivityViewsFacetSelectors.selectors());
    entries[16] = FacetEntry('CbCrossChainViewsFacet', CbCrossChainViewsFacetSelectors.selectors());
    entries[17] = FacetEntry('CbQuoteViewsFacet', CbQuoteViewsFacetSelectors.selectors());
  }

  /// Builds the `Add` cut for `implementations`, given in `facets()` order.
  /// @param implementations Deployed facet addresses.
  /// @return cuts Diamond cut.
  function buildAddCut(address[] memory implementations) internal pure returns (IDiamondCut.FacetCut[] memory cuts) {
    FacetEntry[] memory entries = facets();
    if (implementations.length != entries.length) revert FacetCountMismatch(entries.length, implementations.length);
    cuts = new IDiamondCut.FacetCut[](entries.length);
    for (uint256 i; i < entries.length; i++) {
      cuts[i] = IDiamondCut.FacetCut({
        facetAddress: implementations[i],
        action: IDiamondCut.FacetCutAction.Add,
        functionSelectors: entries[i].selectors
      });
    }
  }
}
