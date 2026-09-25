// SPDX-License-Identifier: Apache 2
pragma solidity ^0.8.30;

import {Test} from 'forge-std/Test.sol';
import {CbFacetSet} from 'src/CbFacetSet.sol';
import {Diamond} from 'src/diamond/Diamond.sol';
import {DiamondCutFacet} from 'src/diamond/DiamondCutFacet.sol';
import {IDiamondCut} from 'src/interfaces/diamond/IDiamondCut.sol';
import {CbTestBase} from '../base/CbTestBase.sol';

contract DiamondConstructorTest is Test {
  function test_RevertWhen_Constructor_ZeroOwner() public {
    address cut = address(new DiamondCutFacet());
    vm.expectRevert(Diamond.ZeroOwner.selector);
    new Diamond(address(0), cut);
  }
}

contract DiamondLoupeGettersTest is CbTestBase {
  function test_FacetAddressesReturnsAllFacets() public view {
    address[] memory addrs = cb.facetAddresses();
    // DiamondCutFacet plus every facet of the set.
    assertEq(addrs.length, CbFacetSet.facets().length + 1);
    for (uint256 i; i < addrs.length; i++) {
      assertTrue(addrs[i] != address(0));
    }
  }

  function test_FacetFunctionSelectorsReturnsRoutedSelectors() public view {
    CbFacetSet.FacetEntry[] memory entries = CbFacetSet.facets();
    for (uint256 i; i < entries.length; i++) {
      address facet = cb.facetAddress(entries[i].selectors[0]);
      bytes4[] memory routed = cb.facetFunctionSelectors(facet);
      assertEq(routed.length, entries[i].selectors.length, entries[i].name);
      for (uint256 j; j < entries[i].selectors.length; j++) {
        bool found;
        for (uint256 k; k < routed.length; k++) {
          if (routed[k] == entries[i].selectors[j]) {
            found = true;
            break;
          }
        }
        assertTrue(found, entries[i].name);
      }
    }
  }

  function test_FacetFunctionSelectorsUnknownFacetReturnsEmpty() public {
    address unknown = makeAddr('unknown-facet');
    bytes4[] memory routed = cb.facetFunctionSelectors(unknown);
    assertEq(routed.length, 0);
  }
}

/// Wraps the internal library so its revert can be caught by `vm.expectRevert`.
contract CbFacetSetHarness {
  function buildAddCut(address[] memory implementations) external pure returns (IDiamondCut.FacetCut[] memory) {
    return CbFacetSet.buildAddCut(implementations);
  }
}

contract CbFacetSetTest is Test {
  CbFacetSetHarness internal harness;

  function setUp() public {
    harness = new CbFacetSetHarness();
  }

  function test() public {}

  function test_RevertWhen_BuildAddCut_FacetCountMismatch() public {
    address[] memory implementations = new address[](0);
    CbFacetSet.FacetEntry[] memory entries = CbFacetSet.facets();
    vm.expectRevert(abi.encodeWithSelector(CbFacetSet.FacetCountMismatch.selector, entries.length, uint256(0)));
    harness.buildAddCut(implementations);
  }

  function test_BuildAddCut_MatchingLengthSucceeds() public view {
    CbFacetSet.FacetEntry[] memory entries = CbFacetSet.facets();
    address[] memory implementations = new address[](entries.length);
    for (uint256 i; i < entries.length; i++) {
      implementations[i] = address(uint160(i + 1));
    }
    IDiamondCut.FacetCut[] memory cuts = harness.buildAddCut(implementations);
    assertEq(cuts.length, entries.length);
    for (uint256 i; i < entries.length; i++) {
      assertEq(cuts[i].facetAddress, implementations[i]);
    }
  }
}
