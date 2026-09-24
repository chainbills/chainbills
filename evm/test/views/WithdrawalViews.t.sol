// SPDX-License-Identifier: Apache 2
pragma solidity ^0.8.30;

import {Withdrawal} from 'src/types/CbTypes.sol';
import {CbTestBase} from '../base/CbTestBase.sol';

/// Every withdrawal view on an empty diamond. Populated-state coverage lands once operation facets can withdraw.
contract WithdrawalViewsTest is CbTestBase {
  bytes32 private constant UNKNOWN_ID = keccak256('unknown-withdrawal');
  bytes32 private constant UNKNOWN_PAYABLE = keccak256('unknown-payable');

  function test_GetWithdrawal_ZeroWhenUnknown() public view {
    Withdrawal memory withdrawal = cb.getWithdrawal(UNKNOWN_ID);
    assertEq(withdrawal.host, address(0));
    assertEq(withdrawal.payableId, bytes32(0));
  }

  function test_GetWithdrawalsBulk_ZeroEntries() public view {
    bytes32[] memory ids = new bytes32[](1);
    ids[0] = UNKNOWN_ID;
    Withdrawal[] memory withdrawals = cb.getWithdrawalsBulk(ids);
    assertEq(withdrawals.length, 1);
    assertEq(withdrawals[0].host, address(0));
  }

  function test_ChainWithdrawals_EmptyOnEmptyDiamond() public view {
    assertEq(cb.getChainWithdrawalCount(), 0);
    assertEq(cb.getChainWithdrawalIds(0, 10).length, 0);
    assertEq(cb.getChainWithdrawalIdsDesc(0, 10).length, 0);
    (bytes32[] memory ids, Withdrawal[] memory items) = cb.getChainWithdrawals(0, 10);
    assertEq(ids.length, 0);
    assertEq(items.length, 0);
    (ids, items) = cb.getChainWithdrawalsDesc(0, 10);
    assertEq(ids.length, 0);
    assertEq(items.length, 0);
  }

  function test_GetChainWithdrawalIdAt_RevertsPastEnd() public {
    vm.expectRevert();
    cb.getChainWithdrawalIdAt(0);
  }

  function test_UserWithdrawals_EmptyOnEmptyDiamond() public view {
    assertEq(cb.getUserWithdrawalCount(host), 0);
    assertEq(cb.getUserWithdrawalIds(host, 0, 10).length, 0);
    assertEq(cb.getUserWithdrawalIdsDesc(host, 0, 10).length, 0);
    (bytes32[] memory ids, Withdrawal[] memory items) = cb.getUserWithdrawals(host, 0, 10);
    assertEq(ids.length, 0);
    assertEq(items.length, 0);
    (ids, items) = cb.getUserWithdrawalsDesc(host, 0, 10);
    assertEq(ids.length, 0);
    assertEq(items.length, 0);
  }

  function test_GetUserWithdrawalIdAt_RevertsPastEnd() public {
    vm.expectRevert();
    cb.getUserWithdrawalIdAt(host, 0);
  }

  function test_PayableWithdrawals_EmptyOnEmptyDiamond() public view {
    assertEq(cb.getPayableWithdrawalCount(UNKNOWN_PAYABLE), 0);
    assertEq(cb.getPayableWithdrawalIds(UNKNOWN_PAYABLE, 0, 10).length, 0);
    assertEq(cb.getPayableWithdrawalIdsDesc(UNKNOWN_PAYABLE, 0, 10).length, 0);
    (bytes32[] memory ids, Withdrawal[] memory items) = cb.getPayableWithdrawals(UNKNOWN_PAYABLE, 0, 10);
    assertEq(ids.length, 0);
    assertEq(items.length, 0);
    (ids, items) = cb.getPayableWithdrawalsDesc(UNKNOWN_PAYABLE, 0, 10);
    assertEq(ids.length, 0);
    assertEq(items.length, 0);
  }

  function test_GetPayableWithdrawalIdAt_RevertsPastEnd() public {
    vm.expectRevert();
    cb.getPayableWithdrawalIdAt(UNKNOWN_PAYABLE, 0);
  }
}
