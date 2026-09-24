// SPDX-License-Identifier: Apache 2
pragma solidity ^0.8.30;

import {ActivityRecord, ActivityType, User, UserView} from '../types/CbTypes.sol';

/// Activity and user reads.
/// @dev Paginated functions return empty arrays when `offset` is past the end. `...Desc` variants count `offset`
/// from the newest entry and return newest first. Entity pages return IDs and records index-aligned.
interface ICbActivityViews {
  // ---------------------------------------------------------------------------
  // Activities
  // ---------------------------------------------------------------------------

  function getActivity(bytes32 activityId) external view returns (ActivityRecord memory);
  function getActivitiesBulk(bytes32[] calldata activityIds) external view returns (ActivityRecord[] memory);

  function getChainActivityCount() external view returns (uint256);
  function getChainActivityIdAt(uint256 index) external view returns (bytes32);
  function getChainActivityIds(uint256 offset, uint256 limit) external view returns (bytes32[] memory);
  function getChainActivityIdsDesc(uint256 offset, uint256 limit) external view returns (bytes32[] memory);
  function getChainActivities(uint256 offset, uint256 limit)
    external
    view
    returns (bytes32[] memory ids, ActivityRecord[] memory items);
  function getChainActivitiesDesc(uint256 offset, uint256 limit)
    external
    view
    returns (bytes32[] memory ids, ActivityRecord[] memory items);

  function getUserActivityCount(address wallet) external view returns (uint256);
  function getUserActivityIdAt(address wallet, uint256 index) external view returns (bytes32);
  function getUserActivityIds(address wallet, uint256 offset, uint256 limit) external view returns (bytes32[] memory);
  function getUserActivityIdsDesc(address wallet, uint256 offset, uint256 limit)
    external
    view
    returns (bytes32[] memory);
  function getUserActivities(address wallet, uint256 offset, uint256 limit)
    external
    view
    returns (bytes32[] memory ids, ActivityRecord[] memory items);
  function getUserActivitiesDesc(address wallet, uint256 offset, uint256 limit)
    external
    view
    returns (bytes32[] memory ids, ActivityRecord[] memory items);

  function getPayableActivityCount(bytes32 payableId) external view returns (uint256);
  function getPayableActivityIdAt(bytes32 payableId, uint256 index) external view returns (bytes32);
  function getPayableActivityIds(bytes32 payableId, uint256 offset, uint256 limit)
    external
    view
    returns (bytes32[] memory);
  function getPayableActivityIdsDesc(bytes32 payableId, uint256 offset, uint256 limit)
    external
    view
    returns (bytes32[] memory);
  function getPayableActivities(bytes32 payableId, uint256 offset, uint256 limit)
    external
    view
    returns (bytes32[] memory ids, ActivityRecord[] memory items);
  function getPayableActivitiesDesc(bytes32 payableId, uint256 offset, uint256 limit)
    external
    view
    returns (bytes32[] memory ids, ActivityRecord[] memory items);

  /// Scans at most `limit` of the user's activities starting at `offset` and returns those of `activityType`.
  /// @return ids Matching activity IDs.
  /// @return items Matching records, index-aligned with `ids`.
  /// @return nextOffset Offset to continue scanning from; equals the list length once the scan is complete.
  function getUserActivitiesByType(address wallet, ActivityType activityType, uint256 offset, uint256 limit)
    external
    view
    returns (bytes32[] memory ids, ActivityRecord[] memory items, uint256 nextOffset);

  /// Scans at most `limit` of the payable's activities starting at `offset` and returns those of `activityType`.
  /// @return ids Matching activity IDs.
  /// @return items Matching records, index-aligned with `ids`.
  /// @return nextOffset Offset to continue scanning from; equals the list length once the scan is complete.
  function getPayableActivitiesByType(bytes32 payableId, ActivityType activityType, uint256 offset, uint256 limit)
    external
    view
    returns (bytes32[] memory ids, ActivityRecord[] memory items, uint256 nextOffset);

  // ---------------------------------------------------------------------------
  // Users
  // ---------------------------------------------------------------------------

  function isUserInitialized(address wallet) external view returns (bool);
  function getUser(address wallet) external view returns (User memory);
  function getUsersBulk(address[] calldata wallets) external view returns (User[] memory);

  function getChainUserCount() external view returns (uint256);
  function getChainUserAt(uint256 index) external view returns (address);
  function getChainUserAddresses(uint256 offset, uint256 limit) external view returns (address[] memory);
  function getChainUserAddressesDesc(uint256 offset, uint256 limit) external view returns (address[] memory);
  function getChainUsers(uint256 offset, uint256 limit) external view returns (UserView[] memory);
  function getChainUsersDesc(uint256 offset, uint256 limit) external view returns (UserView[] memory);
}
