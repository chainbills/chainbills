// SPDX-License-Identifier: Apache 2
pragma solidity ^0.8.30;

import {
  ForeignPayableView,
  Payable,
  PayableForeign,
  PayableView,
  TokenAndAmount,
  TokenAndAmountForeign
} from '../types/CbTypes.sol';

/// Local and foreign payable reads.
/// @dev Paginated functions return an empty array when `offset` is past the end. `...Desc` variants count `offset`
/// from the newest entry and return newest first.
interface ICbPayableViews {
  // ---------------------------------------------------------------------------
  // Local payables
  // ---------------------------------------------------------------------------

  function payableExists(bytes32 payableId) external view returns (bool);
  function isPayableHost(bytes32 payableId, address account) external view returns (bool);
  function getPayable(bytes32 payableId) external view returns (Payable memory);
  function getPayablesBulk(bytes32[] calldata payableIds) external view returns (Payable[] memory);
  function getPayableView(bytes32 payableId) external view returns (PayableView memory);
  function getPayableViewsBulk(bytes32[] calldata payableIds) external view returns (PayableView[] memory);
  function getAllowedTokensAndAmounts(bytes32 payableId) external view returns (TokenAndAmount[] memory);
  function getBalances(bytes32 payableId) external view returns (TokenAndAmount[] memory);
  function getBalance(bytes32 payableId, address token) external view returns (uint256);
  function getBalanceTokens(bytes32 payableId) external view returns (address[] memory);

  function getChainPayableCount() external view returns (uint256);
  function getChainPayableIdAt(uint256 index) external view returns (bytes32);
  function getChainPayableIds(uint256 offset, uint256 limit) external view returns (bytes32[] memory);
  function getChainPayableIdsDesc(uint256 offset, uint256 limit) external view returns (bytes32[] memory);
  function getChainPayables(uint256 offset, uint256 limit) external view returns (PayableView[] memory);
  function getChainPayablesDesc(uint256 offset, uint256 limit) external view returns (PayableView[] memory);

  function getUserPayableCount(address host) external view returns (uint256);
  function getUserPayableIdAt(address host, uint256 index) external view returns (bytes32);
  function getUserPayableIds(address host, uint256 offset, uint256 limit) external view returns (bytes32[] memory);
  function getUserPayableIdsDesc(address host, uint256 offset, uint256 limit) external view returns (bytes32[] memory);
  function getUserPayables(address host, uint256 offset, uint256 limit) external view returns (PayableView[] memory);
  function getUserPayablesDesc(address host, uint256 offset, uint256 limit) external view returns (PayableView[] memory);

  // ---------------------------------------------------------------------------
  // Foreign payables
  // ---------------------------------------------------------------------------

  function foreignPayableExists(bytes32 payableId) external view returns (bool);
  function getForeignPayable(bytes32 payableId) external view returns (PayableForeign memory);
  function getForeignPayablesBulk(bytes32[] calldata payableIds) external view returns (PayableForeign[] memory);
  function getForeignPayableView(bytes32 payableId) external view returns (ForeignPayableView memory);
  function getForeignPayableViewsBulk(bytes32[] calldata payableIds) external view returns (ForeignPayableView[] memory);
  function getForeignPayableAllowedTokensAndAmounts(bytes32 payableId)
    external
    view
    returns (TokenAndAmountForeign[] memory);

  function getChainForeignPayableCount() external view returns (uint256);
  function getChainForeignPayableIdAt(uint256 index) external view returns (bytes32);
  function getChainForeignPayableIds(uint256 offset, uint256 limit) external view returns (bytes32[] memory);
  function getChainForeignPayableIdsDesc(uint256 offset, uint256 limit) external view returns (bytes32[] memory);
  function getChainForeignPayables(uint256 offset, uint256 limit) external view returns (ForeignPayableView[] memory);
  function getChainForeignPayablesDesc(uint256 offset, uint256 limit)
    external
    view
    returns (ForeignPayableView[] memory);

  function getForeignPayableCountByChain(bytes32 cbChainId) external view returns (uint256);
  function getForeignPayableIdByChainAt(bytes32 cbChainId, uint256 index) external view returns (bytes32);
  function getForeignPayableIdsByChain(bytes32 cbChainId, uint256 offset, uint256 limit)
    external
    view
    returns (bytes32[] memory);
  function getForeignPayableIdsByChainDesc(bytes32 cbChainId, uint256 offset, uint256 limit)
    external
    view
    returns (bytes32[] memory);
  function getForeignPayablesByChain(bytes32 cbChainId, uint256 offset, uint256 limit)
    external
    view
    returns (ForeignPayableView[] memory);
  function getForeignPayablesByChainDesc(bytes32 cbChainId, uint256 offset, uint256 limit)
    external
    view
    returns (ForeignPayableView[] memory);
}
