// SPDX-License-Identifier: Apache 2
pragma solidity ^0.8.30;

import {ICbPaymentViews} from '../interfaces/ICbPaymentViews.sol';
import {PayablePayment, UserPayment} from '../types/CbTypes.sol';
import {CbFacetBase} from './CbFacetBase.sol';

contract CbPaymentViewsFacet is CbFacetBase, ICbPaymentViews {
  function getUserPayment(bytes32 paymentId) external view returns (UserPayment memory) {
    revert('unimplemented');
  }

  function getUserPaymentsBulk(bytes32[] calldata paymentIds) external view returns (UserPayment[] memory) {
    revert('unimplemented');
  }

  function getChainUserPaymentCount() external view returns (uint256) {
    revert('unimplemented');
  }

  function getChainUserPaymentIdAt(uint256 index) external view returns (bytes32) {
    revert('unimplemented');
  }

  function getChainUserPaymentIds(uint256 offset, uint256 limit) external view returns (bytes32[] memory) {
    revert('unimplemented');
  }

  function getChainUserPaymentIdsDesc(uint256 offset, uint256 limit) external view returns (bytes32[] memory) {
    revert('unimplemented');
  }

  function getChainUserPayments(uint256 offset, uint256 limit)
    external
    view
    returns (bytes32[] memory ids, UserPayment[] memory items)
  {
    revert('unimplemented');
  }

  function getChainUserPaymentsDesc(uint256 offset, uint256 limit)
    external
    view
    returns (bytes32[] memory ids, UserPayment[] memory items)
  {
    revert('unimplemented');
  }

  function getUserPaymentCount(address payer) external view returns (uint256) {
    revert('unimplemented');
  }

  function getUserPaymentIdAt(address payer, uint256 index) external view returns (bytes32) {
    revert('unimplemented');
  }

  function getUserPaymentIds(address payer, uint256 offset, uint256 limit) external view returns (bytes32[] memory) {
    revert('unimplemented');
  }

  function getUserPaymentIdsDesc(address payer, uint256 offset, uint256 limit)
    external
    view
    returns (bytes32[] memory)
  {
    revert('unimplemented');
  }

  function getUserPayments(address payer, uint256 offset, uint256 limit)
    external
    view
    returns (bytes32[] memory ids, UserPayment[] memory items)
  {
    revert('unimplemented');
  }

  function getUserPaymentsDesc(address payer, uint256 offset, uint256 limit)
    external
    view
    returns (bytes32[] memory ids, UserPayment[] memory items)
  {
    revert('unimplemented');
  }

  function getPayablePayment(bytes32 paymentId) external view returns (PayablePayment memory) {
    revert('unimplemented');
  }

  function getPayablePaymentsBulk(bytes32[] calldata paymentIds) external view returns (PayablePayment[] memory) {
    revert('unimplemented');
  }

  function getChainPayablePaymentCount() external view returns (uint256) {
    revert('unimplemented');
  }

  function getChainPayablePaymentIdAt(uint256 index) external view returns (bytes32) {
    revert('unimplemented');
  }

  function getChainPayablePaymentIds(uint256 offset, uint256 limit) external view returns (bytes32[] memory) {
    revert('unimplemented');
  }

  function getChainPayablePaymentIdsDesc(uint256 offset, uint256 limit) external view returns (bytes32[] memory) {
    revert('unimplemented');
  }

  function getChainPayablePayments(uint256 offset, uint256 limit)
    external
    view
    returns (bytes32[] memory ids, PayablePayment[] memory items)
  {
    revert('unimplemented');
  }

  function getChainPayablePaymentsDesc(uint256 offset, uint256 limit)
    external
    view
    returns (bytes32[] memory ids, PayablePayment[] memory items)
  {
    revert('unimplemented');
  }

  function getPayablePaymentCount(bytes32 payableId) external view returns (uint256) {
    revert('unimplemented');
  }

  function getPayablePaymentIdAt(bytes32 payableId, uint256 index) external view returns (bytes32) {
    revert('unimplemented');
  }

  function getPayablePaymentIds(bytes32 payableId, uint256 offset, uint256 limit)
    external
    view
    returns (bytes32[] memory)
  {
    revert('unimplemented');
  }

  function getPayablePaymentIdsDesc(bytes32 payableId, uint256 offset, uint256 limit)
    external
    view
    returns (bytes32[] memory)
  {
    revert('unimplemented');
  }

  function getPayablePayments(bytes32 payableId, uint256 offset, uint256 limit)
    external
    view
    returns (bytes32[] memory ids, PayablePayment[] memory items)
  {
    revert('unimplemented');
  }

  function getPayablePaymentsDesc(bytes32 payableId, uint256 offset, uint256 limit)
    external
    view
    returns (bytes32[] memory ids, PayablePayment[] memory items)
  {
    revert('unimplemented');
  }

  function getPayableChainPaymentCount(bytes32 payableId, bytes32 cbChainId) external view returns (uint256) {
    revert('unimplemented');
  }

  function getPayableChainPaymentIdAt(bytes32 payableId, bytes32 cbChainId, uint256 index)
    external
    view
    returns (bytes32)
  {
    revert('unimplemented');
  }

  function getPayableChainPaymentIds(bytes32 payableId, bytes32 cbChainId, uint256 offset, uint256 limit)
    external
    view
    returns (bytes32[] memory)
  {
    revert('unimplemented');
  }

  function getPayableChainPaymentIdsDesc(bytes32 payableId, bytes32 cbChainId, uint256 offset, uint256 limit)
    external
    view
    returns (bytes32[] memory)
  {
    revert('unimplemented');
  }

  function getPayableChainPayments(bytes32 payableId, bytes32 cbChainId, uint256 offset, uint256 limit)
    external
    view
    returns (bytes32[] memory ids, PayablePayment[] memory items)
  {
    revert('unimplemented');
  }

  function getPayableChainPaymentsDesc(bytes32 payableId, bytes32 cbChainId, uint256 offset, uint256 limit)
    external
    view
    returns (bytes32[] memory ids, PayablePayment[] memory items)
  {
    revert('unimplemented');
  }
}
