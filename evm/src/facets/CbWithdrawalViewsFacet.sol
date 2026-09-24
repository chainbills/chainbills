// SPDX-License-Identifier: Apache 2
pragma solidity ^0.8.30;

import {ICbWithdrawalViews} from '../interfaces/ICbWithdrawalViews.sol';
import {CbPagination} from '../libraries/CbPagination.sol';
import {LibPayableStorage} from '../storage/LibPayableStorage.sol';
import {LibUserStorage} from '../storage/LibUserStorage.sol';
import {LibWithdrawalStorage} from '../storage/LibWithdrawalStorage.sol';
import {Withdrawal} from '../types/CbTypes.sol';
import {CbFacetBase} from './CbFacetBase.sol';

/// Withdrawal reads.
contract CbWithdrawalViewsFacet is CbFacetBase, ICbWithdrawalViews {
  /// @inheritdoc ICbWithdrawalViews
  function getWithdrawal(bytes32 withdrawalId) external view returns (Withdrawal memory) {
    return LibWithdrawalStorage.layout().withdrawals[withdrawalId];
  }

  /// @inheritdoc ICbWithdrawalViews
  function getWithdrawalsBulk(bytes32[] calldata withdrawalIds)
    external
    view
    returns (Withdrawal[] memory withdrawals)
  {
    LibWithdrawalStorage.Layout storage $ = LibWithdrawalStorage.layout();
    withdrawals = new Withdrawal[](withdrawalIds.length);
    for (uint256 i; i < withdrawalIds.length; i++) {
      withdrawals[i] = $.withdrawals[withdrawalIds[i]];
    }
  }

  /// @inheritdoc ICbWithdrawalViews
  function getChainWithdrawalCount() external view returns (uint256) {
    return LibWithdrawalStorage.layout().withdrawalIds.length;
  }

  /// @inheritdoc ICbWithdrawalViews
  function getChainWithdrawalIdAt(uint256 index) external view returns (bytes32) {
    return LibWithdrawalStorage.layout().withdrawalIds[index];
  }

  /// @inheritdoc ICbWithdrawalViews
  function getChainWithdrawalIds(uint256 offset, uint256 limit) external view returns (bytes32[] memory) {
    return CbPagination.bytes32Page(LibWithdrawalStorage.layout().withdrawalIds, offset, limit);
  }

  /// @inheritdoc ICbWithdrawalViews
  function getChainWithdrawalIdsDesc(uint256 offset, uint256 limit) external view returns (bytes32[] memory) {
    return CbPagination.bytes32PageDesc(LibWithdrawalStorage.layout().withdrawalIds, offset, limit);
  }

  /// @inheritdoc ICbWithdrawalViews
  function getChainWithdrawals(uint256 offset, uint256 limit)
    external
    view
    returns (bytes32[] memory ids, Withdrawal[] memory items)
  {
    ids = CbPagination.bytes32Page(LibWithdrawalStorage.layout().withdrawalIds, offset, limit);
    items = _withdrawals(ids);
  }

  /// @inheritdoc ICbWithdrawalViews
  function getChainWithdrawalsDesc(uint256 offset, uint256 limit)
    external
    view
    returns (bytes32[] memory ids, Withdrawal[] memory items)
  {
    ids = CbPagination.bytes32PageDesc(LibWithdrawalStorage.layout().withdrawalIds, offset, limit);
    items = _withdrawals(ids);
  }

  /// @inheritdoc ICbWithdrawalViews
  function getUserWithdrawalCount(address host) external view returns (uint256) {
    return LibUserStorage.layout().userWithdrawalIds[host].length;
  }

  /// @inheritdoc ICbWithdrawalViews
  function getUserWithdrawalIdAt(address host, uint256 index) external view returns (bytes32) {
    return LibUserStorage.layout().userWithdrawalIds[host][index];
  }

  /// @inheritdoc ICbWithdrawalViews
  function getUserWithdrawalIds(address host, uint256 offset, uint256 limit) external view returns (bytes32[] memory) {
    return CbPagination.bytes32Page(LibUserStorage.layout().userWithdrawalIds[host], offset, limit);
  }

  /// @inheritdoc ICbWithdrawalViews
  function getUserWithdrawalIdsDesc(address host, uint256 offset, uint256 limit)
    external
    view
    returns (bytes32[] memory)
  {
    return CbPagination.bytes32PageDesc(LibUserStorage.layout().userWithdrawalIds[host], offset, limit);
  }

  /// @inheritdoc ICbWithdrawalViews
  function getUserWithdrawals(address host, uint256 offset, uint256 limit)
    external
    view
    returns (bytes32[] memory ids, Withdrawal[] memory items)
  {
    ids = CbPagination.bytes32Page(LibUserStorage.layout().userWithdrawalIds[host], offset, limit);
    items = _withdrawals(ids);
  }

  /// @inheritdoc ICbWithdrawalViews
  function getUserWithdrawalsDesc(address host, uint256 offset, uint256 limit)
    external
    view
    returns (bytes32[] memory ids, Withdrawal[] memory items)
  {
    ids = CbPagination.bytes32PageDesc(LibUserStorage.layout().userWithdrawalIds[host], offset, limit);
    items = _withdrawals(ids);
  }

  /// @inheritdoc ICbWithdrawalViews
  function getPayableWithdrawalCount(bytes32 payableId) external view returns (uint256) {
    return LibPayableStorage.layout().payableWithdrawalIds[payableId].length;
  }

  /// @inheritdoc ICbWithdrawalViews
  function getPayableWithdrawalIdAt(bytes32 payableId, uint256 index) external view returns (bytes32) {
    return LibPayableStorage.layout().payableWithdrawalIds[payableId][index];
  }

  /// @inheritdoc ICbWithdrawalViews
  function getPayableWithdrawalIds(bytes32 payableId, uint256 offset, uint256 limit)
    external
    view
    returns (bytes32[] memory)
  {
    return CbPagination.bytes32Page(LibPayableStorage.layout().payableWithdrawalIds[payableId], offset, limit);
  }

  /// @inheritdoc ICbWithdrawalViews
  function getPayableWithdrawalIdsDesc(bytes32 payableId, uint256 offset, uint256 limit)
    external
    view
    returns (bytes32[] memory)
  {
    return CbPagination.bytes32PageDesc(LibPayableStorage.layout().payableWithdrawalIds[payableId], offset, limit);
  }

  /// @inheritdoc ICbWithdrawalViews
  function getPayableWithdrawals(bytes32 payableId, uint256 offset, uint256 limit)
    external
    view
    returns (bytes32[] memory ids, Withdrawal[] memory items)
  {
    ids = CbPagination.bytes32Page(LibPayableStorage.layout().payableWithdrawalIds[payableId], offset, limit);
    items = _withdrawals(ids);
  }

  /// @inheritdoc ICbWithdrawalViews
  function getPayableWithdrawalsDesc(bytes32 payableId, uint256 offset, uint256 limit)
    external
    view
    returns (bytes32[] memory ids, Withdrawal[] memory items)
  {
    ids = CbPagination.bytes32PageDesc(LibPayableStorage.layout().payableWithdrawalIds[payableId], offset, limit);
    items = _withdrawals(ids);
  }

  /// Loads withdrawals for `ids`, index-aligned.
  function _withdrawals(bytes32[] memory ids) private view returns (Withdrawal[] memory items) {
    LibWithdrawalStorage.Layout storage $ = LibWithdrawalStorage.layout();
    items = new Withdrawal[](ids.length);
    for (uint256 i; i < ids.length; i++) {
      items[i] = $.withdrawals[ids[i]];
    }
  }
}
