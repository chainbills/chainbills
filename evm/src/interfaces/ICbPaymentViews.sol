// SPDX-License-Identifier: Apache 2
pragma solidity ^0.8.30;

import {PayablePayment, UserPayment} from '../types/CbTypes.sol';

/// User payment and payable payment reads.
/// @dev Paginated functions return empty arrays when `offset` is past the end. `...Desc` variants count `offset`
/// from the newest entry and return newest first. Entity pages return IDs and records index-aligned.
interface ICbPaymentViews {
  // ---------------------------------------------------------------------------
  // User payments (payer receipts)
  // ---------------------------------------------------------------------------

  function getUserPayment(bytes32 paymentId) external view returns (UserPayment memory);
  function getUserPaymentsBulk(bytes32[] calldata paymentIds) external view returns (UserPayment[] memory);

  function getChainUserPaymentCount() external view returns (uint256);
  function getChainUserPaymentIdAt(uint256 index) external view returns (bytes32);
  function getChainUserPaymentIds(uint256 offset, uint256 limit) external view returns (bytes32[] memory);
  function getChainUserPaymentIdsDesc(uint256 offset, uint256 limit) external view returns (bytes32[] memory);
  function getChainUserPayments(uint256 offset, uint256 limit)
    external
    view
    returns (bytes32[] memory ids, UserPayment[] memory items);
  function getChainUserPaymentsDesc(uint256 offset, uint256 limit)
    external
    view
    returns (bytes32[] memory ids, UserPayment[] memory items);

  function getUserPaymentCount(address payer) external view returns (uint256);
  function getUserPaymentIdAt(address payer, uint256 index) external view returns (bytes32);
  function getUserPaymentIds(address payer, uint256 offset, uint256 limit) external view returns (bytes32[] memory);
  function getUserPaymentIdsDesc(address payer, uint256 offset, uint256 limit) external view returns (bytes32[] memory);
  function getUserPayments(address payer, uint256 offset, uint256 limit)
    external
    view
    returns (bytes32[] memory ids, UserPayment[] memory items);
  function getUserPaymentsDesc(address payer, uint256 offset, uint256 limit)
    external
    view
    returns (bytes32[] memory ids, UserPayment[] memory items);

  // ---------------------------------------------------------------------------
  // Payable payments (payable receipts)
  // ---------------------------------------------------------------------------

  function getPayablePayment(bytes32 paymentId) external view returns (PayablePayment memory);
  function getPayablePaymentsBulk(bytes32[] calldata paymentIds) external view returns (PayablePayment[] memory);

  function getChainPayablePaymentCount() external view returns (uint256);
  function getChainPayablePaymentIdAt(uint256 index) external view returns (bytes32);
  function getChainPayablePaymentIds(uint256 offset, uint256 limit) external view returns (bytes32[] memory);
  function getChainPayablePaymentIdsDesc(uint256 offset, uint256 limit) external view returns (bytes32[] memory);
  function getChainPayablePayments(uint256 offset, uint256 limit)
    external
    view
    returns (bytes32[] memory ids, PayablePayment[] memory items);
  function getChainPayablePaymentsDesc(uint256 offset, uint256 limit)
    external
    view
    returns (bytes32[] memory ids, PayablePayment[] memory items);

  function getPayablePaymentCount(bytes32 payableId) external view returns (uint256);
  function getPayablePaymentIdAt(bytes32 payableId, uint256 index) external view returns (bytes32);
  function getPayablePaymentIds(bytes32 payableId, uint256 offset, uint256 limit)
    external
    view
    returns (bytes32[] memory);
  function getPayablePaymentIdsDesc(bytes32 payableId, uint256 offset, uint256 limit)
    external
    view
    returns (bytes32[] memory);
  function getPayablePayments(bytes32 payableId, uint256 offset, uint256 limit)
    external
    view
    returns (bytes32[] memory ids, PayablePayment[] memory items);
  function getPayablePaymentsDesc(bytes32 payableId, uint256 offset, uint256 limit)
    external
    view
    returns (bytes32[] memory ids, PayablePayment[] memory items);

  function getPayableChainPaymentCount(bytes32 payableId, bytes32 cbChainId) external view returns (uint256);
  function getPayableChainPaymentIdAt(bytes32 payableId, bytes32 cbChainId, uint256 index)
    external
    view
    returns (bytes32);
  function getPayableChainPaymentIds(bytes32 payableId, bytes32 cbChainId, uint256 offset, uint256 limit)
    external
    view
    returns (bytes32[] memory);
  function getPayableChainPaymentIdsDesc(bytes32 payableId, bytes32 cbChainId, uint256 offset, uint256 limit)
    external
    view
    returns (bytes32[] memory);
  function getPayableChainPayments(bytes32 payableId, bytes32 cbChainId, uint256 offset, uint256 limit)
    external
    view
    returns (bytes32[] memory ids, PayablePayment[] memory items);
  function getPayableChainPaymentsDesc(bytes32 payableId, bytes32 cbChainId, uint256 offset, uint256 limit)
    external
    view
    returns (bytes32[] memory ids, PayablePayment[] memory items);
}
