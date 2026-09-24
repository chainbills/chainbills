// SPDX-License-Identifier: Apache 2
pragma solidity ^0.8.30;

import {CbFacetSet} from 'src/CbFacetSet.sol';
import {ChainbillsDiamondInit} from 'src/ChainbillsDiamondInit.sol';
import {Diamond} from 'src/diamond/Diamond.sol';
import {DiamondCutFacet} from 'src/diamond/DiamondCutFacet.sol';
import {DiamondLoupeFacet} from 'src/diamond/DiamondLoupeFacet.sol';
import {OwnershipFacet} from 'src/diamond/OwnershipFacet.sol';
import {CbActivityViewsFacet} from 'src/facets/CbActivityViewsFacet.sol';
import {CbChainRegistryFacet} from 'src/facets/CbChainRegistryFacet.sol';
import {CbConfigFacet} from 'src/facets/CbConfigFacet.sol';
import {CbCoreViewsFacet} from 'src/facets/CbCoreViewsFacet.sol';
import {CbCrossChainViewsFacet} from 'src/facets/CbCrossChainViewsFacet.sol';
import {CbGovernanceFacet} from 'src/facets/CbGovernanceFacet.sol';
import {CbPayableSyncFacet} from 'src/facets/CbPayableSyncFacet.sol';
import {CbPayableViewsFacet} from 'src/facets/CbPayableViewsFacet.sol';
import {CbPayablesFacet} from 'src/facets/CbPayablesFacet.sol';
import {CbPaymentViewsFacet} from 'src/facets/CbPaymentViewsFacet.sol';
import {CbPaymentsFacet} from 'src/facets/CbPaymentsFacet.sol';
import {CbQuoteViewsFacet} from 'src/facets/CbQuoteViewsFacet.sol';
import {CbRegistryViewsFacet} from 'src/facets/CbRegistryViewsFacet.sol';
import {CbTokenRegistryFacet} from 'src/facets/CbTokenRegistryFacet.sol';
import {CbWithdrawalViewsFacet} from 'src/facets/CbWithdrawalViewsFacet.sol';
import {CbWithdrawalsFacet} from 'src/facets/CbWithdrawalsFacet.sol';
import {IChainbills} from 'src/interfaces/IChainbills.sol';
import {IDiamondCut} from 'src/interfaces/diamond/IDiamondCut.sol';

/// Deploys a fully cut and initialized Chainbills diamond. Must be called by (or pranked as) `owner`.
library CbDeployer {
  /// Deploys every facet in `CbFacetSet` order.
  /// @return implementations Facet addresses.
  function deployFacets() internal returns (address[] memory implementations) {
    implementations = new address[](18);
    implementations[0] = address(new DiamondLoupeFacet());
    implementations[1] = address(new OwnershipFacet());
    implementations[2] = address(new CbGovernanceFacet());
    implementations[3] = address(new CbConfigFacet());
    implementations[4] = address(new CbChainRegistryFacet());
    implementations[5] = address(new CbTokenRegistryFacet());
    implementations[6] = address(new CbPayablesFacet());
    implementations[7] = address(new CbPayableSyncFacet());
    implementations[8] = address(new CbPaymentsFacet());
    implementations[9] = address(new CbWithdrawalsFacet());
    implementations[10] = address(new CbCoreViewsFacet());
    implementations[11] = address(new CbRegistryViewsFacet());
    implementations[12] = address(new CbPayableViewsFacet());
    implementations[13] = address(new CbPaymentViewsFacet());
    implementations[14] = address(new CbWithdrawalViewsFacet());
    implementations[15] = address(new CbActivityViewsFacet());
    implementations[16] = address(new CbCrossChainViewsFacet());
    implementations[17] = address(new CbQuoteViewsFacet());
  }

  /// Deploys the diamond with `owner`, cuts every facet, and runs the initializer.
  /// @param owner Diamond owner; must be the current caller.
  /// @param params Initialization parameters.
  /// @return chainbills The diamond.
  function deploy(address owner, ChainbillsDiamondInit.InitParams memory params)
    internal
    returns (IChainbills chainbills)
  {
    Diamond diamond = new Diamond(owner, address(new DiamondCutFacet()));
    IDiamondCut.FacetCut[] memory cuts = CbFacetSet.buildAddCut(deployFacets());
    ChainbillsDiamondInit initializer = new ChainbillsDiamondInit();
    IDiamondCut(address(diamond))
      .diamondCut(cuts, address(initializer), abi.encodeCall(ChainbillsDiamondInit.init, (params)));
    chainbills = IChainbills(address(diamond));
  }
}
