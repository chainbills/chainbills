// SPDX-License-Identifier: Apache 2
pragma solidity ^0.8.30;

import {PayablePayment, UserPayment} from 'src/types/CbTypes.sol';
import {CbTestBase} from '../base/CbTestBase.sol';

/// Every payment view on an empty diamond. Populated-state coverage lands once operation facets can record payments.
contract PaymentViewsTest is CbTestBase {
  bytes32 private constant UNKNOWN_ID = keccak256('unknown-payment');
  bytes32 private constant UNKNOWN_PAYABLE = keccak256('unknown-payable');
  bytes32 private constant UNKNOWN_CHAIN = keccak256('eip155:999');

  // ---------------------------------------------------------------------------
  // User payments
  // ---------------------------------------------------------------------------

  function test_GetUserPayment_ZeroWhenUnknown() public view {
    UserPayment memory payment = cb.getUserPayment(UNKNOWN_ID);
    assertEq(payment.payer, address(0));
    assertEq(payment.payableId, bytes32(0));
  }

  function test_GetUserPaymentsBulk_ZeroEntries() public view {
    bytes32[] memory ids = new bytes32[](1);
    ids[0] = UNKNOWN_ID;
    UserPayment[] memory payments = cb.getUserPaymentsBulk(ids);
    assertEq(payments.length, 1);
    assertEq(payments[0].payer, address(0));
  }

  function test_ChainUserPayments_EmptyOnEmptyDiamond() public view {
    assertEq(cb.getChainUserPaymentCount(), 0);
    assertEq(cb.getChainUserPaymentIds(0, 10).length, 0);
    assertEq(cb.getChainUserPaymentIdsDesc(0, 10).length, 0);
    (bytes32[] memory ids, UserPayment[] memory items) = cb.getChainUserPayments(0, 10);
    assertEq(ids.length, 0);
    assertEq(items.length, 0);
    (ids, items) = cb.getChainUserPaymentsDesc(0, 10);
    assertEq(ids.length, 0);
    assertEq(items.length, 0);
  }

  function test_GetChainUserPaymentIdAt_RevertsPastEnd() public {
    vm.expectRevert();
    cb.getChainUserPaymentIdAt(0);
  }

  function test_UserPayments_EmptyOnEmptyDiamond() public view {
    assertEq(cb.getUserPaymentCount(payer), 0);
    assertEq(cb.getUserPaymentIds(payer, 0, 10).length, 0);
    assertEq(cb.getUserPaymentIdsDesc(payer, 0, 10).length, 0);
    (bytes32[] memory ids, UserPayment[] memory items) = cb.getUserPayments(payer, 0, 10);
    assertEq(ids.length, 0);
    assertEq(items.length, 0);
    (ids, items) = cb.getUserPaymentsDesc(payer, 0, 10);
    assertEq(ids.length, 0);
    assertEq(items.length, 0);
  }

  function test_GetUserPaymentIdAt_RevertsPastEnd() public {
    vm.expectRevert();
    cb.getUserPaymentIdAt(payer, 0);
  }

  // ---------------------------------------------------------------------------
  // Payable payments
  // ---------------------------------------------------------------------------

  function test_GetPayablePayment_ZeroWhenUnknown() public view {
    PayablePayment memory payment = cb.getPayablePayment(UNKNOWN_ID);
    assertEq(payment.token, address(0));
    assertEq(payment.payableId, bytes32(0));
  }

  function test_GetPayablePaymentsBulk_ZeroEntries() public view {
    bytes32[] memory ids = new bytes32[](1);
    ids[0] = UNKNOWN_ID;
    PayablePayment[] memory payments = cb.getPayablePaymentsBulk(ids);
    assertEq(payments.length, 1);
    assertEq(payments[0].token, address(0));
  }

  function test_ChainPayablePayments_EmptyOnEmptyDiamond() public view {
    assertEq(cb.getChainPayablePaymentCount(), 0);
    assertEq(cb.getChainPayablePaymentIds(0, 10).length, 0);
    assertEq(cb.getChainPayablePaymentIdsDesc(0, 10).length, 0);
    (bytes32[] memory ids, PayablePayment[] memory items) = cb.getChainPayablePayments(0, 10);
    assertEq(ids.length, 0);
    assertEq(items.length, 0);
    (ids, items) = cb.getChainPayablePaymentsDesc(0, 10);
    assertEq(ids.length, 0);
    assertEq(items.length, 0);
  }

  function test_GetChainPayablePaymentIdAt_RevertsPastEnd() public {
    vm.expectRevert();
    cb.getChainPayablePaymentIdAt(0);
  }

  function test_PayablePayments_EmptyOnEmptyDiamond() public view {
    assertEq(cb.getPayablePaymentCount(UNKNOWN_PAYABLE), 0);
    assertEq(cb.getPayablePaymentIds(UNKNOWN_PAYABLE, 0, 10).length, 0);
    assertEq(cb.getPayablePaymentIdsDesc(UNKNOWN_PAYABLE, 0, 10).length, 0);
    (bytes32[] memory ids, PayablePayment[] memory items) = cb.getPayablePayments(UNKNOWN_PAYABLE, 0, 10);
    assertEq(ids.length, 0);
    assertEq(items.length, 0);
    (ids, items) = cb.getPayablePaymentsDesc(UNKNOWN_PAYABLE, 0, 10);
    assertEq(ids.length, 0);
    assertEq(items.length, 0);
  }

  function test_GetPayablePaymentIdAt_RevertsPastEnd() public {
    vm.expectRevert();
    cb.getPayablePaymentIdAt(UNKNOWN_PAYABLE, 0);
  }

  function test_PayableChainPayments_EmptyOnEmptyDiamond() public view {
    assertEq(cb.getPayableChainPaymentCount(UNKNOWN_PAYABLE, UNKNOWN_CHAIN), 0);
    assertEq(cb.getPayableChainPaymentIds(UNKNOWN_PAYABLE, UNKNOWN_CHAIN, 0, 10).length, 0);
    assertEq(cb.getPayableChainPaymentIdsDesc(UNKNOWN_PAYABLE, UNKNOWN_CHAIN, 0, 10).length, 0);
    (bytes32[] memory ids, PayablePayment[] memory items) =
      cb.getPayableChainPayments(UNKNOWN_PAYABLE, UNKNOWN_CHAIN, 0, 10);
    assertEq(ids.length, 0);
    assertEq(items.length, 0);
    (ids, items) = cb.getPayableChainPaymentsDesc(UNKNOWN_PAYABLE, UNKNOWN_CHAIN, 0, 10);
    assertEq(ids.length, 0);
    assertEq(items.length, 0);
  }

  function test_GetPayableChainPaymentIdAt_RevertsPastEnd() public {
    vm.expectRevert();
    cb.getPayableChainPaymentIdAt(UNKNOWN_PAYABLE, UNKNOWN_CHAIN, 0);
  }
}
