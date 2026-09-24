// SPDX-License-Identifier: Apache 2
pragma solidity ^0.8.30;

import {ActivityRecord, ActivityType, User, UserView} from 'src/types/CbTypes.sol';
import {CbTestBase} from '../base/CbTestBase.sol';

/// Every activity and user view on an empty diamond. Populated-state coverage lands once operation facets can
/// record activity.
contract ActivityViewsTest is CbTestBase {
  bytes32 private constant UNKNOWN_ID = keccak256('unknown-activity');
  bytes32 private constant UNKNOWN_PAYABLE = keccak256('unknown-payable');

  // ---------------------------------------------------------------------------
  // Activities
  // ---------------------------------------------------------------------------

  function test_GetActivity_ZeroWhenUnknown() public view {
    ActivityRecord memory record = cb.getActivity(UNKNOWN_ID);
    assertEq(record.entity, bytes32(0));
    assertEq(record.timestamp, 0);
  }

  function test_GetActivitiesBulk_ZeroEntries() public view {
    bytes32[] memory ids = new bytes32[](1);
    ids[0] = UNKNOWN_ID;
    ActivityRecord[] memory records = cb.getActivitiesBulk(ids);
    assertEq(records.length, 1);
    assertEq(records[0].entity, bytes32(0));
  }

  function test_ChainActivities_EmptyOnEmptyDiamond() public view {
    assertEq(cb.getChainActivityCount(), 0);
    assertEq(cb.getChainActivityIds(0, 10).length, 0);
    assertEq(cb.getChainActivityIdsDesc(0, 10).length, 0);
    (bytes32[] memory ids, ActivityRecord[] memory items) = cb.getChainActivities(0, 10);
    assertEq(ids.length, 0);
    assertEq(items.length, 0);
    (ids, items) = cb.getChainActivitiesDesc(0, 10);
    assertEq(ids.length, 0);
    assertEq(items.length, 0);
  }

  function test_GetChainActivityIdAt_RevertsPastEnd() public {
    vm.expectRevert();
    cb.getChainActivityIdAt(0);
  }

  function test_UserActivities_EmptyOnEmptyDiamond() public view {
    assertEq(cb.getUserActivityCount(host), 0);
    assertEq(cb.getUserActivityIds(host, 0, 10).length, 0);
    assertEq(cb.getUserActivityIdsDesc(host, 0, 10).length, 0);
    (bytes32[] memory ids, ActivityRecord[] memory items) = cb.getUserActivities(host, 0, 10);
    assertEq(ids.length, 0);
    assertEq(items.length, 0);
    (ids, items) = cb.getUserActivitiesDesc(host, 0, 10);
    assertEq(ids.length, 0);
    assertEq(items.length, 0);
  }

  function test_GetUserActivityIdAt_RevertsPastEnd() public {
    vm.expectRevert();
    cb.getUserActivityIdAt(host, 0);
  }

  function test_PayableActivities_EmptyOnEmptyDiamond() public view {
    assertEq(cb.getPayableActivityCount(UNKNOWN_PAYABLE), 0);
    assertEq(cb.getPayableActivityIds(UNKNOWN_PAYABLE, 0, 10).length, 0);
    assertEq(cb.getPayableActivityIdsDesc(UNKNOWN_PAYABLE, 0, 10).length, 0);
    (bytes32[] memory ids, ActivityRecord[] memory items) = cb.getPayableActivities(UNKNOWN_PAYABLE, 0, 10);
    assertEq(ids.length, 0);
    assertEq(items.length, 0);
    (ids, items) = cb.getPayableActivitiesDesc(UNKNOWN_PAYABLE, 0, 10);
    assertEq(ids.length, 0);
    assertEq(items.length, 0);
  }

  function test_GetPayableActivityIdAt_RevertsPastEnd() public {
    vm.expectRevert();
    cb.getPayableActivityIdAt(UNKNOWN_PAYABLE, 0);
  }

  function test_GetUserActivitiesByType_EmptyOnEmptyDiamond() public view {
    (bytes32[] memory ids, ActivityRecord[] memory items, uint256 nextOffset) =
      cb.getUserActivitiesByType(host, ActivityType.CreatedPayable, 0, 10);
    assertEq(ids.length, 0);
    assertEq(items.length, 0);
    assertEq(nextOffset, 0);
  }

  function test_GetUserActivitiesByType_NextOffsetIsLengthWhenOffsetPastEnd() public view {
    (,, uint256 nextOffset) = cb.getUserActivitiesByType(host, ActivityType.CreatedPayable, 5, 10);
    assertEq(nextOffset, 0);
  }

  function test_GetPayableActivitiesByType_EmptyOnEmptyDiamond() public view {
    (bytes32[] memory ids, ActivityRecord[] memory items, uint256 nextOffset) =
      cb.getPayableActivitiesByType(UNKNOWN_PAYABLE, ActivityType.UserPaid, 0, 10);
    assertEq(ids.length, 0);
    assertEq(items.length, 0);
    assertEq(nextOffset, 0);
  }

  // ---------------------------------------------------------------------------
  // Users
  // ---------------------------------------------------------------------------

  function test_IsUserInitialized_FalseWhenUnknown() public view {
    assertFalse(cb.isUserInitialized(host));
  }

  function test_GetUser_ZeroWhenUnknown() public view {
    User memory user = cb.getUser(host);
    assertEq(user.chainCount, 0);
    assertEq(user.payablesCount, 0);
  }

  function test_GetUsersBulk_ZeroEntries() public view {
    address[] memory wallets = new address[](1);
    wallets[0] = host;
    User[] memory users = cb.getUsersBulk(wallets);
    assertEq(users.length, 1);
    assertEq(users[0].chainCount, 0);
  }

  function test_ChainUsers_EmptyOnEmptyDiamond() public view {
    assertEq(cb.getChainUserCount(), 0);
    assertEq(cb.getChainUserAddresses(0, 10).length, 0);
    assertEq(cb.getChainUserAddressesDesc(0, 10).length, 0);
    assertEq(cb.getChainUsers(0, 10).length, 0);
    assertEq(cb.getChainUsersDesc(0, 10).length, 0);
  }

  function test_GetChainUserAt_RevertsPastEnd() public {
    vm.expectRevert();
    cb.getChainUserAt(0);
  }
}
