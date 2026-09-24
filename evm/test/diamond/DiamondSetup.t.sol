// SPDX-License-Identifier: Apache 2
pragma solidity ^0.8.30;

import {IAccessControl} from '@openzeppelin/contracts/access/IAccessControl.sol';
import {CbFacetSet} from 'src/CbFacetSet.sol';
import {IDiamondCut} from 'src/interfaces/diamond/IDiamondCut.sol';
import {IDiamondLoupe} from 'src/interfaces/diamond/IDiamondLoupe.sol';
import {CbTestBase} from '../base/CbTestBase.sol';

contract DiamondSetupTest is CbTestBase {
  function test_EveryFacetSelectorIsRouted() public view {
    CbFacetSet.FacetEntry[] memory entries = CbFacetSet.facets();
    IDiamondLoupe.Facet[] memory facets = cb.facets();
    // DiamondCutFacet plus every facet of the set.
    assertEq(facets.length, entries.length + 1);
    for (uint256 i; i < entries.length; i++) {
      address facet = cb.facetAddress(entries[i].selectors[0]);
      assertTrue(facet != address(0), entries[i].name);
      for (uint256 j; j < entries[i].selectors.length; j++) {
        assertEq(cb.facetAddress(entries[i].selectors[j]), facet, entries[i].name);
      }
    }
    assertTrue(cb.facetAddress(IDiamondCut.diamondCut.selector) != address(0));
  }

  function test_InitializerSetsOwnerRolesAndInterfaces() public view {
    assertEq(cb.owner(), owner);
    assertTrue(cb.hasRole(cb.DEFAULT_ADMIN_ROLE(), owner));
    assertTrue(cb.hasRole(cb.CONFIG_MANAGER_ROLE(), owner));
    assertFalse(cb.hasRole(cb.RELAYER_ROLE(), owner));
    assertTrue(cb.hasRole(cb.RELAYER_ROLE(), relayer));
    assertTrue(cb.supportsInterface(type(IAccessControl).interfaceId));
    assertTrue(cb.supportsInterface(type(IDiamondLoupe).interfaceId));
  }

  function test_RevertWhen_InitializerRunsTwice() public {
    address initializer = _initializer();
    bytes memory data = _initCalldata();
    vm.prank(owner);
    vm.expectRevert(AlreadyInitialized.selector);
    cb.diamondCut(new IDiamondCut.FacetCut[](0), initializer, data);
  }

  function test_ChainBLinksToChainA() public {
    _setUpChainB();
    assertTrue(chainA.cb.getRoleMemberCount(chainA.cb.DEFAULT_ADMIN_ROLE()) == 1);
  }

  function _initializer() private returns (address) {
    return address(new ChainbillsDiamondInitProxy());
  }

  function _initCalldata() private view returns (bytes memory) {
    return abi.encodeWithSignature(
      'init((bytes32,address,address,uint16,uint8))', keccak256('eip155:1'), owner, feeCollector, uint16(1), uint8(1)
    );
  }
}

import {ChainbillsDiamondInit} from 'src/ChainbillsDiamondInit.sol';

contract ChainbillsDiamondInitProxy is ChainbillsDiamondInit {}
