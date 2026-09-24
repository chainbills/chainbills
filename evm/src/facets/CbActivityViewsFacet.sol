// SPDX-License-Identifier: Apache 2
pragma solidity ^0.8.30;

import {ICbActivityViews} from '../interfaces/ICbActivityViews.sol';
import {ActivityRecord, ActivityType, User, UserView} from '../types/CbTypes.sol';
import {CbFacetBase} from './CbFacetBase.sol';

contract CbActivityViewsFacet is CbFacetBase, ICbActivityViews {
  function getActivity(bytes32 activityId) external view returns (ActivityRecord memory) {
    revert('unimplemented');
  }

  function getActivitiesBulk(bytes32[] calldata activityIds) external view returns (ActivityRecord[] memory) {
    revert('unimplemented');
  }

  function getChainActivityCount() external view returns (uint256) {
    revert('unimplemented');
  }

  function getChainActivityIdAt(uint256 index) external view returns (bytes32) {
    revert('unimplemented');
  }

  function getChainActivityIds(uint256 offset, uint256 limit) external view returns (bytes32[] memory) {
    revert('unimplemented');
  }

  function getChainActivityIdsDesc(uint256 offset, uint256 limit) external view returns (bytes32[] memory) {
    revert('unimplemented');
  }

  function getChainActivities(uint256 offset, uint256 limit)
    external
    view
    returns (bytes32[] memory ids, ActivityRecord[] memory items)
  {
    revert('unimplemented');
  }

  function getChainActivitiesDesc(uint256 offset, uint256 limit)
    external
    view
    returns (bytes32[] memory ids, ActivityRecord[] memory items)
  {
    revert('unimplemented');
  }

  function getUserActivityCount(address wallet) external view returns (uint256) {
    revert('unimplemented');
  }

  function getUserActivityIdAt(address wallet, uint256 index) external view returns (bytes32) {
    revert('unimplemented');
  }

  function getUserActivityIds(address wallet, uint256 offset, uint256 limit) external view returns (bytes32[] memory) {
    revert('unimplemented');
  }

  function getUserActivityIdsDesc(address wallet, uint256 offset, uint256 limit)
    external
    view
    returns (bytes32[] memory)
  {
    revert('unimplemented');
  }

  function getUserActivities(address wallet, uint256 offset, uint256 limit)
    external
    view
    returns (bytes32[] memory ids, ActivityRecord[] memory items)
  {
    revert('unimplemented');
  }

  function getUserActivitiesDesc(address wallet, uint256 offset, uint256 limit)
    external
    view
    returns (bytes32[] memory ids, ActivityRecord[] memory items)
  {
    revert('unimplemented');
  }

  function getPayableActivityCount(bytes32 payableId) external view returns (uint256) {
    revert('unimplemented');
  }

  function getPayableActivityIdAt(bytes32 payableId, uint256 index) external view returns (bytes32) {
    revert('unimplemented');
  }

  function getPayableActivityIds(bytes32 payableId, uint256 offset, uint256 limit)
    external
    view
    returns (bytes32[] memory)
  {
    revert('unimplemented');
  }

  function getPayableActivityIdsDesc(bytes32 payableId, uint256 offset, uint256 limit)
    external
    view
    returns (bytes32[] memory)
  {
    revert('unimplemented');
  }

  function getPayableActivities(bytes32 payableId, uint256 offset, uint256 limit)
    external
    view
    returns (bytes32[] memory ids, ActivityRecord[] memory items)
  {
    revert('unimplemented');
  }

  function getPayableActivitiesDesc(bytes32 payableId, uint256 offset, uint256 limit)
    external
    view
    returns (bytes32[] memory ids, ActivityRecord[] memory items)
  {
    revert('unimplemented');
  }

  function getUserActivitiesByType(address wallet, ActivityType activityType, uint256 offset, uint256 limit)
    external
    view
    returns (bytes32[] memory ids, ActivityRecord[] memory items, uint256 nextOffset)
  {
    revert('unimplemented');
  }

  function getPayableActivitiesByType(bytes32 payableId, ActivityType activityType, uint256 offset, uint256 limit)
    external
    view
    returns (bytes32[] memory ids, ActivityRecord[] memory items, uint256 nextOffset)
  {
    revert('unimplemented');
  }

  function isUserInitialized(address wallet) external view returns (bool) {
    revert('unimplemented');
  }

  function getUser(address wallet) external view returns (User memory) {
    revert('unimplemented');
  }

  function getUsersBulk(address[] calldata wallets) external view returns (User[] memory) {
    revert('unimplemented');
  }

  function getChainUserCount() external view returns (uint256) {
    revert('unimplemented');
  }

  function getChainUserAt(uint256 index) external view returns (address) {
    revert('unimplemented');
  }

  function getChainUserAddresses(uint256 offset, uint256 limit) external view returns (address[] memory) {
    revert('unimplemented');
  }

  function getChainUserAddressesDesc(uint256 offset, uint256 limit) external view returns (address[] memory) {
    revert('unimplemented');
  }

  function getChainUsers(uint256 offset, uint256 limit) external view returns (UserView[] memory) {
    revert('unimplemented');
  }

  function getChainUsersDesc(uint256 offset, uint256 limit) external view returns (UserView[] memory) {
    revert('unimplemented');
  }
}
