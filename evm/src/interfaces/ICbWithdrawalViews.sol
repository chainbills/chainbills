// SPDX-License-Identifier: Apache 2
pragma solidity ^0.8.30;

import {Withdrawal} from '../types/CbTypes.sol';

/// Withdrawal reads.
/// @dev Paginated functions return empty arrays when `offset` is past the end. `...Desc` variants count `offset`
/// from the newest entry and return newest first. Entity pages return IDs and records index-aligned.
interface ICbWithdrawalViews {
  function getWithdrawal(bytes32 withdrawalId) external view returns (Withdrawal memory);
  function getWithdrawalsBulk(bytes32[] calldata withdrawalIds) external view returns (Withdrawal[] memory);

  function getChainWithdrawalCount() external view returns (uint256);
  function getChainWithdrawalIdAt(uint256 index) external view returns (bytes32);
  function getChainWithdrawalIds(uint256 offset, uint256 limit) external view returns (bytes32[] memory);
  function getChainWithdrawalIdsDesc(uint256 offset, uint256 limit) external view returns (bytes32[] memory);
  function getChainWithdrawals(uint256 offset, uint256 limit)
    external
    view
    returns (bytes32[] memory ids, Withdrawal[] memory items);
  function getChainWithdrawalsDesc(uint256 offset, uint256 limit)
    external
    view
    returns (bytes32[] memory ids, Withdrawal[] memory items);

  function getUserWithdrawalCount(address host) external view returns (uint256);
  function getUserWithdrawalIdAt(address host, uint256 index) external view returns (bytes32);
  function getUserWithdrawalIds(address host, uint256 offset, uint256 limit) external view returns (bytes32[] memory);
  function getUserWithdrawalIdsDesc(address host, uint256 offset, uint256 limit)
    external
    view
    returns (bytes32[] memory);
  function getUserWithdrawals(address host, uint256 offset, uint256 limit)
    external
    view
    returns (bytes32[] memory ids, Withdrawal[] memory items);
  function getUserWithdrawalsDesc(address host, uint256 offset, uint256 limit)
    external
    view
    returns (bytes32[] memory ids, Withdrawal[] memory items);

  function getPayableWithdrawalCount(bytes32 payableId) external view returns (uint256);
  function getPayableWithdrawalIdAt(bytes32 payableId, uint256 index) external view returns (bytes32);
  function getPayableWithdrawalIds(bytes32 payableId, uint256 offset, uint256 limit)
    external
    view
    returns (bytes32[] memory);
  function getPayableWithdrawalIdsDesc(bytes32 payableId, uint256 offset, uint256 limit)
    external
    view
    returns (bytes32[] memory);
  function getPayableWithdrawals(bytes32 payableId, uint256 offset, uint256 limit)
    external
    view
    returns (bytes32[] memory ids, Withdrawal[] memory items);
  function getPayableWithdrawalsDesc(bytes32 payableId, uint256 offset, uint256 limit)
    external
    view
    returns (bytes32[] memory ids, Withdrawal[] memory items);
}
