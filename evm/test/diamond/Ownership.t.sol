// SPDX-License-Identifier: Apache 2
pragma solidity ^0.8.30;

import {Diamond} from 'src/diamond/Diamond.sol';
import {LibDiamond} from 'src/diamond/LibDiamond.sol';
import {IDiamondCut} from 'src/interfaces/diamond/IDiamondCut.sol';
import {CbTestBase} from '../base/CbTestBase.sol';
import {FailingInitializer, TestFacet, TestFacetSelectors, TestFacetV2} from './TestFacet.sol';

contract OwnershipTest is CbTestBase {
  address internal newOwner = makeAddr('new-owner');

  // ---------------------------------------------------------------------------
  // Two-step ownership
  // ---------------------------------------------------------------------------

  function test_TransferOwnership_TwoStepCompletesOnAccept() public {
    vm.expectEmit(true, true, true, true, address(cb));
    emit OwnershipTransferStarted(owner, newOwner);
    vm.prank(owner);
    cb.transferOwnership(newOwner);
    assertEq(cb.owner(), owner);
    assertEq(cb.pendingOwner(), newOwner);

    vm.prank(newOwner);
    cb.acceptOwnership();
    assertEq(cb.owner(), newOwner);
    assertEq(cb.pendingOwner(), address(0));
  }

  function test_TransferOwnership_ZeroCancelsPendingTransfer() public {
    vm.startPrank(owner);
    cb.transferOwnership(newOwner);
    cb.transferOwnership(address(0));
    vm.stopPrank();
    assertEq(cb.pendingOwner(), address(0));

    vm.expectRevert(abi.encodeWithSelector(NotPendingOwner.selector, newOwner));
    vm.prank(newOwner);
    cb.acceptOwnership();
  }

  function test_RevertWhen_TransferOwnership_CallerNotOwner() public {
    vm.expectRevert(abi.encodeWithSelector(NotContractOwner.selector, stranger));
    vm.prank(stranger);
    cb.transferOwnership(newOwner);
  }

  function test_RevertWhen_AcceptOwnership_CallerNotPendingOwner() public {
    vm.prank(owner);
    cb.transferOwnership(newOwner);
    vm.expectRevert(abi.encodeWithSelector(NotPendingOwner.selector, stranger));
    vm.prank(stranger);
    cb.acceptOwnership();
  }

  // ---------------------------------------------------------------------------
  // Only owner cuts
  // ---------------------------------------------------------------------------

  function test_RevertWhen_DiamondCut_CallerNotOwner() public {
    vm.expectRevert(abi.encodeWithSelector(NotContractOwner.selector, stranger));
    vm.prank(stranger);
    cb.diamondCut(new IDiamondCut.FacetCut[](0), address(0), '');
  }

  // ---------------------------------------------------------------------------
  // Add / replace / remove
  // ---------------------------------------------------------------------------

  function test_DiamondCut_AddsTestFacetSelectors() public {
    TestFacet facet = new TestFacet();
    IDiamondCut.FacetCut[] memory cuts = new IDiamondCut.FacetCut[](1);
    cuts[0] = IDiamondCut.FacetCut({
      facetAddress: address(facet),
      action: IDiamondCut.FacetCutAction.Add,
      functionSelectors: TestFacetSelectors.selectors()
    });
    vm.prank(owner);
    cb.diamondCut(cuts, address(0), '');
    assertEq(TestFacet(address(cb)).testFacetValue(), 42);
    assertEq(cb.facetAddress(TestFacet.testFacetValue.selector), address(facet));
  }

  function test_DiamondCut_ReplacesTestFacetSelectors() public {
    TestFacet facet = new TestFacet();
    TestFacetV2 facetV2 = new TestFacetV2();
    IDiamondCut.FacetCut[] memory addCut = new IDiamondCut.FacetCut[](1);
    addCut[0] = IDiamondCut.FacetCut({
      facetAddress: address(facet),
      action: IDiamondCut.FacetCutAction.Add,
      functionSelectors: TestFacetSelectors.selectors()
    });
    vm.prank(owner);
    cb.diamondCut(addCut, address(0), '');

    IDiamondCut.FacetCut[] memory replaceCut = new IDiamondCut.FacetCut[](1);
    replaceCut[0] = IDiamondCut.FacetCut({
      facetAddress: address(facetV2),
      action: IDiamondCut.FacetCutAction.Replace,
      functionSelectors: TestFacetSelectors.selectors()
    });
    vm.prank(owner);
    cb.diamondCut(replaceCut, address(0), '');
    assertEq(TestFacet(address(cb)).testFacetValue(), 99);
  }

  function test_DiamondCut_RemovesTestFacetSelectors() public {
    TestFacet facet = new TestFacet();
    IDiamondCut.FacetCut[] memory addCut = new IDiamondCut.FacetCut[](1);
    addCut[0] = IDiamondCut.FacetCut({
      facetAddress: address(facet),
      action: IDiamondCut.FacetCutAction.Add,
      functionSelectors: TestFacetSelectors.selectors()
    });
    vm.prank(owner);
    cb.diamondCut(addCut, address(0), '');

    IDiamondCut.FacetCut[] memory removeCut = new IDiamondCut.FacetCut[](1);
    removeCut[0] = IDiamondCut.FacetCut({
      facetAddress: address(0),
      action: IDiamondCut.FacetCutAction.Remove,
      functionSelectors: TestFacetSelectors.selectors()
    });
    vm.prank(owner);
    cb.diamondCut(removeCut, address(0), '');

    vm.expectRevert(abi.encodeWithSelector(Diamond.FunctionNotFound.selector, TestFacet.testFacetValue.selector));
    TestFacet(address(cb)).testFacetValue();
    assertEq(cb.facetAddress(TestFacet.testFacetValue.selector), address(0));
  }

  // ---------------------------------------------------------------------------
  // Invalid cuts
  // ---------------------------------------------------------------------------

  function test_RevertWhen_DiamondCut_FacetHasNoCode() public {
    IDiamondCut.FacetCut[] memory cuts = new IDiamondCut.FacetCut[](1);
    cuts[0] = IDiamondCut.FacetCut({
      facetAddress: address(0xdead),
      action: IDiamondCut.FacetCutAction.Add,
      functionSelectors: TestFacetSelectors.selectors()
    });
    vm.expectRevert(abi.encodeWithSelector(LibDiamond.DiamondCutFacetHasNoCode.selector, address(0xdead)));
    vm.prank(owner);
    cb.diamondCut(cuts, address(0), '');
  }

  function test_RevertWhen_DiamondCut_AddExistingSelector() public {
    TestFacet facet = new TestFacet();
    IDiamondCut.FacetCut[] memory cuts = new IDiamondCut.FacetCut[](1);
    cuts[0] = IDiamondCut.FacetCut({
      facetAddress: address(facet),
      action: IDiamondCut.FacetCutAction.Add,
      functionSelectors: TestFacetSelectors.selectors()
    });
    vm.startPrank(owner);
    cb.diamondCut(cuts, address(0), '');
    vm.expectRevert(
      abi.encodeWithSelector(LibDiamond.DiamondCutFunctionAlreadyExists.selector, TestFacet.testFacetValue.selector)
    );
    cb.diamondCut(cuts, address(0), '');
    vm.stopPrank();
  }

  function test_RevertWhen_DiamondCut_ReplaceUnroutedSelector() public {
    TestFacetV2 facetV2 = new TestFacetV2();
    IDiamondCut.FacetCut[] memory cuts = new IDiamondCut.FacetCut[](1);
    cuts[0] = IDiamondCut.FacetCut({
      facetAddress: address(facetV2),
      action: IDiamondCut.FacetCutAction.Replace,
      functionSelectors: TestFacetSelectors.selectors()
    });
    vm.expectRevert(
      abi.encodeWithSelector(LibDiamond.DiamondCutFunctionDoesNotExist.selector, TestFacet.testFacetValue.selector)
    );
    vm.prank(owner);
    cb.diamondCut(cuts, address(0), '');
  }

  function test_RevertWhen_DiamondCut_RemoveUnroutedSelector() public {
    IDiamondCut.FacetCut[] memory cuts = new IDiamondCut.FacetCut[](1);
    cuts[0] = IDiamondCut.FacetCut({
      facetAddress: address(0),
      action: IDiamondCut.FacetCutAction.Remove,
      functionSelectors: TestFacetSelectors.selectors()
    });
    vm.expectRevert(
      abi.encodeWithSelector(LibDiamond.DiamondCutFunctionDoesNotExist.selector, TestFacet.testFacetValue.selector)
    );
    vm.prank(owner);
    cb.diamondCut(cuts, address(0), '');
  }

  function test_RevertWhen_DiamondCut_AddZeroFacetAddress() public {
    IDiamondCut.FacetCut[] memory cuts = new IDiamondCut.FacetCut[](1);
    cuts[0] = IDiamondCut.FacetCut({
      facetAddress: address(0),
      action: IDiamondCut.FacetCutAction.Add,
      functionSelectors: TestFacetSelectors.selectors()
    });
    vm.expectRevert(LibDiamond.DiamondCutInvalidFacetAddress.selector);
    vm.prank(owner);
    cb.diamondCut(cuts, address(0), '');
  }

  function test_RevertWhen_DiamondCut_RemoveWithNonZeroFacetAddress() public {
    TestFacet facet = new TestFacet();
    IDiamondCut.FacetCut[] memory addCut = new IDiamondCut.FacetCut[](1);
    addCut[0] = IDiamondCut.FacetCut({
      facetAddress: address(facet),
      action: IDiamondCut.FacetCutAction.Add,
      functionSelectors: TestFacetSelectors.selectors()
    });
    vm.startPrank(owner);
    cb.diamondCut(addCut, address(0), '');

    IDiamondCut.FacetCut[] memory removeCut = new IDiamondCut.FacetCut[](1);
    removeCut[0] = IDiamondCut.FacetCut({
      facetAddress: address(facet),
      action: IDiamondCut.FacetCutAction.Remove,
      functionSelectors: TestFacetSelectors.selectors()
    });
    vm.expectRevert(LibDiamond.DiamondCutInvalidFacetAddress.selector);
    cb.diamondCut(removeCut, address(0), '');
    vm.stopPrank();
  }

  function test_RevertWhen_DiamondCut_NoSelectors() public {
    TestFacet facet = new TestFacet();
    IDiamondCut.FacetCut[] memory cuts = new IDiamondCut.FacetCut[](1);
    cuts[0] = IDiamondCut.FacetCut({
      facetAddress: address(facet), action: IDiamondCut.FacetCutAction.Add, functionSelectors: new bytes4[](0)
    });
    vm.expectRevert(LibDiamond.DiamondCutNoSelectors.selector);
    vm.prank(owner);
    cb.diamondCut(cuts, address(0), '');
  }

  function test_RevertWhen_DiamondCut_ImmutableFunctionOnRemove() public {
    // Route a fresh selector to the diamond's own address, then try to remove it.
    bytes4 selfSelector = bytes4(keccak256('selfRoutedSelector()'));
    bytes4[] memory selectors = new bytes4[](1);
    selectors[0] = selfSelector;
    IDiamondCut.FacetCut[] memory addCut = new IDiamondCut.FacetCut[](1);
    addCut[0] = IDiamondCut.FacetCut({
      facetAddress: address(cb), action: IDiamondCut.FacetCutAction.Add, functionSelectors: selectors
    });
    vm.startPrank(owner);
    cb.diamondCut(addCut, address(0), '');

    IDiamondCut.FacetCut[] memory removeCut = new IDiamondCut.FacetCut[](1);
    removeCut[0] = IDiamondCut.FacetCut({
      facetAddress: address(0), action: IDiamondCut.FacetCutAction.Remove, functionSelectors: selectors
    });
    vm.expectRevert(abi.encodeWithSelector(LibDiamond.DiamondCutImmutableFunction.selector, selfSelector));
    cb.diamondCut(removeCut, address(0), '');
    vm.stopPrank();
  }

  function test_RevertWhen_DiamondCut_InitAddressHasNoCode() public {
    vm.expectRevert(abi.encodeWithSelector(LibDiamond.DiamondCutInitAddressHasNoCode.selector, address(0xdead)));
    vm.prank(owner);
    cb.diamondCut(new IDiamondCut.FacetCut[](0), address(0xdead), 'x');
  }

  function test_RevertWhen_DiamondCut_InitCalldataWithoutInitAddress() public {
    vm.expectRevert(LibDiamond.DiamondCutInvalidInitCalldata.selector);
    vm.prank(owner);
    cb.diamondCut(new IDiamondCut.FacetCut[](0), address(0), 'x');
  }

  function test_RevertWhen_DiamondCut_InitReverts() public {
    FailingInitializer initializer = new FailingInitializer();
    vm.expectRevert(
      abi.encodeWithSelector(
        LibDiamond.DiamondCutInitFailed.selector, address(initializer), abi.encodeCall(FailingInitializer.fail, ())
      )
    );
    vm.prank(owner);
    cb.diamondCut(new IDiamondCut.FacetCut[](0), address(initializer), abi.encodeCall(FailingInitializer.fail, ()));
  }

  // ---------------------------------------------------------------------------
  // Fallback behaviour
  // ---------------------------------------------------------------------------

  function test_RevertWhen_UnknownSelector() public {
    (bool success, bytes memory data) = address(cb).call(abi.encodeWithSelector(bytes4(0xdeadbeef)));
    assertFalse(success);
    assertEq(bytes4(data), Diamond.FunctionNotFound.selector);
  }

  function test_RevertWhen_PlainNativeTransfer() public {
    vm.deal(address(this), 1 ether);
    (bool success, bytes memory data) = payable(address(cb)).call{value: 1 ether}('');
    assertFalse(success);
    assertEq(bytes4(data), Diamond.FunctionNotFound.selector);
  }
}
