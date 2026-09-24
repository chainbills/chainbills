// SPDX-License-Identifier: Apache 2
pragma solidity ^0.8.30;

import {ICbPaymentViews} from '../interfaces/ICbPaymentViews.sol';
import {CbPagination} from '../libraries/CbPagination.sol';
import {LibPayableStorage} from '../storage/LibPayableStorage.sol';
import {LibPaymentStorage} from '../storage/LibPaymentStorage.sol';
import {LibUserStorage} from '../storage/LibUserStorage.sol';
import {PayablePayment, UserPayment} from '../types/CbTypes.sol';
import {CbFacetBase} from './CbFacetBase.sol';

/// User payment and payable payment reads.
contract CbPaymentViewsFacet is CbFacetBase, ICbPaymentViews {
  // ---------------------------------------------------------------------------
  // User payments (payer receipts)
  // ---------------------------------------------------------------------------

  /// @inheritdoc ICbPaymentViews
  function getUserPayment(bytes32 paymentId) external view returns (UserPayment memory) {
    return LibPaymentStorage.layout().userPayments[paymentId];
  }

  /// @inheritdoc ICbPaymentViews
  function getUserPaymentsBulk(bytes32[] calldata paymentIds) external view returns (UserPayment[] memory payments) {
    LibPaymentStorage.Layout storage $ = LibPaymentStorage.layout();
    payments = new UserPayment[](paymentIds.length);
    for (uint256 i; i < paymentIds.length; i++) {
      payments[i] = $.userPayments[paymentIds[i]];
    }
  }

  /// @inheritdoc ICbPaymentViews
  function getChainUserPaymentCount() external view returns (uint256) {
    return LibPaymentStorage.layout().userPaymentIds.length;
  }

  /// @inheritdoc ICbPaymentViews
  function getChainUserPaymentIdAt(uint256 index) external view returns (bytes32) {
    return LibPaymentStorage.layout().userPaymentIds[index];
  }

  /// @inheritdoc ICbPaymentViews
  function getChainUserPaymentIds(uint256 offset, uint256 limit) external view returns (bytes32[] memory) {
    return CbPagination.bytes32Page(LibPaymentStorage.layout().userPaymentIds, offset, limit);
  }

  /// @inheritdoc ICbPaymentViews
  function getChainUserPaymentIdsDesc(uint256 offset, uint256 limit) external view returns (bytes32[] memory) {
    return CbPagination.bytes32PageDesc(LibPaymentStorage.layout().userPaymentIds, offset, limit);
  }

  /// @inheritdoc ICbPaymentViews
  function getChainUserPayments(uint256 offset, uint256 limit)
    external
    view
    returns (bytes32[] memory ids, UserPayment[] memory items)
  {
    ids = CbPagination.bytes32Page(LibPaymentStorage.layout().userPaymentIds, offset, limit);
    items = _userPayments(ids);
  }

  /// @inheritdoc ICbPaymentViews
  function getChainUserPaymentsDesc(uint256 offset, uint256 limit)
    external
    view
    returns (bytes32[] memory ids, UserPayment[] memory items)
  {
    ids = CbPagination.bytes32PageDesc(LibPaymentStorage.layout().userPaymentIds, offset, limit);
    items = _userPayments(ids);
  }

  /// @inheritdoc ICbPaymentViews
  function getUserPaymentCount(address payer) external view returns (uint256) {
    return LibUserStorage.layout().userPaymentIds[payer].length;
  }

  /// @inheritdoc ICbPaymentViews
  function getUserPaymentIdAt(address payer, uint256 index) external view returns (bytes32) {
    return LibUserStorage.layout().userPaymentIds[payer][index];
  }

  /// @inheritdoc ICbPaymentViews
  function getUserPaymentIds(address payer, uint256 offset, uint256 limit) external view returns (bytes32[] memory) {
    return CbPagination.bytes32Page(LibUserStorage.layout().userPaymentIds[payer], offset, limit);
  }

  /// @inheritdoc ICbPaymentViews
  function getUserPaymentIdsDesc(address payer, uint256 offset, uint256 limit)
    external
    view
    returns (bytes32[] memory)
  {
    return CbPagination.bytes32PageDesc(LibUserStorage.layout().userPaymentIds[payer], offset, limit);
  }

  /// @inheritdoc ICbPaymentViews
  function getUserPayments(address payer, uint256 offset, uint256 limit)
    external
    view
    returns (bytes32[] memory ids, UserPayment[] memory items)
  {
    ids = CbPagination.bytes32Page(LibUserStorage.layout().userPaymentIds[payer], offset, limit);
    items = _userPayments(ids);
  }

  /// @inheritdoc ICbPaymentViews
  function getUserPaymentsDesc(address payer, uint256 offset, uint256 limit)
    external
    view
    returns (bytes32[] memory ids, UserPayment[] memory items)
  {
    ids = CbPagination.bytes32PageDesc(LibUserStorage.layout().userPaymentIds[payer], offset, limit);
    items = _userPayments(ids);
  }

  // ---------------------------------------------------------------------------
  // Payable payments (payable receipts)
  // ---------------------------------------------------------------------------

  /// @inheritdoc ICbPaymentViews
  function getPayablePayment(bytes32 paymentId) external view returns (PayablePayment memory) {
    return LibPaymentStorage.layout().payablePayments[paymentId];
  }

  /// @inheritdoc ICbPaymentViews
  function getPayablePaymentsBulk(bytes32[] calldata paymentIds)
    external
    view
    returns (PayablePayment[] memory payments)
  {
    LibPaymentStorage.Layout storage $ = LibPaymentStorage.layout();
    payments = new PayablePayment[](paymentIds.length);
    for (uint256 i; i < paymentIds.length; i++) {
      payments[i] = $.payablePayments[paymentIds[i]];
    }
  }

  /// @inheritdoc ICbPaymentViews
  function getChainPayablePaymentCount() external view returns (uint256) {
    return LibPaymentStorage.layout().payablePaymentIds.length;
  }

  /// @inheritdoc ICbPaymentViews
  function getChainPayablePaymentIdAt(uint256 index) external view returns (bytes32) {
    return LibPaymentStorage.layout().payablePaymentIds[index];
  }

  /// @inheritdoc ICbPaymentViews
  function getChainPayablePaymentIds(uint256 offset, uint256 limit) external view returns (bytes32[] memory) {
    return CbPagination.bytes32Page(LibPaymentStorage.layout().payablePaymentIds, offset, limit);
  }

  /// @inheritdoc ICbPaymentViews
  function getChainPayablePaymentIdsDesc(uint256 offset, uint256 limit) external view returns (bytes32[] memory) {
    return CbPagination.bytes32PageDesc(LibPaymentStorage.layout().payablePaymentIds, offset, limit);
  }

  /// @inheritdoc ICbPaymentViews
  function getChainPayablePayments(uint256 offset, uint256 limit)
    external
    view
    returns (bytes32[] memory ids, PayablePayment[] memory items)
  {
    ids = CbPagination.bytes32Page(LibPaymentStorage.layout().payablePaymentIds, offset, limit);
    items = _payablePayments(ids);
  }

  /// @inheritdoc ICbPaymentViews
  function getChainPayablePaymentsDesc(uint256 offset, uint256 limit)
    external
    view
    returns (bytes32[] memory ids, PayablePayment[] memory items)
  {
    ids = CbPagination.bytes32PageDesc(LibPaymentStorage.layout().payablePaymentIds, offset, limit);
    items = _payablePayments(ids);
  }

  /// @inheritdoc ICbPaymentViews
  function getPayablePaymentCount(bytes32 payableId) external view returns (uint256) {
    return LibPayableStorage.layout().payablePaymentIds[payableId].length;
  }

  /// @inheritdoc ICbPaymentViews
  function getPayablePaymentIdAt(bytes32 payableId, uint256 index) external view returns (bytes32) {
    return LibPayableStorage.layout().payablePaymentIds[payableId][index];
  }

  /// @inheritdoc ICbPaymentViews
  function getPayablePaymentIds(bytes32 payableId, uint256 offset, uint256 limit)
    external
    view
    returns (bytes32[] memory)
  {
    return CbPagination.bytes32Page(LibPayableStorage.layout().payablePaymentIds[payableId], offset, limit);
  }

  /// @inheritdoc ICbPaymentViews
  function getPayablePaymentIdsDesc(bytes32 payableId, uint256 offset, uint256 limit)
    external
    view
    returns (bytes32[] memory)
  {
    return CbPagination.bytes32PageDesc(LibPayableStorage.layout().payablePaymentIds[payableId], offset, limit);
  }

  /// @inheritdoc ICbPaymentViews
  function getPayablePayments(bytes32 payableId, uint256 offset, uint256 limit)
    external
    view
    returns (bytes32[] memory ids, PayablePayment[] memory items)
  {
    ids = CbPagination.bytes32Page(LibPayableStorage.layout().payablePaymentIds[payableId], offset, limit);
    items = _payablePayments(ids);
  }

  /// @inheritdoc ICbPaymentViews
  function getPayablePaymentsDesc(bytes32 payableId, uint256 offset, uint256 limit)
    external
    view
    returns (bytes32[] memory ids, PayablePayment[] memory items)
  {
    ids = CbPagination.bytes32PageDesc(LibPayableStorage.layout().payablePaymentIds[payableId], offset, limit);
    items = _payablePayments(ids);
  }

  /// @inheritdoc ICbPaymentViews
  function getPayableChainPaymentCount(bytes32 payableId, bytes32 cbChainId) external view returns (uint256) {
    return LibPayableStorage.layout().payableChainPaymentIds[payableId][cbChainId].length;
  }

  /// @inheritdoc ICbPaymentViews
  function getPayableChainPaymentIdAt(bytes32 payableId, bytes32 cbChainId, uint256 index)
    external
    view
    returns (bytes32)
  {
    return LibPayableStorage.layout().payableChainPaymentIds[payableId][cbChainId][index];
  }

  /// @inheritdoc ICbPaymentViews
  function getPayableChainPaymentIds(bytes32 payableId, bytes32 cbChainId, uint256 offset, uint256 limit)
    external
    view
    returns (bytes32[] memory)
  {
    return CbPagination.bytes32Page(
      LibPayableStorage.layout().payableChainPaymentIds[payableId][cbChainId], offset, limit
    );
  }

  /// @inheritdoc ICbPaymentViews
  function getPayableChainPaymentIdsDesc(bytes32 payableId, bytes32 cbChainId, uint256 offset, uint256 limit)
    external
    view
    returns (bytes32[] memory)
  {
    return CbPagination.bytes32PageDesc(
      LibPayableStorage.layout().payableChainPaymentIds[payableId][cbChainId], offset, limit
    );
  }

  /// @inheritdoc ICbPaymentViews
  function getPayableChainPayments(bytes32 payableId, bytes32 cbChainId, uint256 offset, uint256 limit)
    external
    view
    returns (bytes32[] memory ids, PayablePayment[] memory items)
  {
    ids = CbPagination.bytes32Page(
      LibPayableStorage.layout().payableChainPaymentIds[payableId][cbChainId], offset, limit
    );
    items = _payablePayments(ids);
  }

  /// @inheritdoc ICbPaymentViews
  function getPayableChainPaymentsDesc(bytes32 payableId, bytes32 cbChainId, uint256 offset, uint256 limit)
    external
    view
    returns (bytes32[] memory ids, PayablePayment[] memory items)
  {
    ids = CbPagination.bytes32PageDesc(
      LibPayableStorage.layout().payableChainPaymentIds[payableId][cbChainId], offset, limit
    );
    items = _payablePayments(ids);
  }

  // ---------------------------------------------------------------------------
  // Helpers
  // ---------------------------------------------------------------------------

  /// Loads user payments for `ids`, index-aligned.
  function _userPayments(bytes32[] memory ids) private view returns (UserPayment[] memory items) {
    LibPaymentStorage.Layout storage $ = LibPaymentStorage.layout();
    items = new UserPayment[](ids.length);
    for (uint256 i; i < ids.length; i++) {
      items[i] = $.userPayments[ids[i]];
    }
  }

  /// Loads payable payments for `ids`, index-aligned.
  function _payablePayments(bytes32[] memory ids) private view returns (PayablePayment[] memory items) {
    LibPaymentStorage.Layout storage $ = LibPaymentStorage.layout();
    items = new PayablePayment[](ids.length);
    for (uint256 i; i < ids.length; i++) {
      items[i] = $.payablePayments[ids[i]];
    }
  }
}
