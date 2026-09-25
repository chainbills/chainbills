// SPDX-License-Identifier: Apache 2
pragma solidity ^0.8.30;

import {ActivityRecord, ActivityType, User, UserView} from 'src/types/CbTypes.sol';
import {PopulatedViewsBase} from './PopulatedViewsBase.sol';

/// Activity and user views after rich two-chain activity.
contract ActivityViewsPopulatedTest is PopulatedViewsBase {
  uint256 private constant ACTIVITY_TYPES = 9;

  // ---------------------------------------------------------------------------
  // Activities
  // ---------------------------------------------------------------------------

  function test_GetActivity_MatchesEachRecord() public view {
    assertEq(expActivities.length, 38);
    for (uint256 i; i < expActivities.length; i++) {
      ActivityRecord memory record = cb.getActivity(expActivities[i]);
      _assertActivity(record, expActivity[expActivities[i]]);
      assertEq(record.chainCount, i + 1);
    }
  }

  function test_GetActivity_EntitiesPointAtRealRecords() public view {
    for (uint256 i; i < expActivities.length; i++) {
      ActivityRecord memory record = cb.getActivity(expActivities[i]);
      ActivityType t = record.activityType;
      if (t == ActivityType.InitializedUser) {
        assertTrue(cb.isUserInitialized(_keyAddress(record.entity)));
      } else if (t == ActivityType.UserPaid) {
        assertEq(cb.getUserPayment(record.entity).payerCount + 1, record.userCount);
      } else if (t == ActivityType.PayableReceived) {
        assertEq(record.userCount, 0);
        assertEq(cb.getPayablePayment(record.entity).timestamp, record.timestamp);
      } else if (t == ActivityType.Withdrew) {
        assertEq(cb.getWithdrawal(record.entity).timestamp, record.timestamp);
      } else {
        assertTrue(cb.payableExists(record.entity));
      }
    }
  }

  function test_GetActivitiesBulk_AgreesWithSingleReads() public view {
    bytes32[] memory ids = new bytes32[](expActivities.length + 1);
    for (uint256 i; i < expActivities.length; i++) {
      ids[i] = expActivities[(i * 7) % expActivities.length];
    }
    ids[expActivities.length] = UNKNOWN_ID;
    ActivityRecord[] memory records = cb.getActivitiesBulk(ids);
    assertEq(records.length, ids.length);
    for (uint256 i; i < ids.length; i++) {
      _assertActivity(records[i], cb.getActivity(ids[i]));
      _assertActivity(records[i], expActivity[ids[i]]);
    }
    assertEq(records[expActivities.length].chainCount, 0);
  }

  function test_GetChainActivityIdAt_MatchesActivityOrder() public view {
    assertEq(cb.getChainActivityCount(), 38);
    for (uint256 i; i < expActivities.length; i++) {
      assertEq(cb.getChainActivityIdAt(i), expActivities[i]);
    }
  }

  function test_RevertWhen_GetChainActivityIdAt_PastEnd() public {
    vm.expectRevert();
    cb.getChainActivityIdAt(38);
  }

  function test_ChainActivities_Paginate() public view {
    _checkPages(_chainActivityIds, _chainActivityIdsDesc, bytes32(0), expActivities, 'chain activity ids');
    _checkPages(_chainActivities, _chainActivitiesDesc, bytes32(0), expActivities, 'chain activities');
  }

  function test_UserActivities_PaginatePerUser() public view {
    address[] memory wallets = _allWallets();
    uint256[9] memory counts = [uint256(9), 4, 5, 5, 5, 2, 0, 0, 0];
    for (uint256 i; i < wallets.length; i++) {
      bytes32[] memory expected = expActivitiesOfUser[wallets[i]];
      assertEq(expected.length, counts[i]);
      assertEq(cb.getUserActivityCount(wallets[i]), counts[i]);
      assertEq(cb.getUser(wallets[i]).activitiesCount, counts[i]);
      for (uint256 j; j < expected.length; j++) {
        assertEq(cb.getUserActivityIdAt(wallets[i], j), expected[j]);
        assertEq(cb.getActivity(expected[j]).userCount, j + 1);
      }
      _checkPages(_userActivityIds, _userActivityIdsDesc, _toBytes32(wallets[i]), expected, 'user activity ids');
      _checkPages(_userActivities, _userActivitiesDesc, _toBytes32(wallets[i]), expected, 'user activities');
    }
  }

  function test_RevertWhen_GetUserActivityIdAt_PastEnd() public {
    vm.expectRevert();
    cb.getUserActivityIdAt(host, 9);
  }

  function test_PayableActivities_PaginatePerPayable() public view {
    bytes32[] memory ids = _localPayables();
    uint256[4] memory counts = [uint256(6), 7, 5, 5];
    for (uint256 i; i < ids.length; i++) {
      bytes32[] memory expected = expActivitiesOfPayable[ids[i]];
      assertEq(expected.length, counts[i]);
      assertEq(cb.getPayableActivityCount(ids[i]), counts[i]);
      assertEq(cb.getPayable(ids[i]).activitiesCount, counts[i]);
      for (uint256 j; j < expected.length; j++) {
        assertEq(cb.getPayableActivityIdAt(ids[i], j), expected[j]);
        assertEq(cb.getActivity(expected[j]).payableCount, j + 1);
      }
      _checkPages(_payableActivityIds, _payableActivityIdsDesc, ids[i], expected, 'payable activity ids');
      _checkPages(_payableActivities, _payableActivitiesDesc, ids[i], expected, 'payable activities');
    }
    // Foreign payables have no activities on the mirroring chain.
    _checkPages(_payableActivities, _payableActivitiesDesc, f1, new bytes32[](0), 'foreign payable activities');
  }

  function test_RevertWhen_GetPayableActivityIdAt_PastEnd() public {
    vm.expectRevert();
    cb.getPayableActivityIdAt(p2, 7);
  }

  function test_ActivityLists_PartitionChainList() public view {
    // Every chain activity is on exactly one user list, one payable list, or both; PayableReceived activities are
    // the only ones without a user.
    uint256 userTotal;
    address[] memory wallets = _allWallets();
    for (uint256 i; i < wallets.length; i++) {
      userTotal += cb.getUserActivityCount(wallets[i]);
    }
    uint256 received;
    for (uint256 i; i < expActivities.length; i++) {
      if (cb.getActivity(expActivities[i]).activityType == ActivityType.PayableReceived) received++;
    }
    assertEq(userTotal, 30);
    assertEq(received, 8);
    assertEq(userTotal + received, cb.getChainActivityCount());
  }

  // ---------------------------------------------------------------------------
  // Activities by type
  // ---------------------------------------------------------------------------

  function test_GetUserActivitiesByType_LiteralCounts() public view {
    assertEq(_scanUser(host, ActivityType.Withdrew, 100).length, 3);
    assertEq(_scanUser(host, ActivityType.CreatedPayable, 100).length, 2);
    assertEq(_scanUser(host, ActivityType.UserPaid, 100).length, 0);
    assertEq(_scanUser(payer, ActivityType.UserPaid, 100).length, 4);
    assertEq(_scanUser(payer2, ActivityType.UserPaid, 1).length, 4);
    assertEq(_scanUser(host3, ActivityType.UpdatedPayableAutoWithdrawStatus, 2).length, 1);
    assertEq(_scanUser(host3, ActivityType.ClosedPayable, 3).length, 1);
    assertEq(_scanUser(host2, ActivityType.InitializedUser, 1).length, 1);
  }

  function test_GetPayableActivitiesByType_LiteralCounts() public view {
    assertEq(_scanPayable(p2, ActivityType.PayableReceived, 100).length, 3);
    assertEq(_scanPayable(p2, ActivityType.ClosedPayable, 2).length, 1);
    assertEq(_scanPayable(p2, ActivityType.ReopenedPayable, 1).length, 1);
    assertEq(_scanPayable(p1, ActivityType.UpdatedPayableAllowedTokensAndAmounts, 3).length, 1);
    assertEq(_scanPayable(p3, ActivityType.Withdrew, 2).length, 2);
    // A payable list never holds user initializations or payer-side receipts.
    assertEq(_scanPayable(p1, ActivityType.InitializedUser, 100).length, 0);
    assertEq(_scanPayable(p1, ActivityType.UserPaid, 100).length, 0);
  }

  function test_GetUserActivitiesByType_PagesUntilExhausted() public view {
    address[] memory wallets = _allWallets();
    uint256[4] memory limits = [uint256(1), 2, 3, 100];
    for (uint256 w; w < 6; w++) {
      for (uint256 t; t < ACTIVITY_TYPES; t++) {
        bytes32[] memory expected = _filter(expActivitiesOfUser[wallets[w]], ActivityType(t));
        for (uint256 l; l < limits.length; l++) {
          _assertIds(_scanUser(wallets[w], ActivityType(t), limits[l]), expected, 'user activities by type');
        }
      }
    }
  }

  function test_GetPayableActivitiesByType_PagesUntilExhausted() public view {
    bytes32[] memory ids = _localPayables();
    uint256[4] memory limits = [uint256(1), 2, 3, 100];
    for (uint256 p; p < ids.length; p++) {
      for (uint256 t; t < ACTIVITY_TYPES; t++) {
        bytes32[] memory expected = _filter(expActivitiesOfPayable[ids[p]], ActivityType(t));
        for (uint256 l; l < limits.length; l++) {
          _assertIds(_scanPayable(ids[p], ActivityType(t), limits[l]), expected, 'payable activities by type');
        }
      }
    }
  }

  function test_GetActivitiesByType_ZeroLimitScansNothing() public view {
    // A zero limit scans no entries and does not advance.
    (bytes32[] memory ids, ActivityRecord[] memory items, uint256 nextOffset) =
      cb.getUserActivitiesByType(host, ActivityType.Withdrew, 4, 0);
    assertEq(ids.length, 0);
    assertEq(items.length, 0);
    assertEq(nextOffset, 4);
    (ids, items, nextOffset) = cb.getPayableActivitiesByType(p2, ActivityType.PayableReceived, 0, 0);
    assertEq(ids.length, 0);
    assertEq(items.length, 0);
    assertEq(nextOffset, 0);
  }

  function test_GetActivitiesByType_PastEndReturnsListLength() public view {
    (bytes32[] memory ids, ActivityRecord[] memory items, uint256 nextOffset) =
      cb.getUserActivitiesByType(host, ActivityType.Withdrew, 9, 5);
    assertEq(ids.length, 0);
    assertEq(items.length, 0);
    assertEq(nextOffset, 9);
    (ids, items, nextOffset) = cb.getUserActivitiesByType(host, ActivityType.Withdrew, type(uint256).max, 5);
    assertEq(ids.length, 0);
    assertEq(nextOffset, 9);
    (ids, items, nextOffset) = cb.getPayableActivitiesByType(p2, ActivityType.PayableReceived, 50, 1);
    assertEq(ids.length, 0);
    assertEq(nextOffset, 7);
    // Unknown lists are empty and complete immediately.
    (ids, items, nextOffset) = cb.getUserActivitiesByType(stranger, ActivityType.UserPaid, 0, 10);
    assertEq(ids.length, 0);
    assertEq(nextOffset, 0);
  }

  function test_GetActivitiesByType_LargeLimitDoesNotOverflow() public view {
    (bytes32[] memory ids,, uint256 nextOffset) =
      cb.getUserActivitiesByType(host, ActivityType.Withdrew, 2, type(uint256).max);
    assertEq(ids.length, 3);
    assertEq(nextOffset, 9);
  }

  function test_GetActivitiesByType_WindowSkipsNonMatches() public view {
    // host's list: init, create, create, close, reopen, update, withdrew, withdrew, withdrew. The window [3, 6)
    // holds close, reopen, update: no withdrawal, but the scan still advances by the full window.
    (bytes32[] memory ids,, uint256 nextOffset) = cb.getUserActivitiesByType(host, ActivityType.Withdrew, 3, 3);
    assertEq(ids.length, 0);
    assertEq(nextOffset, 6);
    (ids,, nextOffset) = cb.getUserActivitiesByType(host, ActivityType.Withdrew, 6, 3);
    assertEq(ids.length, 3);
    assertEq(nextOffset, 9);
  }

  /// Scans a user's activities of `activityType` in windows of `limit`, checking every window, until complete.
  function _scanUser(address wallet, ActivityType activityType, uint256 limit)
    private
    view
    returns (bytes32[] memory found)
  {
    uint256 n = cb.getUserActivityCount(wallet);
    uint256 offset;
    found = new bytes32[](0);
    while (offset < n) {
      (bytes32[] memory ids, ActivityRecord[] memory items, uint256 nextOffset) =
        cb.getUserActivitiesByType(wallet, activityType, offset, limit);
      _checkWindow(ids, items, activityType, offset, limit, n, nextOffset, expActivitiesOfUser[wallet]);
      found = _concat(found, ids);
      offset = nextOffset;
    }
    (bytes32[] memory tail,, uint256 tailOffset) = cb.getUserActivitiesByType(wallet, activityType, offset, limit);
    assertEq(tail.length, 0);
    assertEq(tailOffset, n);
  }

  /// Scans a payable's activities of `activityType` in windows of `limit`, checking every window, until complete.
  function _scanPayable(bytes32 payableId, ActivityType activityType, uint256 limit)
    private
    view
    returns (bytes32[] memory found)
  {
    uint256 n = cb.getPayableActivityCount(payableId);
    uint256 offset;
    found = new bytes32[](0);
    while (offset < n) {
      (bytes32[] memory ids, ActivityRecord[] memory items, uint256 nextOffset) =
        cb.getPayableActivitiesByType(payableId, activityType, offset, limit);
      _checkWindow(ids, items, activityType, offset, limit, n, nextOffset, expActivitiesOfPayable[payableId]);
      found = _concat(found, ids);
      offset = nextOffset;
    }
    (bytes32[] memory tail,, uint256 tailOffset) = cb.getPayableActivitiesByType(payableId, activityType, offset, limit);
    assertEq(tail.length, 0);
    assertEq(tailOffset, n);
  }

  /// Checks one by-type window: the next offset is the clamped window end, and the matches are exactly the entries
  /// of that window with `activityType`, index-aligned with their records.
  function _checkWindow(
    bytes32[] memory ids,
    ActivityRecord[] memory items,
    ActivityType activityType,
    uint256 offset,
    uint256 limit,
    uint256 n,
    uint256 nextOffset,
    bytes32[] memory list
  ) private view {
    uint256 end = limit > n - offset ? n : offset + limit;
    assertEq(nextOffset, end, 'nextOffset');
    _assertIds(ids, _filter(_page(list, offset, limit), activityType), 'by-type window');
    _checkActivities(ids, items);
  }

  function _filter(bytes32[] memory list, ActivityType activityType) private view returns (bytes32[] memory out) {
    uint256 count;
    for (uint256 i; i < list.length; i++) {
      if (expActivity[list[i]].activityType == activityType) count++;
    }
    out = new bytes32[](count);
    uint256 j;
    for (uint256 i; i < list.length; i++) {
      if (expActivity[list[i]].activityType == activityType) out[j++] = list[i];
    }
  }

  function _concat(bytes32[] memory a, bytes32[] memory b) private pure returns (bytes32[] memory out) {
    out = new bytes32[](a.length + b.length);
    for (uint256 i; i < a.length; i++) {
      out[i] = a[i];
    }
    for (uint256 i; i < b.length; i++) {
      out[a.length + i] = b[i];
    }
  }

  // ---------------------------------------------------------------------------
  // Users
  // ---------------------------------------------------------------------------

  function test_GetUser_MatchesEachUser() public view {
    address[] memory wallets = _allWallets();
    for (uint256 i; i < wallets.length; i++) {
      _assertUser(cb.getUser(wallets[i]), _expectedUser(wallets[i]));
      assertEq(cb.isUserInitialized(wallets[i]), i < 6);
    }
  }

  function test_GetUser_CountersAgreeWithLists() public view {
    address[] memory wallets = _allWallets();
    for (uint256 i; i < wallets.length; i++) {
      User memory user = cb.getUser(wallets[i]);
      assertEq(user.payablesCount, cb.getUserPayableCount(wallets[i]));
      assertEq(user.paymentsCount, cb.getUserPaymentCount(wallets[i]));
      assertEq(user.withdrawalsCount, cb.getUserWithdrawalCount(wallets[i]));
      assertEq(user.activitiesCount, cb.getUserActivityCount(wallets[i]));
    }
  }

  function test_GetUsersBulk_AgreesWithSingleReads() public view {
    address[] memory wallets = _allWallets();
    User[] memory users = cb.getUsersBulk(wallets);
    assertEq(users.length, wallets.length);
    for (uint256 i; i < wallets.length; i++) {
      _assertUser(users[i], cb.getUser(wallets[i]));
      _assertUser(users[i], _expectedUser(wallets[i]));
    }
  }

  function test_GetChainUserAt_MatchesFirstInteractionOrder() public view {
    assertEq(cb.getChainUserCount(), 6);
    for (uint256 i; i < expUsers.length; i++) {
      assertEq(cb.getChainUserAt(i), expUsers[i]);
      assertEq(cb.getUser(expUsers[i]).chainCount, i + 1);
    }
    assertEq(expUsers[0], host);
    assertEq(expUsers[3], payer);
    assertEq(expUsers[5], payer3);
  }

  function test_RevertWhen_GetChainUserAt_PastEnd() public {
    vm.expectRevert();
    cb.getChainUserAt(6);
  }

  function test_ChainUsers_Paginate() public view {
    bytes32[] memory expected = _toBytes32List(expUsers);
    _checkPages(_chainUserAddresses, _chainUserAddressesDesc, bytes32(0), expected, 'chain user addresses');
    _checkPages(_chainUsers, _chainUsersDesc, bytes32(0), expected, 'chain users');
  }

  function test_ChainBUsers_InFirstInteractionOrder() public view {
    assertEq(chainB.cb.getChainUserCount(), 2);
    assertEq(chainB.cb.getChainUserAt(0), foreignHost);
    assertEq(chainB.cb.getChainUserAt(1), foreignPayer);
    UserView[] memory users = chainB.cb.getChainUsersDesc(0, 10);
    assertEq(users.length, 2);
    assertEq(users[0].wallet, foreignPayer);
    _assertUser(users[0].info, _user(2, 0, 1, 0, 2));
    assertEq(users[1].wallet, foreignHost);
    _assertUser(users[1].info, _user(1, 2, 0, 0, 5));
    // Paying across chains does not make the payer a user of the payable's chain.
    assertFalse(chainB.cb.isUserInitialized(payer));
    assertFalse(cb.isUserInitialized(foreignPayer));
  }
}
