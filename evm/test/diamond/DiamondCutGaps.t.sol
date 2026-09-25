// SPDX-License-Identifier: Apache 2
pragma solidity ^0.8.30;

import {LibDiamond} from 'src/diamond/LibDiamond.sol';
import {IDiamondCut} from 'src/interfaces/diamond/IDiamondCut.sol';
import {CbTestBase} from '../base/CbTestBase.sol';
import {TestFacet, TestFacetSelectors, TestFacetV2} from './TestFacet.sol';

contract BubblingInitializer {
  error CustomBubbledError(uint256 code);

  function boom(uint256 code) external pure {
    revert CustomBubbledError(code);
  }
}

contract DiamondCutGapsTest is CbTestBase {
  function test_RevertWhen_DiamondCut_ReplaceNoSelectors() public {
    TestFacet facet = new TestFacet();
    IDiamondCut.FacetCut[] memory cuts = new IDiamondCut.FacetCut[](1);
    cuts[0] = IDiamondCut.FacetCut({
      facetAddress: address(facet), action: IDiamondCut.FacetCutAction.Replace, functionSelectors: new bytes4[](0)
    });
    vm.expectRevert(LibDiamond.DiamondCutNoSelectors.selector);
    vm.prank(owner);
    cb.diamondCut(cuts, address(0), '');
  }

  function test_RevertWhen_DiamondCut_ReplaceZeroFacetAddress() public {
    IDiamondCut.FacetCut[] memory cuts = new IDiamondCut.FacetCut[](1);
    cuts[0] = IDiamondCut.FacetCut({
      facetAddress: address(0),
      action: IDiamondCut.FacetCutAction.Replace,
      functionSelectors: TestFacetSelectors.selectors()
    });
    vm.expectRevert(LibDiamond.DiamondCutInvalidFacetAddress.selector);
    vm.prank(owner);
    cb.diamondCut(cuts, address(0), '');
  }

  function test_RevertWhen_DiamondCut_ReplaceSameFacet() public {
    TestFacet facet = new TestFacet();
    IDiamondCut.FacetCut[] memory addCut = new IDiamondCut.FacetCut[](1);
    addCut[0] = IDiamondCut.FacetCut({
      facetAddress: address(facet),
      action: IDiamondCut.FacetCutAction.Add,
      functionSelectors: TestFacetSelectors.selectors()
    });
    vm.startPrank(owner);
    cb.diamondCut(addCut, address(0), '');

    IDiamondCut.FacetCut[] memory replaceCut = new IDiamondCut.FacetCut[](1);
    replaceCut[0] = IDiamondCut.FacetCut({
      facetAddress: address(facet),
      action: IDiamondCut.FacetCutAction.Replace,
      functionSelectors: TestFacetSelectors.selectors()
    });
    vm.expectRevert(
      abi.encodeWithSelector(LibDiamond.DiamondCutFunctionAlreadyExists.selector, TestFacet.facetValueA.selector)
    );
    cb.diamondCut(replaceCut, address(0), '');
    vm.stopPrank();
  }

  function test_RevertWhen_DiamondCut_RemoveNoSelectors() public {
    IDiamondCut.FacetCut[] memory cuts = new IDiamondCut.FacetCut[](1);
    cuts[0] = IDiamondCut.FacetCut({
      facetAddress: address(0), action: IDiamondCut.FacetCutAction.Remove, functionSelectors: new bytes4[](0)
    });
    vm.expectRevert(LibDiamond.DiamondCutNoSelectors.selector);
    vm.prank(owner);
    cb.diamondCut(cuts, address(0), '');
  }

  function test_DiamondCut_InitializerRevertBubbles() public {
    BubblingInitializer init = new BubblingInitializer();
    bytes memory data = abi.encodeCall(BubblingInitializer.boom, (uint256(7)));
    vm.expectRevert(abi.encodeWithSelector(BubblingInitializer.CustomBubbledError.selector, uint256(7)));
    vm.prank(owner);
    cb.diamondCut(new IDiamondCut.FacetCut[](0), address(init), data);
  }
}
