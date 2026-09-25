// SPDX-License-Identifier: Apache 2
pragma solidity ^0.8.30;

import {Withdrawal, WithdrawalQuote} from 'src/types/CbTypes.sol';
import {PopulatedViewsBase} from './PopulatedViewsBase.sol';

/// Withdrawal views after host withdrawals and auto-withdrawals across three hosts and three tokens.
contract WithdrawalViewsPopulatedTest is PopulatedViewsBase {
  function test_GetWithdrawal_MatchesEachRecord() public view {
    assertEq(wd.length, 6);
    for (uint256 i; i < wd.length; i++) {
      Withdrawal memory withdrawal = cb.getWithdrawal(wd[i]);
      _assertWithdrawal(withdrawal, expWithdrawal[wd[i]]);
      assertEq(withdrawal.chainCount, i + 1);
    }
  }

  function test_GetWithdrawal_FeesFollowTokenPolicy() public view {
    // USDC: 1% override capped at 1.5. 200 -> 2 capped; 300 -> 3 capped; 20 -> 0.2 uncapped.
    assertEq(cb.getWithdrawal(wd[0]).fee, 1.5e6);
    assertEq(cb.getWithdrawal(wd[3]).fee, 1.5e6);
    assertEq(cb.getWithdrawal(wd[4]).fee, 0.2e6);
    // Native and TAX: 2% global fee.
    assertEq(cb.getWithdrawal(wd[1]).fee, 0.01 ether);
    assertEq(cb.getWithdrawal(wd[2]).fee, 0.01 ether);
    assertEq(cb.getWithdrawal(wd[5]).fee, 0.1e18);
  }

  function test_GetWithdrawal_AutoWithdrawalsMirrorTheirPayments() public view {
    // Each auto-withdrawal moves exactly the credited amount at the payment's timestamp.
    Withdrawal memory usdcAuto = cb.getWithdrawal(wd[0]);
    assertEq(usdcAuto.payableId, p3);
    assertEq(usdcAuto.host, host2);
    assertEq(usdcAuto.amount, cb.getPayablePayment(pp[4]).amount);
    assertEq(usdcAuto.timestamp, cb.getPayablePayment(pp[4]).timestamp);
    Withdrawal memory nativeAuto = cb.getWithdrawal(wd[1]);
    assertEq(nativeAuto.amount, cb.getPayablePayment(pp[6]).amount);
    assertEq(nativeAuto.timestamp, cb.getPayablePayment(pp[6]).timestamp);
  }

  function test_QuoteWithdrawalFee_ReproducesRecordedFees() public view {
    for (uint256 i; i < wd.length; i++) {
      Withdrawal memory withdrawal = cb.getWithdrawal(wd[i]);
      WithdrawalQuote memory quote = cb.quoteWithdrawalFee(withdrawal.token, withdrawal.amount);
      assertEq(quote.fee, withdrawal.fee);
      assertEq(quote.net, withdrawal.amount - withdrawal.fee);
    }
    assertTrue(cb.quoteWithdrawalFee(address(usdc), 300e6).isFeeCapped);
    assertFalse(cb.quoteWithdrawalFee(address(usdc), 20e6).isFeeCapped);
  }

  function test_QuoteWithdrawal_ChecksPopulatedBalances() public view {
    WithdrawalQuote memory quote = cb.quoteWithdrawal(p2, address(usdc), 81e6);
    assertEq(quote.amount, 81e6);
    assertEq(quote.fee, 0.81e6);
    assertEq(quote.net, 80.19e6);
    quote = cb.quoteWithdrawal(p1, native, 1.5 ether);
    assertEq(quote.fee, 0.03 ether);
  }

  function test_Withdrawals_FeesReachFeeCollector() public view {
    uint256 nativeFees;
    uint256 usdcFees;
    uint256 taxFees;
    for (uint256 i; i < wd.length; i++) {
      Withdrawal memory withdrawal = cb.getWithdrawal(wd[i]);
      if (withdrawal.token == native) nativeFees += withdrawal.fee;
      else if (withdrawal.token == address(usdc)) usdcFees += withdrawal.fee;
      else taxFees += withdrawal.fee;
    }
    assertEq(nativeFees, 0.02 ether);
    assertEq(usdcFees, 3.2e6);
    assertEq(taxFees, 0.1e18);
    assertEq(feeCollector.balance, nativeFees);
    assertEq(usdc.balanceOf(feeCollector), usdcFees);
    // The TAX fee transfer itself is taxed on the way out.
    assertEq(tax.balanceOf(feeCollector), taxFees - (taxFees * TAX_BPS) / 10_000);
  }

  function test_Withdrawals_HostsReceiveNetAmounts() public view {
    // host2: auto-withdrawn 200 USDC and 0.5 native.
    assertEq(usdc.balanceOf(host2), 200e6 - 1.5e6);
    // host: 300 - 1.5 from P1 and 20 - 0.2 from P2.
    assertEq(usdc.balanceOf(host), 300e6 - 1.5e6 + 20e6 - 0.2e6);
    // host3: 5 - 0.1 TAX, taxed 1% on arrival.
    assertEq(tax.balanceOf(host3), 4.9e18 - 0.049e18);
  }

  function test_GetWithdrawalsBulk_AgreesWithSingleReads() public view {
    bytes32[] memory ids = new bytes32[](wd.length + 2);
    for (uint256 i; i < wd.length; i++) {
      ids[i] = wd[(i + 3) % wd.length];
    }
    ids[wd.length] = UNKNOWN_ID;
    ids[wd.length + 1] = wd[0];
    Withdrawal[] memory withdrawals = cb.getWithdrawalsBulk(ids);
    assertEq(withdrawals.length, ids.length);
    for (uint256 i; i < ids.length; i++) {
      _assertWithdrawal(withdrawals[i], cb.getWithdrawal(ids[i]));
      _assertWithdrawal(withdrawals[i], expWithdrawal[ids[i]]);
    }
    assertEq(withdrawals[wd.length].host, address(0));
  }

  function test_GetChainWithdrawalIdAt_MatchesWithdrawalOrder() public view {
    assertEq(cb.getChainWithdrawalCount(), 6);
    for (uint256 i; i < wd.length; i++) {
      assertEq(cb.getChainWithdrawalIdAt(i), wd[i]);
    }
  }

  function test_RevertWhen_GetChainWithdrawalIdAt_PastEnd() public {
    vm.expectRevert();
    cb.getChainWithdrawalIdAt(6);
  }

  function test_ChainWithdrawals_Paginate() public view {
    _checkPages(_chainWithdrawalIds, _chainWithdrawalIdsDesc, bytes32(0), wd, 'chain withdrawal ids');
    _checkPages(_chainWithdrawals, _chainWithdrawalsDesc, bytes32(0), wd, 'chain withdrawals');
  }

  function test_UserWithdrawals_PaginatePerHost() public view {
    bytes32[] memory hostIds = new bytes32[](3);
    hostIds[0] = wd[2];
    hostIds[1] = wd[3];
    hostIds[2] = wd[4];
    bytes32[] memory host2Ids = new bytes32[](2);
    host2Ids[0] = wd[0];
    host2Ids[1] = wd[1];
    bytes32[] memory host3Ids = new bytes32[](1);
    host3Ids[0] = wd[5];

    _checkUserWithdrawals(host, hostIds);
    _checkUserWithdrawals(host2, host2Ids);
    _checkUserWithdrawals(host3, host3Ids);
    _checkUserWithdrawals(payer, new bytes32[](0));
  }

  function test_RevertWhen_GetUserWithdrawalIdAt_PastEnd() public {
    vm.expectRevert();
    cb.getUserWithdrawalIdAt(host, 3);
  }

  function _checkUserWithdrawals(address wallet, bytes32[] memory expected) private view {
    assertEq(cb.getUserWithdrawalCount(wallet), expected.length);
    assertEq(cb.getUser(wallet).withdrawalsCount, expected.length);
    for (uint256 i; i < expected.length; i++) {
      assertEq(cb.getUserWithdrawalIdAt(wallet, i), expected[i]);
      assertEq(cb.getWithdrawal(expected[i]).hostCount, i + 1);
    }
    _checkPages(_userWithdrawalIds, _userWithdrawalIdsDesc, _toBytes32(wallet), expected, 'user withdrawal ids');
    _checkPages(_userWithdrawals, _userWithdrawalsDesc, _toBytes32(wallet), expected, 'user withdrawals');
  }

  function test_PayableWithdrawals_PaginatePerPayable() public view {
    bytes32[] memory p1Ids = new bytes32[](2);
    p1Ids[0] = wd[2];
    p1Ids[1] = wd[3];
    bytes32[] memory p2Ids = new bytes32[](1);
    p2Ids[0] = wd[4];
    bytes32[] memory p3Ids = new bytes32[](2);
    p3Ids[0] = wd[0];
    p3Ids[1] = wd[1];
    bytes32[] memory p4Ids = new bytes32[](1);
    p4Ids[0] = wd[5];

    _checkPayableWithdrawals(p1, p1Ids);
    _checkPayableWithdrawals(p2, p2Ids);
    _checkPayableWithdrawals(p3, p3Ids);
    _checkPayableWithdrawals(p4, p4Ids);
    _checkPayableWithdrawals(f1, new bytes32[](0));
  }

  function test_RevertWhen_GetPayableWithdrawalIdAt_PastEnd() public {
    vm.expectRevert();
    cb.getPayableWithdrawalIdAt(p2, 1);
  }

  function _checkPayableWithdrawals(bytes32 payableId, bytes32[] memory expected) private view {
    assertEq(cb.getPayableWithdrawalCount(payableId), expected.length);
    assertEq(cb.getPayable(payableId).withdrawalsCount, expected.length);
    for (uint256 i; i < expected.length; i++) {
      assertEq(cb.getPayableWithdrawalIdAt(payableId, i), expected[i]);
      assertEq(cb.getWithdrawal(expected[i]).payableCount, i + 1);
    }
    _checkPages(_payableWithdrawalIds, _payableWithdrawalIdsDesc, payableId, expected, 'payable withdrawal ids');
    _checkPages(_payableWithdrawals, _payableWithdrawalsDesc, payableId, expected, 'payable withdrawals');
  }

  function test_ChainBHasNoWithdrawals() public view {
    assertEq(chainB.cb.getChainWithdrawalCount(), 0);
    assertEq(chainB.cb.getChainWithdrawalIds(0, 10).length, 0);
    assertEq(chainB.cb.getUserWithdrawalCount(foreignHost), 0);
    assertEq(chainB.cb.getPayableWithdrawalCount(f1), 0);
  }
}
