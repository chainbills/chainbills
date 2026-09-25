// SPDX-License-Identifier: Apache 2
pragma solidity ^0.8.30;

import {ICbActivityViews} from '../interfaces/ICbActivityViews.sol';
import {CbPagination} from '../libraries/CbPagination.sol';
import {LibActivityStorage} from '../storage/LibActivityStorage.sol';
import {LibPayableStorage} from '../storage/LibPayableStorage.sol';
import {LibUserStorage} from '../storage/LibUserStorage.sol';
import {ActivityRecord, ActivityType, User, UserView} from '../types/CbTypes.sol';
import {CbFacetBase} from './CbFacetBase.sol';

/// Activity and user reads.
contract CbActivityViewsFacet is CbFacetBase, ICbActivityViews {
  // ---------------------------------------------------------------------------
  // Activities
  // ---------------------------------------------------------------------------

  /// @inheritdoc ICbActivityViews
  function getActivity(bytes32 activityId) external view returns (ActivityRecord memory) {
    return LibActivityStorage.layout().activities[activityId];
  }

  /// @inheritdoc ICbActivityViews
  function getActivitiesBulk(bytes32[] calldata activityIds)
    external
    view
    returns (ActivityRecord[] memory activities)
  {
    LibActivityStorage.Layout storage $ = LibActivityStorage.layout();
    activities = new ActivityRecord[](activityIds.length);
    for (uint256 i; i < activityIds.length; i++) {
      activities[i] = $.activities[activityIds[i]];
    }
  }

  /// @inheritdoc ICbActivityViews
  function getChainActivityCount() external view returns (uint256) {
    return LibActivityStorage.layout().activityIds.length;
  }

  /// @inheritdoc ICbActivityViews
  function getChainActivityIdAt(uint256 index) external view returns (bytes32) {
    return LibActivityStorage.layout().activityIds[index];
  }

  /// @inheritdoc ICbActivityViews
  function getChainActivityIds(uint256 offset, uint256 limit) external view returns (bytes32[] memory) {
    return CbPagination.bytes32Page(LibActivityStorage.layout().activityIds, offset, limit);
  }

  /// @inheritdoc ICbActivityViews
  function getChainActivityIdsDesc(uint256 offset, uint256 limit) external view returns (bytes32[] memory) {
    return CbPagination.bytes32PageDesc(LibActivityStorage.layout().activityIds, offset, limit);
  }

  /// @inheritdoc ICbActivityViews
  function getChainActivities(uint256 offset, uint256 limit)
    external
    view
    returns (bytes32[] memory ids, ActivityRecord[] memory items)
  {
    ids = CbPagination.bytes32Page(LibActivityStorage.layout().activityIds, offset, limit);
    items = _activities(ids);
  }

  /// @inheritdoc ICbActivityViews
  function getChainActivitiesDesc(uint256 offset, uint256 limit)
    external
    view
    returns (bytes32[] memory ids, ActivityRecord[] memory items)
  {
    ids = CbPagination.bytes32PageDesc(LibActivityStorage.layout().activityIds, offset, limit);
    items = _activities(ids);
  }

  /// @inheritdoc ICbActivityViews
  function getUserActivityCount(address wallet) external view returns (uint256) {
    return LibUserStorage.layout().userActivityIds[wallet].length;
  }

  /// @inheritdoc ICbActivityViews
  function getUserActivityIdAt(address wallet, uint256 index) external view returns (bytes32) {
    return LibUserStorage.layout().userActivityIds[wallet][index];
  }

  /// @inheritdoc ICbActivityViews
  function getUserActivityIds(address wallet, uint256 offset, uint256 limit) external view returns (bytes32[] memory) {
    return CbPagination.bytes32Page(LibUserStorage.layout().userActivityIds[wallet], offset, limit);
  }

  /// @inheritdoc ICbActivityViews
  function getUserActivityIdsDesc(address wallet, uint256 offset, uint256 limit)
    external
    view
    returns (bytes32[] memory)
  {
    return CbPagination.bytes32PageDesc(LibUserStorage.layout().userActivityIds[wallet], offset, limit);
  }

  /// @inheritdoc ICbActivityViews
  function getUserActivities(address wallet, uint256 offset, uint256 limit)
    external
    view
    returns (bytes32[] memory ids, ActivityRecord[] memory items)
  {
    ids = CbPagination.bytes32Page(LibUserStorage.layout().userActivityIds[wallet], offset, limit);
    items = _activities(ids);
  }

  /// @inheritdoc ICbActivityViews
  function getUserActivitiesDesc(address wallet, uint256 offset, uint256 limit)
    external
    view
    returns (bytes32[] memory ids, ActivityRecord[] memory items)
  {
    ids = CbPagination.bytes32PageDesc(LibUserStorage.layout().userActivityIds[wallet], offset, limit);
    items = _activities(ids);
  }

  /// @inheritdoc ICbActivityViews
  function getPayableActivityCount(bytes32 payableId) external view returns (uint256) {
    return LibPayableStorage.layout().payableActivityIds[payableId].length;
  }

  /// @inheritdoc ICbActivityViews
  function getPayableActivityIdAt(bytes32 payableId, uint256 index) external view returns (bytes32) {
    return LibPayableStorage.layout().payableActivityIds[payableId][index];
  }

  /// @inheritdoc ICbActivityViews
  function getPayableActivityIds(bytes32 payableId, uint256 offset, uint256 limit)
    external
    view
    returns (bytes32[] memory)
  {
    return CbPagination.bytes32Page(LibPayableStorage.layout().payableActivityIds[payableId], offset, limit);
  }

  /// @inheritdoc ICbActivityViews
  function getPayableActivityIdsDesc(bytes32 payableId, uint256 offset, uint256 limit)
    external
    view
    returns (bytes32[] memory)
  {
    return CbPagination.bytes32PageDesc(LibPayableStorage.layout().payableActivityIds[payableId], offset, limit);
  }

  /// @inheritdoc ICbActivityViews
  function getPayableActivities(bytes32 payableId, uint256 offset, uint256 limit)
    external
    view
    returns (bytes32[] memory ids, ActivityRecord[] memory items)
  {
    ids = CbPagination.bytes32Page(LibPayableStorage.layout().payableActivityIds[payableId], offset, limit);
    items = _activities(ids);
  }

  /// @inheritdoc ICbActivityViews
  function getPayableActivitiesDesc(bytes32 payableId, uint256 offset, uint256 limit)
    external
    view
    returns (bytes32[] memory ids, ActivityRecord[] memory items)
  {
    ids = CbPagination.bytes32PageDesc(LibPayableStorage.layout().payableActivityIds[payableId], offset, limit);
    items = _activities(ids);
  }

  /// @inheritdoc ICbActivityViews
  function getUserActivitiesByType(address wallet, ActivityType activityType, uint256 offset, uint256 limit)
    external
    view
    returns (bytes32[] memory ids, ActivityRecord[] memory items, uint256 nextOffset)
  {
    return _scanByType(LibUserStorage.layout().userActivityIds[wallet], activityType, offset, limit);
  }

  /// @inheritdoc ICbActivityViews
  function getPayableActivitiesByType(bytes32 payableId, ActivityType activityType, uint256 offset, uint256 limit)
    external
    view
    returns (bytes32[] memory ids, ActivityRecord[] memory items, uint256 nextOffset)
  {
    return _scanByType(LibPayableStorage.layout().payableActivityIds[payableId], activityType, offset, limit);
  }

  // ---------------------------------------------------------------------------
  // Users
  // ---------------------------------------------------------------------------

  /// @inheritdoc ICbActivityViews
  function isUserInitialized(address wallet) external view returns (bool) {
    return LibUserStorage.layout().users[wallet].chainCount != 0;
  }

  /// @inheritdoc ICbActivityViews
  function getUser(address wallet) external view returns (User memory) {
    return LibUserStorage.layout().users[wallet];
  }

  /// @inheritdoc ICbActivityViews
  function getUsersBulk(address[] calldata wallets) external view returns (User[] memory users) {
    LibUserStorage.Layout storage $ = LibUserStorage.layout();
    users = new User[](wallets.length);
    for (uint256 i; i < wallets.length; i++) {
      users[i] = $.users[wallets[i]];
    }
  }

  /// @inheritdoc ICbActivityViews
  function getChainUserCount() external view returns (uint256) {
    return LibUserStorage.layout().userAddresses.length;
  }

  /// @inheritdoc ICbActivityViews
  function getChainUserAt(uint256 index) external view returns (address) {
    return LibUserStorage.layout().userAddresses[index];
  }

  /// @inheritdoc ICbActivityViews
  function getChainUserAddresses(uint256 offset, uint256 limit) external view returns (address[] memory) {
    return CbPagination.addressPage(LibUserStorage.layout().userAddresses, offset, limit);
  }

  /// @inheritdoc ICbActivityViews
  function getChainUserAddressesDesc(uint256 offset, uint256 limit) external view returns (address[] memory) {
    return CbPagination.addressPageDesc(LibUserStorage.layout().userAddresses, offset, limit);
  }

  /// @inheritdoc ICbActivityViews
  function getChainUsers(uint256 offset, uint256 limit) external view returns (UserView[] memory) {
    return _userViews(CbPagination.addressPage(LibUserStorage.layout().userAddresses, offset, limit));
  }

  /// @inheritdoc ICbActivityViews
  function getChainUsersDesc(uint256 offset, uint256 limit) external view returns (UserView[] memory) {
    return _userViews(CbPagination.addressPageDesc(LibUserStorage.layout().userAddresses, offset, limit));
  }

  // ---------------------------------------------------------------------------
  // Helpers
  // ---------------------------------------------------------------------------

  /// Loads activities for `ids`, index-aligned.
  function _activities(bytes32[] memory ids) private view returns (ActivityRecord[] memory items) {
    LibActivityStorage.Layout storage $ = LibActivityStorage.layout();
    items = new ActivityRecord[](ids.length);
    for (uint256 i; i < ids.length; i++) {
      items[i] = $.activities[ids[i]];
    }
  }

  /// Builds user views for `wallets`, index-aligned.
  function _userViews(address[] memory wallets) private view returns (UserView[] memory views) {
    LibUserStorage.Layout storage $ = LibUserStorage.layout();
    views = new UserView[](wallets.length);
    for (uint256 i; i < wallets.length; i++) {
      views[i] = UserView({wallet: wallets[i], info: $.users[wallets[i]]});
    }
  }

  /// Scans the ascending window `[offset, offset + limit)` of `list`, clamped to its length, and returns the
  /// activities of `activityType` found in it.
  function _scanByType(bytes32[] storage list, ActivityType activityType, uint256 offset, uint256 limit)
    private
    view
    returns (bytes32[] memory ids, ActivityRecord[] memory items, uint256 nextOffset)
  {
    // Inline early-exit avoids adding `length` to the outer slot count.
    if (offset >= list.length) return (new bytes32[](0), new ActivityRecord[](0), list.length);

    // outer: list(p), activityType(p), offset(p), limit(p), ids(ret), items(ret), nextOffset(ret),
    //        end, count = 9 slots.
    uint256 end;
    uint256 count;

    // Phase 1: compute window bounds and count matching entries.
    // 9 outer + windowLength, $, i(loop) = 12 simultaneous slots.
    {
      uint256 windowLength = list.length - offset;
      if (limit < windowLength) windowLength = limit;
      end = offset + windowLength;
      nextOffset = end;
      LibActivityStorage.Layout storage $ = LibActivityStorage.layout();
      for (uint256 i = offset; i < end; i++) {
        if ($.activities[list[i]].activityType == activityType) count++;
      }
    }

    // Phase 2: delegated to a helper so its 4 inner vars ($ j i record) stay in a fresh
    // 6-param frame, keeping the combined count to 10 and leaving room for coverage overhead.
    ids = new bytes32[](count);
    items = new ActivityRecord[](count);
    _fillByType(list, activityType, offset, end, ids, items);
  }

  /// Fills pre-sized `ids` and `items` with entries from `list[offset..end)` whose type matches.
  function _fillByType(
    bytes32[] storage list,
    ActivityType activityType,
    uint256 offset,
    uint256 end,
    bytes32[] memory ids,
    ActivityRecord[] memory items
  ) private view {
    // 6 params + $, j, i(loop), record = 10 simultaneous slots.
    LibActivityStorage.Layout storage $ = LibActivityStorage.layout();
    uint256 j;
    for (uint256 i = offset; i < end; i++) {
      ActivityRecord memory record = $.activities[list[i]];
      if (record.activityType == activityType) {
        ids[j] = list[i];
        items[j] = record;
        j++;
      }
    }
  }
}
