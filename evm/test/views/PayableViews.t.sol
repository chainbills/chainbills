// SPDX-License-Identifier: Apache 2
pragma solidity ^0.8.30;

import {ForeignPayableView, Payable, PayableForeign, PayableView} from 'src/types/CbTypes.sol';
import {CbTestBase} from '../base/CbTestBase.sol';

/// Every payable view on an empty diamond. Populated-state coverage lands once operation facets can create payables.
contract PayableViewsTest is CbTestBase {
  bytes32 private constant UNKNOWN_ID = keccak256('unknown-payable');
  bytes32 private constant UNKNOWN_CHAIN = keccak256('eip155:999');

  // ---------------------------------------------------------------------------
  // Local payables
  // ---------------------------------------------------------------------------

  function test_PayableExists_FalseWhenUnknown() public view {
    assertFalse(cb.payableExists(UNKNOWN_ID));
  }

  function test_IsPayableHost_FalseWhenUnknown() public view {
    assertFalse(cb.isPayableHost(UNKNOWN_ID, host));
  }

  function test_IsPayableHost_FalseForZeroAccountOnUnknownPayable() public view {
    assertFalse(cb.isPayableHost(UNKNOWN_ID, address(0)));
  }

  function test_GetPayable_ZeroWhenUnknown() public view {
    Payable memory info = cb.getPayable(UNKNOWN_ID);
    assertEq(info.host, address(0));
    assertEq(info.chainCount, 0);
  }

  function test_GetPayablesBulk_ZeroEntries() public view {
    bytes32[] memory ids = new bytes32[](2);
    ids[0] = UNKNOWN_ID;
    ids[1] = bytes32(uint256(1));
    Payable[] memory payables = cb.getPayablesBulk(ids);
    assertEq(payables.length, 2);
    assertEq(payables[0].host, address(0));
    assertEq(payables[1].host, address(0));
  }

  function test_GetPayableView_ZeroWhenUnknown() public view {
    PayableView memory view_ = cb.getPayableView(UNKNOWN_ID);
    assertEq(view_.payableId, UNKNOWN_ID);
    assertEq(view_.info.host, address(0));
    assertEq(view_.allowedTokensAndAmounts.length, 0);
    assertEq(view_.balances.length, 0);
  }

  function test_GetPayableViewsBulk_ZeroEntries() public view {
    bytes32[] memory ids = new bytes32[](1);
    ids[0] = UNKNOWN_ID;
    PayableView[] memory views = cb.getPayableViewsBulk(ids);
    assertEq(views.length, 1);
    assertEq(views[0].payableId, UNKNOWN_ID);
  }

  function test_GetAllowedTokensAndAmounts_EmptyWhenUnknown() public view {
    assertEq(cb.getAllowedTokensAndAmounts(UNKNOWN_ID).length, 0);
  }

  function test_GetBalances_EmptyWhenUnknown() public view {
    assertEq(cb.getBalances(UNKNOWN_ID).length, 0);
  }

  function test_GetBalance_ZeroWhenUnknown() public view {
    assertEq(cb.getBalance(UNKNOWN_ID, address(usdc)), 0);
  }

  function test_GetBalanceTokens_EmptyWhenUnknown() public view {
    assertEq(cb.getBalanceTokens(UNKNOWN_ID).length, 0);
  }

  function test_ChainPayables_EmptyOnEmptyDiamond() public view {
    assertEq(cb.getChainPayableCount(), 0);
    assertEq(cb.getChainPayableIds(0, 10).length, 0);
    assertEq(cb.getChainPayableIdsDesc(0, 10).length, 0);
    assertEq(cb.getChainPayables(0, 10).length, 0);
    assertEq(cb.getChainPayablesDesc(0, 10).length, 0);
  }

  function test_GetChainPayableIdAt_RevertsPastEnd() public {
    vm.expectRevert();
    cb.getChainPayableIdAt(0);
  }

  function test_UserPayables_EmptyOnEmptyDiamond() public view {
    assertEq(cb.getUserPayableCount(host), 0);
    assertEq(cb.getUserPayableIds(host, 0, 10).length, 0);
    assertEq(cb.getUserPayableIdsDesc(host, 0, 10).length, 0);
    assertEq(cb.getUserPayables(host, 0, 10).length, 0);
    assertEq(cb.getUserPayablesDesc(host, 0, 10).length, 0);
  }

  function test_GetUserPayableIdAt_RevertsPastEnd() public {
    vm.expectRevert();
    cb.getUserPayableIdAt(host, 0);
  }

  // ---------------------------------------------------------------------------
  // Foreign payables
  // ---------------------------------------------------------------------------

  function test_ForeignPayableExists_FalseWhenUnknown() public view {
    assertFalse(cb.foreignPayableExists(UNKNOWN_ID));
  }

  function test_GetForeignPayable_ZeroWhenUnknown() public view {
    PayableForeign memory info = cb.getForeignPayable(UNKNOWN_ID);
    assertEq(info.chainId, bytes32(0));
  }

  function test_GetForeignPayablesBulk_ZeroEntries() public view {
    bytes32[] memory ids = new bytes32[](1);
    ids[0] = UNKNOWN_ID;
    PayableForeign[] memory payables = cb.getForeignPayablesBulk(ids);
    assertEq(payables.length, 1);
    assertEq(payables[0].chainId, bytes32(0));
  }

  function test_GetForeignPayableView_ZeroWhenUnknown() public view {
    ForeignPayableView memory view_ = cb.getForeignPayableView(UNKNOWN_ID);
    assertEq(view_.payableId, UNKNOWN_ID);
    assertEq(view_.info.chainId, bytes32(0));
    assertEq(view_.allowedTokensAndAmounts.length, 0);
  }

  function test_GetForeignPayableViewsBulk_ZeroEntries() public view {
    bytes32[] memory ids = new bytes32[](1);
    ids[0] = UNKNOWN_ID;
    ForeignPayableView[] memory views = cb.getForeignPayableViewsBulk(ids);
    assertEq(views.length, 1);
    assertEq(views[0].payableId, UNKNOWN_ID);
  }

  function test_GetForeignPayableAllowedTokensAndAmounts_EmptyWhenUnknown() public view {
    assertEq(cb.getForeignPayableAllowedTokensAndAmounts(UNKNOWN_ID).length, 0);
  }

  function test_ChainForeignPayables_EmptyOnEmptyDiamond() public view {
    assertEq(cb.getChainForeignPayableCount(), 0);
    assertEq(cb.getChainForeignPayableIds(0, 10).length, 0);
    assertEq(cb.getChainForeignPayableIdsDesc(0, 10).length, 0);
    assertEq(cb.getChainForeignPayables(0, 10).length, 0);
    assertEq(cb.getChainForeignPayablesDesc(0, 10).length, 0);
  }

  function test_GetChainForeignPayableIdAt_RevertsPastEnd() public {
    vm.expectRevert();
    cb.getChainForeignPayableIdAt(0);
  }

  function test_ForeignPayablesByChain_EmptyOnEmptyDiamond() public view {
    assertEq(cb.getForeignPayableCountByChain(UNKNOWN_CHAIN), 0);
    assertEq(cb.getForeignPayableIdsByChain(UNKNOWN_CHAIN, 0, 10).length, 0);
    assertEq(cb.getForeignPayableIdsByChainDesc(UNKNOWN_CHAIN, 0, 10).length, 0);
    assertEq(cb.getForeignPayablesByChain(UNKNOWN_CHAIN, 0, 10).length, 0);
    assertEq(cb.getForeignPayablesByChainDesc(UNKNOWN_CHAIN, 0, 10).length, 0);
  }

  function test_GetForeignPayableIdByChainAt_RevertsPastEnd() public {
    vm.expectRevert();
    cb.getForeignPayableIdByChainAt(UNKNOWN_CHAIN, 0);
  }
}
