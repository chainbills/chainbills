// SPDX-License-Identifier: Apache 2
pragma solidity ^0.8.30;

import {PayablePayment, UserPayment} from 'src/types/CbTypes.sol';
import {PopulatedViewsBase} from './PopulatedViewsBase.sol';

/// User payment and payable payment views after rich two-chain activity.
contract PaymentViewsPopulatedTest is PopulatedViewsBase {
  // ---------------------------------------------------------------------------
  // User payments
  // ---------------------------------------------------------------------------

  function test_GetUserPayment_MatchesEachRecord() public view {
    assertEq(up.length, 9);
    for (uint256 i; i < up.length; i++) {
      UserPayment memory payment = cb.getUserPayment(up[i]);
      _assertUserPayment(payment, expUserPayment[up[i]]);
      assertEq(payment.chainCount, i + 1);
    }
  }

  function test_GetUserPayment_DebitsIncludeTaxBufferAndCctpFee() public view {
    // TAX: priced 10, 10.2 pulled from the payer.
    UserPayment memory taxed = cb.getUserPayment(up[5]);
    assertEq(taxed.requestedAmount, 10e18);
    assertEq(taxed.amount, 10.2e18);
    // Cross-chain: priced 75, 75 + 3 max fee burned; the payable lives on chain B.
    UserPayment memory crossChain = cb.getUserPayment(up[7]);
    assertEq(crossChain.payableId, f1);
    assertEq(crossChain.payableChainId, chainB.cbChainId);
    assertEq(crossChain.requestedAmount, 75e6);
    assertEq(crossChain.amount, 78e6);
    assertEq(crossChain.payerCount, 4);
    // Same-chain payments point at this chain.
    assertEq(cb.getUserPayment(up[0]).payableChainId, chainA.cbChainId);
  }

  function test_GetUserPaymentsBulk_AgreesWithSingleReads() public view {
    bytes32[] memory ids = new bytes32[](up.length + 2);
    for (uint256 i; i < up.length; i++) {
      ids[up.length - 1 - i] = up[i];
    }
    ids[up.length] = UNKNOWN_ID;
    ids[up.length + 1] = up[3];
    UserPayment[] memory payments = cb.getUserPaymentsBulk(ids);
    assertEq(payments.length, ids.length);
    for (uint256 i; i < ids.length; i++) {
      _assertUserPayment(payments[i], cb.getUserPayment(ids[i]));
      _assertUserPayment(payments[i], expUserPayment[ids[i]]);
    }
    assertEq(payments[up.length].payer, address(0));
  }

  function test_GetChainUserPaymentIdAt_MatchesPaymentOrder() public view {
    assertEq(cb.getChainUserPaymentCount(), 9);
    for (uint256 i; i < up.length; i++) {
      assertEq(cb.getChainUserPaymentIdAt(i), up[i]);
    }
  }

  function test_RevertWhen_GetChainUserPaymentIdAt_PastEnd() public {
    vm.expectRevert();
    cb.getChainUserPaymentIdAt(9);
  }

  function test_ChainUserPayments_Paginate() public view {
    _checkPages(_chainUserPaymentIds, _chainUserPaymentIdsDesc, bytes32(0), up, 'chain user payment ids');
    _checkPages(_chainUserPayments, _chainUserPaymentsDesc, bytes32(0), up, 'chain user payments');
  }

  function test_UserPayments_PaginatePerPayer() public view {
    // payer: P1 native, P1 USDC, P3 USDC, F1 cross-chain.
    bytes32[] memory payerIds = new bytes32[](4);
    payerIds[0] = up[0];
    payerIds[1] = up[1];
    payerIds[2] = up[4];
    payerIds[3] = up[7];
    // payer2: P2 native, P2 USDC, P3 native, F1 cross-chain (never relayed).
    bytes32[] memory payer2Ids = new bytes32[](4);
    payer2Ids[0] = up[2];
    payer2Ids[1] = up[3];
    payer2Ids[2] = up[6];
    payer2Ids[3] = up[8];
    bytes32[] memory payer3Ids = new bytes32[](1);
    payer3Ids[0] = up[5];

    _checkUserPayments(payer, payerIds);
    _checkUserPayments(payer2, payer2Ids);
    _checkUserPayments(payer3, payer3Ids);
    _checkUserPayments(host, new bytes32[](0));
    // foreignPayer paid from chain B; chain A holds no receipt of theirs.
    _checkUserPayments(foreignPayer, new bytes32[](0));
  }

  function test_RevertWhen_GetUserPaymentIdAt_PastEnd() public {
    vm.expectRevert();
    cb.getUserPaymentIdAt(payer3, 1);
  }

  function _checkUserPayments(address wallet, bytes32[] memory expected) private view {
    assertEq(cb.getUserPaymentCount(wallet), expected.length);
    for (uint256 i; i < expected.length; i++) {
      assertEq(cb.getUserPaymentIdAt(wallet, i), expected[i]);
      assertEq(cb.getUserPayment(expected[i]).payerCount, i + 1);
    }
    _checkPages(_userPaymentIds, _userPaymentIdsDesc, _toBytes32(wallet), expected, 'user payment ids');
    _checkPages(_userPayments, _userPaymentsDesc, _toBytes32(wallet), expected, 'user payments');
  }

  // ---------------------------------------------------------------------------
  // Payable payments
  // ---------------------------------------------------------------------------

  function test_GetPayablePayment_MatchesEachRecord() public view {
    assertEq(pp.length, 8);
    for (uint256 i; i < pp.length; i++) {
      PayablePayment memory payment = cb.getPayablePayment(pp[i]);
      _assertPayablePayment(payment, expPayablePayment[pp[i]]);
      assertEq(payment.chainCount, i + 1);
    }
  }

  function test_GetPayablePayment_CreditsWhatArrived() public view {
    // TAX: 10.2 pulled, 1% burned in transit.
    PayablePayment memory taxed = cb.getPayablePayment(pp[5]);
    assertEq(taxed.requestedAmount, 10e18);
    assertEq(taxed.amount, 10.098e18);
    // From chain B: 52 burned, Circle kept 1.
    PayablePayment memory crossChain = cb.getPayablePayment(pp[7]);
    assertEq(crossChain.payableId, p2);
    assertEq(crossChain.payer, _toBytes32(foreignPayer));
    assertEq(crossChain.payerChainId, chainB.cbChainId);
    assertEq(crossChain.requestedAmount, 50e6);
    assertEq(crossChain.amount, 51e6);
    assertEq(crossChain.localChainCount, 1);
    assertEq(crossChain.payableCount, 3);
  }

  function test_GetPayablePaymentsBulk_AgreesWithSingleReads() public view {
    bytes32[] memory ids = new bytes32[](pp.length + 2);
    for (uint256 i; i < pp.length; i++) {
      ids[i] = pp[pp.length - 1 - i];
    }
    ids[pp.length] = UNKNOWN_ID;
    // A user payment ID is not a payable payment ID.
    ids[pp.length + 1] = up[0];
    PayablePayment[] memory payments = cb.getPayablePaymentsBulk(ids);
    assertEq(payments.length, ids.length);
    for (uint256 i; i < ids.length; i++) {
      _assertPayablePayment(payments[i], cb.getPayablePayment(ids[i]));
      _assertPayablePayment(payments[i], expPayablePayment[ids[i]]);
    }
    assertEq(payments[pp.length + 1].payableId, bytes32(0));
  }

  function test_SameChainReceipts_LinkUserAndPayablePayments() public view {
    for (uint256 i; i < 7; i++) {
      UserPayment memory userPayment = cb.getUserPayment(up[i]);
      PayablePayment memory payablePayment = cb.getPayablePayment(pp[i]);
      assertEq(payablePayment.payerPaymentId, up[i]);
      assertEq(payablePayment.payableId, userPayment.payableId);
      assertEq(payablePayment.payer, _toBytes32(userPayment.payer));
      assertEq(payablePayment.token, userPayment.token);
      assertEq(payablePayment.requestedAmount, userPayment.requestedAmount);
      assertEq(payablePayment.timestamp, userPayment.timestamp);
    }
  }

  function test_CrossChainReceipts_LinkBothChains() public view {
    // A -> B: payer's receipt on A, F1's receipt on B.
    PayablePayment memory onB = chainB.cb.getPayablePayment(bPayablePaymentId);
    assertEq(onB.payableId, f1);
    assertEq(onB.payer, _toBytes32(payer));
    assertEq(onB.token, address(chainB.usdc));
    assertEq(onB.chainCount, 1);
    assertEq(onB.payerChainId, chainA.cbChainId);
    assertEq(onB.localChainCount, 1);
    assertEq(onB.payableCount, 1);
    assertEq(onB.timestamp, bReceivedAt);
    assertEq(onB.requestedAmount, 75e6);
    assertEq(onB.amount, 75e6);
    assertEq(onB.payerPaymentId, up[7]);
    assertEq(chainB.cb.getChainPayablePaymentCount(), 1);
    assertEq(chainB.cb.getPayableChainPaymentIdAt(f1, chainA.cbChainId, 0), bPayablePaymentId);

    // B -> A: foreignPayer's receipt on B, P2's receipt on A.
    UserPayment memory onBUser = chainB.cb.getUserPayment(bUserPaymentId);
    assertEq(onBUser.payableId, p2);
    assertEq(onBUser.payer, foreignPayer);
    assertEq(onBUser.token, address(chainB.usdc));
    assertEq(onBUser.payableChainId, chainA.cbChainId);
    assertEq(onBUser.chainCount, 1);
    assertEq(onBUser.payerCount, 1);
    assertEq(onBUser.timestamp, bUserPaidAt);
    assertEq(onBUser.requestedAmount, 50e6);
    assertEq(onBUser.amount, 52e6);
    assertEq(cb.getPayablePayment(pp[7]).payerPaymentId, bUserPaymentId);

    // Neither chain holds the other chain's receipts.
    assertEq(cb.getUserPayment(bUserPaymentId).payer, address(0));
    assertEq(chainB.cb.getUserPayment(up[7]).payer, address(0));
    assertEq(chainB.cb.getChainUserPaymentCount(), 1);
  }

  function test_GetChainPayablePaymentIdAt_MatchesReceiptOrder() public view {
    assertEq(cb.getChainPayablePaymentCount(), 8);
    for (uint256 i; i < pp.length; i++) {
      assertEq(cb.getChainPayablePaymentIdAt(i), pp[i]);
    }
  }

  function test_RevertWhen_GetChainPayablePaymentIdAt_PastEnd() public {
    vm.expectRevert();
    cb.getChainPayablePaymentIdAt(8);
  }

  function test_ChainPayablePayments_Paginate() public view {
    _checkPages(_chainPayablePaymentIds, _chainPayablePaymentIdsDesc, bytes32(0), pp, 'chain payable payment ids');
    _checkPages(_chainPayablePayments, _chainPayablePaymentsDesc, bytes32(0), pp, 'chain payable payments');
  }

  function test_PayablePayments_PaginatePerPayable() public view {
    bytes32[] memory p1Ids = new bytes32[](2);
    p1Ids[0] = pp[0];
    p1Ids[1] = pp[1];
    bytes32[] memory p2Ids = new bytes32[](3);
    p2Ids[0] = pp[2];
    p2Ids[1] = pp[3];
    p2Ids[2] = pp[7];
    bytes32[] memory p3Ids = new bytes32[](2);
    p3Ids[0] = pp[4];
    p3Ids[1] = pp[6];
    bytes32[] memory p4Ids = new bytes32[](1);
    p4Ids[0] = pp[5];

    _checkPayablePayments(p1, p1Ids);
    _checkPayablePayments(p2, p2Ids);
    _checkPayablePayments(p3, p3Ids);
    _checkPayablePayments(p4, p4Ids);
    // Foreign payables receive on their own chain.
    _checkPayablePayments(f1, new bytes32[](0));
  }

  function test_RevertWhen_GetPayablePaymentIdAt_PastEnd() public {
    vm.expectRevert();
    cb.getPayablePaymentIdAt(p2, 3);
  }

  function _checkPayablePayments(bytes32 payableId, bytes32[] memory expected) private view {
    assertEq(cb.getPayablePaymentCount(payableId), expected.length);
    assertEq(cb.getPayable(payableId).paymentsCount, expected.length);
    for (uint256 i; i < expected.length; i++) {
      assertEq(cb.getPayablePaymentIdAt(payableId, i), expected[i]);
      assertEq(cb.getPayablePayment(expected[i]).payableCount, i + 1);
    }
    _checkPages(_payablePaymentIds, _payablePaymentIdsDesc, payableId, expected, 'payable payment ids');
    _checkPages(_payablePayments, _payablePaymentsDesc, payableId, expected, 'payable payments');
  }

  function test_PayableChainPayments_SplitByPayerChain() public {
    bytes32[] memory local = new bytes32[](2);
    local[0] = pp[2];
    local[1] = pp[3];
    bytes32[] memory fromB = new bytes32[](1);
    fromB[0] = pp[7];

    assertEq(cb.getPayableChainPaymentCount(p2, chainA.cbChainId), 2);
    assertEq(cb.getPayableChainPaymentCount(p2, chainB.cbChainId), 1);
    assertEq(cb.getPayableChainPaymentCount(p2, UNKNOWN_CHAIN), 0);
    // The per-chain lists partition the payable's list.
    assertEq(
      cb.getPayableChainPaymentCount(p2, chainA.cbChainId) + cb.getPayableChainPaymentCount(p2, chainB.cbChainId),
      cb.getPayablePaymentCount(p2)
    );
    assertEq(cb.getPayableChainPaymentIdAt(p2, chainA.cbChainId, 0), pp[2]);
    assertEq(cb.getPayableChainPaymentIdAt(p2, chainA.cbChainId, 1), pp[3]);
    assertEq(cb.getPayableChainPaymentIdAt(p2, chainB.cbChainId, 0), pp[7]);
    assertEq(cb.getPayablePayment(pp[3]).localChainCount, 2);
    assertEq(cb.getPayablePayment(pp[7]).localChainCount, 1);

    pageChainKey = chainA.cbChainId;
    _checkPages(_payableChainPaymentIds, _payableChainPaymentIdsDesc, p2, local, 'p2 local ids');
    _checkPages(_payableChainPayments, _payableChainPaymentsDesc, p2, local, 'p2 local payments');
    pageChainKey = chainB.cbChainId;
    _checkPages(_payableChainPaymentIds, _payableChainPaymentIdsDesc, p2, fromB, 'p2 chain B ids');
    _checkPages(_payableChainPayments, _payableChainPaymentsDesc, p2, fromB, 'p2 chain B payments');
    pageChainKey = chainB.cbChainId;
    _checkPages(_payableChainPayments, _payableChainPaymentsDesc, p1, new bytes32[](0), 'p1 chain B payments');
  }

  function test_PayableChainPayments_PaginateLocalReceipts() public {
    bytes32[] memory p3Ids = new bytes32[](2);
    p3Ids[0] = pp[4];
    p3Ids[1] = pp[6];
    pageChainKey = chainA.cbChainId;
    _checkPages(_payableChainPaymentIds, _payableChainPaymentIdsDesc, p3, p3Ids, 'p3 local ids');
    _checkPages(_payableChainPayments, _payableChainPaymentsDesc, p3, p3Ids, 'p3 local payments');
  }

  function test_RevertWhen_GetPayableChainPaymentIdAt_PastEnd() public {
    vm.expectRevert();
    cb.getPayableChainPaymentIdAt(p2, chainB.cbChainId, 1);
  }
}
