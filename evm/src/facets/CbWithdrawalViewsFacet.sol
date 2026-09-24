// SPDX-License-Identifier: Apache 2
pragma solidity ^0.8.30;

import {ICbWithdrawalViews} from '../interfaces/ICbWithdrawalViews.sol';
import {Withdrawal} from '../types/CbTypes.sol';
import {CbFacetBase} from './CbFacetBase.sol';

contract CbWithdrawalViewsFacet is CbFacetBase, ICbWithdrawalViews {
  function getWithdrawal(bytes32 withdrawalId) external view returns (Withdrawal memory) {
    revert('unimplemented');
  }

  function getWithdrawalsBulk(bytes32[] calldata withdrawalIds) external view returns (Withdrawal[] memory) {
    revert('unimplemented');
  }

  function getChainWithdrawalCount() external view returns (uint256) {
    revert('unimplemented');
  }

  function getChainWithdrawalIdAt(uint256 index) external view returns (bytes32) {
    revert('unimplemented');
  }

  function getChainWithdrawalIds(uint256 offset, uint256 limit) external view returns (bytes32[] memory) {
    revert('unimplemented');
  }

  function getChainWithdrawalIdsDesc(uint256 offset, uint256 limit) external view returns (bytes32[] memory) {
    revert('unimplemented');
  }

  function getChainWithdrawals(uint256 offset, uint256 limit)
    external
    view
    returns (bytes32[] memory ids, Withdrawal[] memory items)
  {
    revert('unimplemented');
  }

  function getChainWithdrawalsDesc(uint256 offset, uint256 limit)
    external
    view
    returns (bytes32[] memory ids, Withdrawal[] memory items)
  {
    revert('unimplemented');
  }

  function getUserWithdrawalCount(address host) external view returns (uint256) {
    revert('unimplemented');
  }

  function getUserWithdrawalIdAt(address host, uint256 index) external view returns (bytes32) {
    revert('unimplemented');
  }

  function getUserWithdrawalIds(address host, uint256 offset, uint256 limit) external view returns (bytes32[] memory) {
    revert('unimplemented');
  }

  function getUserWithdrawalIdsDesc(address host, uint256 offset, uint256 limit)
    external
    view
    returns (bytes32[] memory)
  {
    revert('unimplemented');
  }

  function getUserWithdrawals(address host, uint256 offset, uint256 limit)
    external
    view
    returns (bytes32[] memory ids, Withdrawal[] memory items)
  {
    revert('unimplemented');
  }

  function getUserWithdrawalsDesc(address host, uint256 offset, uint256 limit)
    external
    view
    returns (bytes32[] memory ids, Withdrawal[] memory items)
  {
    revert('unimplemented');
  }

  function getPayableWithdrawalCount(bytes32 payableId) external view returns (uint256) {
    revert('unimplemented');
  }

  function getPayableWithdrawalIdAt(bytes32 payableId, uint256 index) external view returns (bytes32) {
    revert('unimplemented');
  }

  function getPayableWithdrawalIds(bytes32 payableId, uint256 offset, uint256 limit)
    external
    view
    returns (bytes32[] memory)
  {
    revert('unimplemented');
  }

  function getPayableWithdrawalIdsDesc(bytes32 payableId, uint256 offset, uint256 limit)
    external
    view
    returns (bytes32[] memory)
  {
    revert('unimplemented');
  }

  function getPayableWithdrawals(bytes32 payableId, uint256 offset, uint256 limit)
    external
    view
    returns (bytes32[] memory ids, Withdrawal[] memory items)
  {
    revert('unimplemented');
  }

  function getPayableWithdrawalsDesc(bytes32 payableId, uint256 offset, uint256 limit)
    external
    view
    returns (bytes32[] memory ids, Withdrawal[] memory items)
  {
    revert('unimplemented');
  }
}
