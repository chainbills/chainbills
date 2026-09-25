// SPDX-License-Identifier: Apache 2
pragma solidity ^0.8.30;

import {
  PAYABLE_ACTION_CLOSE,
  PAYABLE_ACTION_CREATE,
  PAYABLE_ACTION_REOPEN,
  PAYABLE_ACTION_UPDATE_ALLOWED_TOKENS_AND_AMOUNTS
} from 'src/types/CbConstants.sol';
import {TokenAndAmountForeign} from 'src/types/CbTypes.sol';
import {CbTestBase} from '../base/CbTestBase.sol';

/// Exercises the applyUpdate branches inside CbPayableSync via the admin sync facet path.
contract PayableSyncApplyTest is CbTestBase {
  bytes32 internal foreignPayableId = keccak256('foreign-payable');

  function setUp() public override {
    super.setUp();
    _setUpChainB();
  }

  function _list() internal pure returns (TokenAndAmountForeign[] memory) {
    return new TokenAndAmountForeign[](0);
  }

  function test_RevertWhen_AdminSync_ZeroPayableId() public {
    TokenAndAmountForeign[] memory list = _list();
    vm.expectRevert(InvalidPayableId.selector);
    vm.prank(owner);
    chainB.cb.adminSyncForeignPayable(bytes32(0), chainA.cbChainId, 1, uint64(block.timestamp), PAYABLE_ACTION_CREATE, false, list);
  }

  function test_AdminSync_CloseBranchAppliesIsClosed() public {
    TokenAndAmountForeign[] memory list = _list();
    vm.startPrank(owner);
    // First seed the payable so subsequent updates carry it through.
    chainB.cb
      .adminSyncForeignPayable(foreignPayableId, chainA.cbChainId, 1, uint64(block.timestamp), PAYABLE_ACTION_CREATE, false, list);
    // Now apply the close branch (action 2).
    chainB.cb
      .adminSyncForeignPayable(foreignPayableId, chainA.cbChainId, 2, uint64(block.timestamp), PAYABLE_ACTION_CLOSE, true, list);
    vm.stopPrank();
    assertTrue(chainB.cb.getForeignPayable(foreignPayableId).isClosed);
  }

  function test_AdminSync_ReopenBranchClearsIsClosed() public {
    TokenAndAmountForeign[] memory list = _list();
    vm.startPrank(owner);
    chainB.cb
      .adminSyncForeignPayable(foreignPayableId, chainA.cbChainId, 1, uint64(block.timestamp), PAYABLE_ACTION_CREATE, true, list);
    chainB.cb
      .adminSyncForeignPayable(foreignPayableId, chainA.cbChainId, 2, uint64(block.timestamp), PAYABLE_ACTION_REOPEN, false, list);
    vm.stopPrank();
    assertFalse(chainB.cb.getForeignPayable(foreignPayableId).isClosed);
  }

  function test_AdminSync_UpdateAllowedTokensBranch() public {
    TokenAndAmountForeign[] memory empty = _list();
    TokenAndAmountForeign[] memory list = new TokenAndAmountForeign[](2);
    list[0] = TokenAndAmountForeign(bytes32(uint256(1)), 10);
    list[1] = TokenAndAmountForeign(bytes32(uint256(2)), 20);
    vm.startPrank(owner);
    chainB.cb
      .adminSyncForeignPayable(foreignPayableId, chainA.cbChainId, 1, uint64(block.timestamp), PAYABLE_ACTION_CREATE, false, empty);
    chainB.cb
      .adminSyncForeignPayable(
        foreignPayableId,
        chainA.cbChainId,
        2,
        uint64(block.timestamp),
        PAYABLE_ACTION_UPDATE_ALLOWED_TOKENS_AND_AMOUNTS,
        false,
        list
      );
    vm.stopPrank();
    assertEq(chainB.cb.getForeignPayable(foreignPayableId).allowedTokensAndAmountsCount, 2);
  }
}
