// SPDX-License-Identifier: Apache 2
pragma solidity ^0.8.30;

import {ICbPayableViews} from '../interfaces/ICbPayableViews.sol';
import {
  ForeignPayableView,
  Payable,
  PayableForeign,
  PayableView,
  TokenAndAmount,
  TokenAndAmountForeign
} from '../types/CbTypes.sol';
import {CbFacetBase} from './CbFacetBase.sol';

contract CbPayableViewsFacet is CbFacetBase, ICbPayableViews {
  function payableExists(bytes32 payableId) external view returns (bool) {
    revert('unimplemented');
  }

  function isPayableHost(bytes32 payableId, address account) external view returns (bool) {
    revert('unimplemented');
  }

  function getPayable(bytes32 payableId) external view returns (Payable memory) {
    revert('unimplemented');
  }

  function getPayablesBulk(bytes32[] calldata payableIds) external view returns (Payable[] memory) {
    revert('unimplemented');
  }

  function getPayableView(bytes32 payableId) external view returns (PayableView memory) {
    revert('unimplemented');
  }

  function getPayableViewsBulk(bytes32[] calldata payableIds) external view returns (PayableView[] memory) {
    revert('unimplemented');
  }

  function getAllowedTokensAndAmounts(bytes32 payableId) external view returns (TokenAndAmount[] memory) {
    revert('unimplemented');
  }

  function getBalances(bytes32 payableId) external view returns (TokenAndAmount[] memory) {
    revert('unimplemented');
  }

  function getBalance(bytes32 payableId, address token) external view returns (uint256) {
    revert('unimplemented');
  }

  function getBalanceTokens(bytes32 payableId) external view returns (address[] memory) {
    revert('unimplemented');
  }

  function getChainPayableCount() external view returns (uint256) {
    revert('unimplemented');
  }

  function getChainPayableIdAt(uint256 index) external view returns (bytes32) {
    revert('unimplemented');
  }

  function getChainPayableIds(uint256 offset, uint256 limit) external view returns (bytes32[] memory) {
    revert('unimplemented');
  }

  function getChainPayableIdsDesc(uint256 offset, uint256 limit) external view returns (bytes32[] memory) {
    revert('unimplemented');
  }

  function getChainPayables(uint256 offset, uint256 limit) external view returns (PayableView[] memory) {
    revert('unimplemented');
  }

  function getChainPayablesDesc(uint256 offset, uint256 limit) external view returns (PayableView[] memory) {
    revert('unimplemented');
  }

  function getUserPayableCount(address host) external view returns (uint256) {
    revert('unimplemented');
  }

  function getUserPayableIdAt(address host, uint256 index) external view returns (bytes32) {
    revert('unimplemented');
  }

  function getUserPayableIds(address host, uint256 offset, uint256 limit) external view returns (bytes32[] memory) {
    revert('unimplemented');
  }

  function getUserPayableIdsDesc(address host, uint256 offset, uint256 limit) external view returns (bytes32[] memory) {
    revert('unimplemented');
  }

  function getUserPayables(address host, uint256 offset, uint256 limit) external view returns (PayableView[] memory) {
    revert('unimplemented');
  }

  function getUserPayablesDesc(address host, uint256 offset, uint256 limit)
    external
    view
    returns (PayableView[] memory)
  {
    revert('unimplemented');
  }

  function foreignPayableExists(bytes32 payableId) external view returns (bool) {
    revert('unimplemented');
  }

  function getForeignPayable(bytes32 payableId) external view returns (PayableForeign memory) {
    revert('unimplemented');
  }

  function getForeignPayablesBulk(bytes32[] calldata payableIds) external view returns (PayableForeign[] memory) {
    revert('unimplemented');
  }

  function getForeignPayableView(bytes32 payableId) external view returns (ForeignPayableView memory) {
    revert('unimplemented');
  }

  function getForeignPayableViewsBulk(bytes32[] calldata payableIds)
    external
    view
    returns (ForeignPayableView[] memory)
  {
    revert('unimplemented');
  }

  function getForeignPayableAllowedTokensAndAmounts(bytes32 payableId)
    external
    view
    returns (TokenAndAmountForeign[] memory)
  {
    revert('unimplemented');
  }

  function getChainForeignPayableCount() external view returns (uint256) {
    revert('unimplemented');
  }

  function getChainForeignPayableIdAt(uint256 index) external view returns (bytes32) {
    revert('unimplemented');
  }

  function getChainForeignPayableIds(uint256 offset, uint256 limit) external view returns (bytes32[] memory) {
    revert('unimplemented');
  }

  function getChainForeignPayableIdsDesc(uint256 offset, uint256 limit) external view returns (bytes32[] memory) {
    revert('unimplemented');
  }

  function getChainForeignPayables(uint256 offset, uint256 limit) external view returns (ForeignPayableView[] memory) {
    revert('unimplemented');
  }

  function getChainForeignPayablesDesc(uint256 offset, uint256 limit)
    external
    view
    returns (ForeignPayableView[] memory)
  {
    revert('unimplemented');
  }

  function getForeignPayableCountByChain(bytes32 cbChainId) external view returns (uint256) {
    revert('unimplemented');
  }

  function getForeignPayableIdByChainAt(bytes32 cbChainId, uint256 index) external view returns (bytes32) {
    revert('unimplemented');
  }

  function getForeignPayableIdsByChain(bytes32 cbChainId, uint256 offset, uint256 limit)
    external
    view
    returns (bytes32[] memory)
  {
    revert('unimplemented');
  }

  function getForeignPayableIdsByChainDesc(bytes32 cbChainId, uint256 offset, uint256 limit)
    external
    view
    returns (bytes32[] memory)
  {
    revert('unimplemented');
  }

  function getForeignPayablesByChain(bytes32 cbChainId, uint256 offset, uint256 limit)
    external
    view
    returns (ForeignPayableView[] memory)
  {
    revert('unimplemented');
  }

  function getForeignPayablesByChainDesc(bytes32 cbChainId, uint256 offset, uint256 limit)
    external
    view
    returns (ForeignPayableView[] memory)
  {
    revert('unimplemented');
  }
}
