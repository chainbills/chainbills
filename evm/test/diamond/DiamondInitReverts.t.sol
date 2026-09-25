// SPDX-License-Identifier: Apache 2
pragma solidity ^0.8.30;

import {Test} from 'forge-std/Test.sol';
import {ChainbillsDiamondInit} from 'src/ChainbillsDiamondInit.sol';
import {Diamond} from 'src/diamond/Diamond.sol';
import {DiamondCutFacet} from 'src/diamond/DiamondCutFacet.sol';
import {ICbErrors} from 'src/interfaces/ICbErrors.sol';
import {IDiamondCut} from 'src/interfaces/diamond/IDiamondCut.sol';
import {MAX_BPS} from 'src/types/CbConstants.sol';

contract DiamondInitRevertsTest is Test, ICbErrors {
  address internal owner = makeAddr('owner');
  address internal admin = makeAddr('admin');
  address internal feeCollector = makeAddr('fee-collector');

  Diamond internal diamond;
  ChainbillsDiamondInit internal initializer;

  function setUp() public {
    vm.startPrank(owner);
    diamond = new Diamond(owner, address(new DiamondCutFacet()));
    initializer = new ChainbillsDiamondInit();
    vm.stopPrank();
  }

  function test_RevertWhen_Init_InvalidChainId() public {
    ChainbillsDiamondInit.InitParams memory params = ChainbillsDiamondInit.InitParams({
      cbChainId: bytes32(0), admin: admin, feeCollector: feeCollector, withdrawalFeeBps: 200, maxAllowedTokensAndAmounts: 20
    });
    vm.expectRevert(InvalidChainId.selector);
    vm.prank(owner);
    IDiamondCut(address(diamond))
      .diamondCut(new IDiamondCut.FacetCut[](0), address(initializer), abi.encodeCall(ChainbillsDiamondInit.init, (params)));
  }

  function test_RevertWhen_Init_InvalidAdminAddress() public {
    ChainbillsDiamondInit.InitParams memory params = ChainbillsDiamondInit.InitParams({
      cbChainId: keccak256('eip155:1'),
      admin: address(0),
      feeCollector: feeCollector,
      withdrawalFeeBps: 200,
      maxAllowedTokensAndAmounts: 20
    });
    vm.expectRevert(InvalidAddress.selector);
    vm.prank(owner);
    IDiamondCut(address(diamond))
      .diamondCut(new IDiamondCut.FacetCut[](0), address(initializer), abi.encodeCall(ChainbillsDiamondInit.init, (params)));
  }

  function test_RevertWhen_Init_InvalidFeeCollector() public {
    ChainbillsDiamondInit.InitParams memory params = ChainbillsDiamondInit.InitParams({
      cbChainId: keccak256('eip155:1'),
      admin: admin,
      feeCollector: address(0),
      withdrawalFeeBps: 200,
      maxAllowedTokensAndAmounts: 20
    });
    vm.expectRevert(InvalidFeeCollector.selector);
    vm.prank(owner);
    IDiamondCut(address(diamond))
      .diamondCut(new IDiamondCut.FacetCut[](0), address(initializer), abi.encodeCall(ChainbillsDiamondInit.init, (params)));
  }

  function test_RevertWhen_Init_InvalidFeeBps() public {
    uint16 tooHigh = MAX_BPS + 1;
    ChainbillsDiamondInit.InitParams memory params = ChainbillsDiamondInit.InitParams({
      cbChainId: keccak256('eip155:1'),
      admin: admin,
      feeCollector: feeCollector,
      withdrawalFeeBps: tooHigh,
      maxAllowedTokensAndAmounts: 20
    });
    vm.expectRevert(abi.encodeWithSelector(InvalidFeeBps.selector, tooHigh));
    vm.prank(owner);
    IDiamondCut(address(diamond))
      .diamondCut(new IDiamondCut.FacetCut[](0), address(initializer), abi.encodeCall(ChainbillsDiamondInit.init, (params)));
  }

  function test_RevertWhen_Init_InvalidMaxAllowedTokensAndAmounts() public {
    ChainbillsDiamondInit.InitParams memory params = ChainbillsDiamondInit.InitParams({
      cbChainId: keccak256('eip155:1'),
      admin: admin,
      feeCollector: feeCollector,
      withdrawalFeeBps: 200,
      maxAllowedTokensAndAmounts: 0
    });
    vm.expectRevert(InvalidMaxAllowedTokensAndAmounts.selector);
    vm.prank(owner);
    IDiamondCut(address(diamond))
      .diamondCut(new IDiamondCut.FacetCut[](0), address(initializer), abi.encodeCall(ChainbillsDiamondInit.init, (params)));
  }
}
