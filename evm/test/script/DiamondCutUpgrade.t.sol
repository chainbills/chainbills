// SPDX-License-Identifier: Apache 2
pragma solidity ^0.8.30;

import {Test} from 'forge-std/Test.sol';
import {ChainbillsDiamondInit} from '../../src/ChainbillsDiamondInit.sol';
import {DeployChainbills} from '../../script/DeployChainbills.s.sol';
import {DiamondCutUpgrade} from '../../script/DiamondCutUpgrade.s.sol';
import {ICbOwnership} from '../../src/interfaces/ICbOwnership.sol';
import {IChainbills} from '../../src/interfaces/IChainbills.sol';
import {IDiamondCut} from '../../src/interfaces/diamond/IDiamondCut.sol';
import {IERC173} from '../../src/interfaces/diamond/IERC173.sol';

/// Runs `DiamondCutUpgrade.upgrade` in-process against a diamond whose `OwnershipFacet` routing is deliberately
/// stale, and checks the Add/Replace/Remove cut it produces.
contract DiamondCutUpgradeTest is Test {
  bytes32 internal constant DEPLOY_SALT = bytes32(uint256(1));
  bytes32 internal constant UPGRADE_SALT = bytes32(uint256(101));
  address internal owner;
  IChainbills internal chainbills;

  function setUp() public {
    owner = DEFAULT_SENDER;
    chainbills = new DeployChainbills().deploy(
      DeployChainbills.DeployConfig({
        salt: DEPLOY_SALT,
        owner: owner,
        caip2: 'eip155:31337',
        chainName: 'test-fixture-chain',
        params: ChainbillsDiamondInit.InitParams({
          cbChainId: keccak256(bytes('eip155:31337')),
          admin: owner,
          feeCollector: owner,
          withdrawalFeeBps: 200,
          maxAllowedTokensAndAmounts: 10
        }),
        tokenMessenger: address(0),
        wormhole: address(0),
        wormholeChainId: 0,
        wormholeFinality: 0,
        allowedTokens: new address[](0),
        relayers: new address[](0),
        deployRecordPath: ''
      })
    );
  }

  function test_Upgrade_ProducesAddReplaceRemove() public {
    address staleImpl = chainbills.facetAddress(IERC173.owner.selector);

    // Make the currently-cut OwnershipFacet stale, relative to what CbFacetSet (this branch's source) declares:
    // drop `transferOwnership` (something the upgrade must Add back) and cut in a selector no real facet declares
    // (something the upgrade must Remove).
    bytes4 fakeSelector = bytes4(keccak256('fakeRemovedFunction()'));
    bytes4[] memory removeTransferOwnership = new bytes4[](1);
    removeTransferOwnership[0] = IERC173.transferOwnership.selector;
    bytes4[] memory addFake = new bytes4[](1);
    addFake[0] = fakeSelector;

    IDiamondCut.FacetCut[] memory staleCuts = new IDiamondCut.FacetCut[](2);
    staleCuts[0] = IDiamondCut.FacetCut(address(0), IDiamondCut.FacetCutAction.Remove, removeTransferOwnership);
    staleCuts[1] = IDiamondCut.FacetCut(staleImpl, IDiamondCut.FacetCutAction.Add, addFake);
    vm.prank(owner);
    IDiamondCut(address(chainbills)).diamondCut(staleCuts, address(0), '');

    assertEq(chainbills.facetAddress(IERC173.transferOwnership.selector), address(0));
    assertEq(chainbills.facetAddress(fakeSelector), staleImpl);

    string[] memory facetNames = new string[](1);
    facetNames[0] = 'OwnershipFacet';
    new DiamondCutUpgrade().upgrade(
      DiamondCutUpgrade.UpgradeConfig({salt: UPGRADE_SALT, diamond: address(chainbills), facetNames: facetNames, dryRun: false})
    );

    address freshImpl = chainbills.facetAddress(IERC173.owner.selector);
    assertTrue(freshImpl != staleImpl, 'OwnershipFacet should have moved to a new implementation');

    // Replace: selectors that carried over now point at the fresh implementation.
    assertEq(chainbills.facetAddress(ICbOwnership.pendingOwner.selector), freshImpl);
    assertEq(chainbills.facetAddress(ICbOwnership.acceptOwnership.selector), freshImpl);
    assertEq(chainbills.facetAddress(IERC173.owner.selector), freshImpl);

    // Add: the selector this diamond was missing is now routed, to the fresh implementation.
    assertEq(chainbills.facetAddress(IERC173.transferOwnership.selector), freshImpl);

    // Remove: the selector no current facet declares is gone.
    assertEq(chainbills.facetAddress(fakeSelector), address(0));

    // The upgrade still works end to end.
    address newOwner = makeAddr('new-owner');
    vm.prank(owner);
    IERC173(address(chainbills)).transferOwnership(newOwner);
    vm.prank(newOwner);
    ICbOwnership(address(chainbills)).acceptOwnership();
    assertEq(IERC173(address(chainbills)).owner(), newOwner);
  }

  function test_Upgrade_NothingToCutWhenAlreadyCurrent() public {
    string[] memory facetNames = new string[](1);
    facetNames[0] = 'OwnershipFacet';
    address before = chainbills.facetAddress(IERC173.owner.selector);
    // Same salt as the original deploy: the "new" implementation is exactly what is already cut, so there is
    // nothing to Add, Replace, or Remove.
    new DiamondCutUpgrade().upgrade(
      DiamondCutUpgrade.UpgradeConfig({salt: DEPLOY_SALT, diamond: address(chainbills), facetNames: facetNames, dryRun: false})
    );
    assertEq(chainbills.facetAddress(IERC173.owner.selector), before);
  }
}
