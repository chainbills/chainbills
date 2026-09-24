// SPDX-License-Identifier: Apache 2
pragma solidity ^0.8.30;

import {ICbPayableViews} from '../interfaces/ICbPayableViews.sol';
import {CbPagination} from '../libraries/CbPagination.sol';
import {LibForeignPayableStorage} from '../storage/LibForeignPayableStorage.sol';
import {LibPayableStorage} from '../storage/LibPayableStorage.sol';
import {LibUserStorage} from '../storage/LibUserStorage.sol';
import {
  ForeignPayableView,
  Payable,
  PayableForeign,
  PayableView,
  TokenAndAmount,
  TokenAndAmountForeign
} from '../types/CbTypes.sol';
import {CbFacetBase} from './CbFacetBase.sol';

/// Local and foreign payable reads.
contract CbPayableViewsFacet is CbFacetBase, ICbPayableViews {
  // ---------------------------------------------------------------------------
  // Local payables
  // ---------------------------------------------------------------------------

  /// @inheritdoc ICbPayableViews
  function payableExists(bytes32 payableId) external view returns (bool) {
    return LibPayableStorage.layout().payables[payableId].host != address(0);
  }

  /// @inheritdoc ICbPayableViews
  function isPayableHost(bytes32 payableId, address account) external view returns (bool) {
    return LibPayableStorage.layout().payables[payableId].host == account && account != address(0);
  }

  /// @inheritdoc ICbPayableViews
  function getPayable(bytes32 payableId) external view returns (Payable memory) {
    return LibPayableStorage.layout().payables[payableId];
  }

  /// @inheritdoc ICbPayableViews
  function getPayablesBulk(bytes32[] calldata payableIds) external view returns (Payable[] memory payables) {
    LibPayableStorage.Layout storage $ = LibPayableStorage.layout();
    payables = new Payable[](payableIds.length);
    for (uint256 i; i < payableIds.length; i++) {
      payables[i] = $.payables[payableIds[i]];
    }
  }

  /// @inheritdoc ICbPayableViews
  function getPayableView(bytes32 payableId) external view returns (PayableView memory) {
    return _payableView(payableId);
  }

  /// @inheritdoc ICbPayableViews
  function getPayableViewsBulk(bytes32[] calldata payableIds) external view returns (PayableView[] memory views) {
    views = new PayableView[](payableIds.length);
    for (uint256 i; i < payableIds.length; i++) {
      views[i] = _payableView(payableIds[i]);
    }
  }

  /// @inheritdoc ICbPayableViews
  function getAllowedTokensAndAmounts(bytes32 payableId) external view returns (TokenAndAmount[] memory) {
    return LibPayableStorage.layout().allowedTokensAndAmounts[payableId];
  }

  /// @inheritdoc ICbPayableViews
  function getBalances(bytes32 payableId) external view returns (TokenAndAmount[] memory) {
    return _balances(payableId);
  }

  /// @inheritdoc ICbPayableViews
  function getBalance(bytes32 payableId, address token) external view returns (uint256) {
    return LibPayableStorage.layout().balances[payableId][token];
  }

  /// @inheritdoc ICbPayableViews
  function getBalanceTokens(bytes32 payableId) external view returns (address[] memory) {
    return LibPayableStorage.layout().balanceTokens[payableId];
  }

  /// @inheritdoc ICbPayableViews
  function getChainPayableCount() external view returns (uint256) {
    return LibPayableStorage.layout().payableIds.length;
  }

  /// @inheritdoc ICbPayableViews
  function getChainPayableIdAt(uint256 index) external view returns (bytes32) {
    return LibPayableStorage.layout().payableIds[index];
  }

  /// @inheritdoc ICbPayableViews
  function getChainPayableIds(uint256 offset, uint256 limit) external view returns (bytes32[] memory) {
    return CbPagination.bytes32Page(LibPayableStorage.layout().payableIds, offset, limit);
  }

  /// @inheritdoc ICbPayableViews
  function getChainPayableIdsDesc(uint256 offset, uint256 limit) external view returns (bytes32[] memory) {
    return CbPagination.bytes32PageDesc(LibPayableStorage.layout().payableIds, offset, limit);
  }

  /// @inheritdoc ICbPayableViews
  function getChainPayables(uint256 offset, uint256 limit) external view returns (PayableView[] memory) {
    return _payableViews(CbPagination.bytes32Page(LibPayableStorage.layout().payableIds, offset, limit));
  }

  /// @inheritdoc ICbPayableViews
  function getChainPayablesDesc(uint256 offset, uint256 limit) external view returns (PayableView[] memory) {
    return _payableViews(CbPagination.bytes32PageDesc(LibPayableStorage.layout().payableIds, offset, limit));
  }

  /// @inheritdoc ICbPayableViews
  function getUserPayableCount(address host) external view returns (uint256) {
    return LibUserStorage.layout().userPayableIds[host].length;
  }

  /// @inheritdoc ICbPayableViews
  function getUserPayableIdAt(address host, uint256 index) external view returns (bytes32) {
    return LibUserStorage.layout().userPayableIds[host][index];
  }

  /// @inheritdoc ICbPayableViews
  function getUserPayableIds(address host, uint256 offset, uint256 limit) external view returns (bytes32[] memory) {
    return CbPagination.bytes32Page(LibUserStorage.layout().userPayableIds[host], offset, limit);
  }

  /// @inheritdoc ICbPayableViews
  function getUserPayableIdsDesc(address host, uint256 offset, uint256 limit) external view returns (bytes32[] memory) {
    return CbPagination.bytes32PageDesc(LibUserStorage.layout().userPayableIds[host], offset, limit);
  }

  /// @inheritdoc ICbPayableViews
  function getUserPayables(address host, uint256 offset, uint256 limit) external view returns (PayableView[] memory) {
    return _payableViews(CbPagination.bytes32Page(LibUserStorage.layout().userPayableIds[host], offset, limit));
  }

  /// @inheritdoc ICbPayableViews
  function getUserPayablesDesc(address host, uint256 offset, uint256 limit)
    external
    view
    returns (PayableView[] memory)
  {
    return _payableViews(CbPagination.bytes32PageDesc(LibUserStorage.layout().userPayableIds[host], offset, limit));
  }

  // ---------------------------------------------------------------------------
  // Foreign payables
  // ---------------------------------------------------------------------------

  /// @inheritdoc ICbPayableViews
  function foreignPayableExists(bytes32 payableId) external view returns (bool) {
    return LibForeignPayableStorage.layout().foreignPayables[payableId].chainId != bytes32(0);
  }

  /// @inheritdoc ICbPayableViews
  function getForeignPayable(bytes32 payableId) external view returns (PayableForeign memory) {
    return LibForeignPayableStorage.layout().foreignPayables[payableId];
  }

  /// @inheritdoc ICbPayableViews
  function getForeignPayablesBulk(bytes32[] calldata payableIds)
    external
    view
    returns (PayableForeign[] memory payables)
  {
    LibForeignPayableStorage.Layout storage $ = LibForeignPayableStorage.layout();
    payables = new PayableForeign[](payableIds.length);
    for (uint256 i; i < payableIds.length; i++) {
      payables[i] = $.foreignPayables[payableIds[i]];
    }
  }

  /// @inheritdoc ICbPayableViews
  function getForeignPayableView(bytes32 payableId) external view returns (ForeignPayableView memory) {
    return _foreignPayableView(payableId);
  }

  /// @inheritdoc ICbPayableViews
  function getForeignPayableViewsBulk(bytes32[] calldata payableIds)
    external
    view
    returns (ForeignPayableView[] memory views)
  {
    views = new ForeignPayableView[](payableIds.length);
    for (uint256 i; i < payableIds.length; i++) {
      views[i] = _foreignPayableView(payableIds[i]);
    }
  }

  /// @inheritdoc ICbPayableViews
  function getForeignPayableAllowedTokensAndAmounts(bytes32 payableId)
    external
    view
    returns (TokenAndAmountForeign[] memory)
  {
    return LibForeignPayableStorage.layout().allowedTokensAndAmounts[payableId];
  }

  /// @inheritdoc ICbPayableViews
  function getChainForeignPayableCount() external view returns (uint256) {
    return LibForeignPayableStorage.layout().foreignPayableIds.length;
  }

  /// @inheritdoc ICbPayableViews
  function getChainForeignPayableIdAt(uint256 index) external view returns (bytes32) {
    return LibForeignPayableStorage.layout().foreignPayableIds[index];
  }

  /// @inheritdoc ICbPayableViews
  function getChainForeignPayableIds(uint256 offset, uint256 limit) external view returns (bytes32[] memory) {
    return CbPagination.bytes32Page(LibForeignPayableStorage.layout().foreignPayableIds, offset, limit);
  }

  /// @inheritdoc ICbPayableViews
  function getChainForeignPayableIdsDesc(uint256 offset, uint256 limit) external view returns (bytes32[] memory) {
    return CbPagination.bytes32PageDesc(LibForeignPayableStorage.layout().foreignPayableIds, offset, limit);
  }

  /// @inheritdoc ICbPayableViews
  function getChainForeignPayables(uint256 offset, uint256 limit) external view returns (ForeignPayableView[] memory) {
    return
      _foreignPayableViews(CbPagination.bytes32Page(LibForeignPayableStorage.layout().foreignPayableIds, offset, limit));
  }

  /// @inheritdoc ICbPayableViews
  function getChainForeignPayablesDesc(uint256 offset, uint256 limit)
    external
    view
    returns (ForeignPayableView[] memory)
  {
    return _foreignPayableViews(
      CbPagination.bytes32PageDesc(LibForeignPayableStorage.layout().foreignPayableIds, offset, limit)
    );
  }

  /// @inheritdoc ICbPayableViews
  function getForeignPayableCountByChain(bytes32 cbChainId) external view returns (uint256) {
    return LibForeignPayableStorage.layout().foreignPayableIdsByChain[cbChainId].length;
  }

  /// @inheritdoc ICbPayableViews
  function getForeignPayableIdByChainAt(bytes32 cbChainId, uint256 index) external view returns (bytes32) {
    return LibForeignPayableStorage.layout().foreignPayableIdsByChain[cbChainId][index];
  }

  /// @inheritdoc ICbPayableViews
  function getForeignPayableIdsByChain(bytes32 cbChainId, uint256 offset, uint256 limit)
    external
    view
    returns (bytes32[] memory)
  {
    return
      CbPagination.bytes32Page(LibForeignPayableStorage.layout().foreignPayableIdsByChain[cbChainId], offset, limit);
  }

  /// @inheritdoc ICbPayableViews
  function getForeignPayableIdsByChainDesc(bytes32 cbChainId, uint256 offset, uint256 limit)
    external
    view
    returns (bytes32[] memory)
  {
    return CbPagination.bytes32PageDesc(
      LibForeignPayableStorage.layout().foreignPayableIdsByChain[cbChainId], offset, limit
    );
  }

  /// @inheritdoc ICbPayableViews
  function getForeignPayablesByChain(bytes32 cbChainId, uint256 offset, uint256 limit)
    external
    view
    returns (ForeignPayableView[] memory)
  {
    return _foreignPayableViews(
      CbPagination.bytes32Page(LibForeignPayableStorage.layout().foreignPayableIdsByChain[cbChainId], offset, limit)
    );
  }

  /// @inheritdoc ICbPayableViews
  function getForeignPayablesByChainDesc(bytes32 cbChainId, uint256 offset, uint256 limit)
    external
    view
    returns (ForeignPayableView[] memory)
  {
    return _foreignPayableViews(
      CbPagination.bytes32PageDesc(LibForeignPayableStorage.layout().foreignPayableIdsByChain[cbChainId], offset, limit)
    );
  }

  // ---------------------------------------------------------------------------
  // Helpers
  // ---------------------------------------------------------------------------

  /// Builds the balances of `payableId` from its first-credit-ordered token list.
  function _balances(bytes32 payableId) private view returns (TokenAndAmount[] memory result) {
    LibPayableStorage.Layout storage $ = LibPayableStorage.layout();
    address[] storage tokens = $.balanceTokens[payableId];
    result = new TokenAndAmount[](tokens.length);
    for (uint256 i; i < tokens.length; i++) {
      result[i] = TokenAndAmount({token: tokens[i], amount: $.balances[payableId][tokens[i]]});
    }
  }

  /// Builds the full view of a local payable.
  function _payableView(bytes32 payableId) private view returns (PayableView memory view_) {
    LibPayableStorage.Layout storage $ = LibPayableStorage.layout();
    view_.payableId = payableId;
    view_.info = $.payables[payableId];
    view_.allowedTokensAndAmounts = $.allowedTokensAndAmounts[payableId];
    view_.balances = _balances(payableId);
  }

  /// Builds full views for `payableIds`, index-aligned.
  function _payableViews(bytes32[] memory payableIds) private view returns (PayableView[] memory views) {
    views = new PayableView[](payableIds.length);
    for (uint256 i; i < payableIds.length; i++) {
      views[i] = _payableView(payableIds[i]);
    }
  }

  /// Builds the full view of a foreign payable.
  function _foreignPayableView(bytes32 payableId) private view returns (ForeignPayableView memory view_) {
    LibForeignPayableStorage.Layout storage $ = LibForeignPayableStorage.layout();
    view_.payableId = payableId;
    view_.info = $.foreignPayables[payableId];
    view_.allowedTokensAndAmounts = $.allowedTokensAndAmounts[payableId];
  }

  /// Builds full foreign views for `payableIds`, index-aligned.
  function _foreignPayableViews(bytes32[] memory payableIds) private view returns (ForeignPayableView[] memory views) {
    views = new ForeignPayableView[](payableIds.length);
    for (uint256 i; i < payableIds.length; i++) {
      views[i] = _foreignPayableView(payableIds[i]);
    }
  }
}
