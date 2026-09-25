// SPDX-License-Identifier: Apache 2
pragma solidity ^0.8.30;

import {FEATURE_PAY, FEATURE_PAY_FOREIGN, FEATURE_WITHDRAW} from 'src/types/CbConstants.sol';
import {TokenPaymentLimits, WithdrawalQuote} from 'src/types/CbTypes.sol';
import {CbTestBase} from '../base/CbTestBase.sol';

contract QuoteViewsTest is CbTestBase {
  bytes32 private constant UNKNOWN_PAYABLE = keccak256('unknown-payable');
  address private constant UNREGISTERED_TOKEN = address(0xBEEF);

  // ---------------------------------------------------------------------------
  // quoteBroadcastFee / quotePublishPayableDetailsFee
  // ---------------------------------------------------------------------------

  function test_QuoteBroadcastFee_MatchesWormholeFee() public view {
    assertEq(cb.quoteBroadcastFee(), WORMHOLE_FEE);
  }

  function test_QuoteBroadcastFee_ZeroWhenWormholeDisabled() public {
    vm.prank(owner);
    cb.setWormholeEnabled(false);
    assertEq(cb.quoteBroadcastFee(), 0);
  }

  function test_QuotePublishPayableDetailsFee_SingleBroadcastForUnknownPayable() public view {
    // An unknown payable defaults to `isClosed == false`, so a single broadcast fee applies.
    assertEq(cb.quotePublishPayableDetailsFee(UNKNOWN_PAYABLE), WORMHOLE_FEE);
  }

  // ---------------------------------------------------------------------------
  // quoteWithdrawalFee / quoteWithdrawal
  // ---------------------------------------------------------------------------

  function test_QuoteWithdrawalFee_UsesGlobalBpsByDefault() public view {
    WithdrawalQuote memory quote = cb.quoteWithdrawalFee(address(usdc), 10_000);
    assertEq(quote.feeBps, DEFAULT_FEE_BPS);
    assertEq(quote.fee, (10_000 * uint256(DEFAULT_FEE_BPS)) / 10_000);
    assertEq(quote.net, 10_000 - quote.fee);
    assertFalse(quote.isFeeCapped);
  }

  function test_QuoteWithdrawalFee_UsesOverrideBps() public {
    vm.prank(owner);
    cb.setTokenFeeBps(address(usdc), 500);
    WithdrawalQuote memory quote = cb.quoteWithdrawalFee(address(usdc), 10_000);
    assertEq(quote.feeBps, 500);
    assertEq(quote.fee, 500);
  }

  function test_QuoteWithdrawalFee_OverrideCanBeZero() public {
    vm.prank(owner);
    cb.setTokenFeeBps(address(usdc), 0);
    WithdrawalQuote memory quote = cb.quoteWithdrawalFee(address(usdc), 10_000);
    assertEq(quote.feeBps, 0);
    assertEq(quote.fee, 0);
    assertEq(quote.net, 10_000);
    assertFalse(quote.isFeeCapped);
  }

  function test_QuoteWithdrawalFee_CapAppliesWhenBelowPercentageFee() public {
    vm.startPrank(owner);
    cb.setTokenFeeBps(address(usdc), 500);
    cb.setTokenMaxWithdrawalFee(address(usdc), 100);
    vm.stopPrank();

    WithdrawalQuote memory quote = cb.quoteWithdrawalFee(address(usdc), 10_000);
    assertEq(quote.feeBps, 500);
    assertEq(quote.fee, 100);
    assertEq(quote.net, 9_900);
    assertTrue(quote.isFeeCapped);
  }

  function test_QuoteWithdrawalFee_CapCanBeZero() public {
    vm.startPrank(owner);
    cb.setTokenFeeBps(address(usdc), 500);
    cb.setTokenMaxWithdrawalFee(address(usdc), 0);
    vm.stopPrank();

    WithdrawalQuote memory quote = cb.quoteWithdrawalFee(address(usdc), 10_000);
    assertEq(quote.fee, 0);
    assertEq(quote.net, 10_000);
    assertTrue(quote.isFeeCapped);
  }

  function test_QuoteWithdrawalFee_UnappliedWhenCapAboveFee() public {
    vm.startPrank(owner);
    cb.setTokenFeeBps(address(usdc), 500);
    cb.setTokenMaxWithdrawalFee(address(usdc), 100_000);
    vm.stopPrank();

    WithdrawalQuote memory quote = cb.quoteWithdrawalFee(address(usdc), 10_000);
    assertEq(quote.fee, 500);
    assertFalse(quote.isFeeCapped);
  }

  function test_QuoteWithdrawalFee_FallsBackAfterCapCleared() public {
    vm.startPrank(owner);
    cb.setTokenFeeBps(address(usdc), 500);
    cb.setTokenMaxWithdrawalFee(address(usdc), 100);
    cb.clearTokenMaxWithdrawalFee(address(usdc));
    vm.stopPrank();

    WithdrawalQuote memory quote = cb.quoteWithdrawalFee(address(usdc), 10_000);
    assertEq(quote.fee, 500);
    assertFalse(quote.isFeeCapped);
  }

  function test_QuoteWithdrawal_MatchesQuoteWithdrawalFee() public {
    vm.prank(owner);
    cb.setTokenFeeBps(address(usdc), 500);
    WithdrawalQuote memory viaFee = cb.quoteWithdrawalFee(address(usdc), 10_000);
    WithdrawalQuote memory viaWithdrawal = cb.quoteWithdrawal(UNKNOWN_PAYABLE, address(usdc), 10_000);
    assertEq(viaWithdrawal.fee, viaFee.fee);
    assertEq(viaWithdrawal.net, viaFee.net);
    assertEq(viaWithdrawal.feeBps, viaFee.feeBps);
    assertEq(viaWithdrawal.isFeeCapped, viaFee.isFeeCapped);
  }

  // ---------------------------------------------------------------------------
  // canPay
  // ---------------------------------------------------------------------------

  function test_CanPay_FailsWhenGloballyPaused() public {
    vm.prank(owner);
    cb.pause();
    (bool ok, bytes4 selector) = cb.canPay(UNKNOWN_PAYABLE, address(usdc), 1);
    assertFalse(ok);
    assertEq(selector, EnforcedPause.selector);
  }

  function test_CanPay_FailsWhenFeaturePaused() public {
    vm.prank(owner);
    cb.pauseFeatures(FEATURE_PAY);
    (bool ok, bytes4 selector) = cb.canPay(UNKNOWN_PAYABLE, address(usdc), 1);
    assertFalse(ok);
    assertEq(selector, FeaturePaused.selector);
  }

  function test_CanPay_GlobalPauseTakesPrecedenceOverFeaturePause() public {
    vm.startPrank(owner);
    cb.pause();
    cb.pauseFeatures(FEATURE_PAY);
    vm.stopPrank();
    (, bytes4 selector) = cb.canPay(UNKNOWN_PAYABLE, address(usdc), 1);
    assertEq(selector, EnforcedPause.selector);
  }

  function test_CanPay_InvalidTokenAddress() public view {
    (bool ok, bytes4 selector) = cb.canPay(UNKNOWN_PAYABLE, address(0), 1);
    assertFalse(ok);
    assertEq(selector, InvalidTokenAddress.selector);
  }

  function test_CanPay_UnsupportedToken_NeverRegistered() public view {
    (bool ok, bytes4 selector) = cb.canPay(UNKNOWN_PAYABLE, UNREGISTERED_TOKEN, 1);
    assertFalse(ok);
    assertEq(selector, UnsupportedToken.selector);
  }

  function test_CanPay_UnsupportedToken_Stopped() public {
    vm.prank(owner);
    cb.stopPaymentsForToken(address(usdc));
    (bool ok, bytes4 selector) = cb.canPay(UNKNOWN_PAYABLE, address(usdc), 1);
    assertFalse(ok);
    assertEq(selector, UnsupportedToken.selector);
  }

  function test_CanPay_ZeroAmountSpecified() public view {
    (bool ok, bytes4 selector) = cb.canPay(UNKNOWN_PAYABLE, address(usdc), 0);
    assertFalse(ok);
    assertEq(selector, ZeroAmountSpecified.selector);
  }

  function test_CanPay_PaymentBelowMinimum() public {
    vm.prank(owner);
    cb.setTokenPaymentLimits(
      address(usdc),
      TokenPaymentLimits({
        hasMinPaymentAmount: true, minPaymentAmount: 100, hasMaxPaymentAmount: false, maxPaymentAmount: 0
      })
    );
    (bool ok, bytes4 selector) = cb.canPay(UNKNOWN_PAYABLE, address(usdc), 50);
    assertFalse(ok);
    assertEq(selector, PaymentBelowMinimum.selector);
  }

  function test_CanPay_PaymentAboveMaximum() public {
    vm.prank(owner);
    cb.setTokenPaymentLimits(
      address(usdc),
      TokenPaymentLimits({
        hasMinPaymentAmount: false, minPaymentAmount: 0, hasMaxPaymentAmount: true, maxPaymentAmount: 100
      })
    );
    (bool ok, bytes4 selector) = cb.canPay(UNKNOWN_PAYABLE, address(usdc), 101);
    assertFalse(ok);
    assertEq(selector, PaymentAboveMaximum.selector);
  }

  function test_CanPay_InvalidPayableId() public view {
    (bool ok, bytes4 selector) = cb.canPay(UNKNOWN_PAYABLE, address(usdc), 1);
    assertFalse(ok);
    assertEq(selector, InvalidPayableId.selector);
  }

  function test_CanPay_InvalidPayableId_NativeToken() public view {
    (bool ok, bytes4 selector) = cb.canPay(UNKNOWN_PAYABLE, native, 1);
    assertFalse(ok);
    assertEq(selector, InvalidPayableId.selector);
  }

  // ---------------------------------------------------------------------------
  // canPayForeign
  // ---------------------------------------------------------------------------

  function test_CanPayForeign_FailsWhenGloballyPaused() public {
    vm.prank(owner);
    cb.pause();
    (bool ok, bytes4 selector) = cb.canPayForeign(UNKNOWN_PAYABLE, address(usdc), 1, 0);
    assertFalse(ok);
    assertEq(selector, EnforcedPause.selector);
  }

  function test_CanPayForeign_FailsWhenFeaturePaused() public {
    vm.prank(owner);
    cb.pauseFeatures(FEATURE_PAY_FOREIGN);
    (bool ok, bytes4 selector) = cb.canPayForeign(UNKNOWN_PAYABLE, address(usdc), 1, 0);
    assertFalse(ok);
    assertEq(selector, FeaturePaused.selector);
  }

  function test_CanPayForeign_CctpNotEnabled() public {
    vm.prank(owner);
    cb.setCctpEnabled(false);
    (bool ok, bytes4 selector) = cb.canPayForeign(UNKNOWN_PAYABLE, address(usdc), 1, 0);
    assertFalse(ok);
    assertEq(selector, CctpNotEnabled.selector);
  }

  function test_CanPayForeign_NativeTokenNotBridgeable() public view {
    (bool ok, bytes4 selector) = cb.canPayForeign(UNKNOWN_PAYABLE, native, 1, 0);
    assertFalse(ok);
    assertEq(selector, NativeTokenNotBridgeable.selector);
  }

  function test_CanPayForeign_InvalidTokenAddress() public view {
    (bool ok, bytes4 selector) = cb.canPayForeign(UNKNOWN_PAYABLE, address(0), 1, 0);
    assertFalse(ok);
    assertEq(selector, InvalidTokenAddress.selector);
  }

  function test_CanPayForeign_UnsupportedToken() public view {
    (bool ok, bytes4 selector) = cb.canPayForeign(UNKNOWN_PAYABLE, UNREGISTERED_TOKEN, 1, 0);
    assertFalse(ok);
    assertEq(selector, UnsupportedToken.selector);
  }

  function test_CanPayForeign_ZeroAmountSpecified() public view {
    (bool ok, bytes4 selector) = cb.canPayForeign(UNKNOWN_PAYABLE, address(usdc), 0, 0);
    assertFalse(ok);
    assertEq(selector, ZeroAmountSpecified.selector);
  }

  function test_CanPayForeign_PaymentBelowMinimum() public {
    vm.prank(owner);
    cb.setTokenPaymentLimits(
      address(usdc),
      TokenPaymentLimits({
        hasMinPaymentAmount: true, minPaymentAmount: 100, hasMaxPaymentAmount: false, maxPaymentAmount: 0
      })
    );
    (bool ok, bytes4 selector) = cb.canPayForeign(UNKNOWN_PAYABLE, address(usdc), 50, 0);
    assertFalse(ok);
    assertEq(selector, PaymentBelowMinimum.selector);
  }

  function test_CanPayForeign_PaymentAboveMaximum() public {
    vm.prank(owner);
    cb.setTokenPaymentLimits(
      address(usdc),
      TokenPaymentLimits({
        hasMinPaymentAmount: false, minPaymentAmount: 0, hasMaxPaymentAmount: true, maxPaymentAmount: 100
      })
    );
    (bool ok, bytes4 selector) = cb.canPayForeign(UNKNOWN_PAYABLE, address(usdc), 101, 0);
    assertFalse(ok);
    assertEq(selector, PaymentAboveMaximum.selector);
  }

  function test_CanPayForeign_AmountExceedsCrossChainLimit() public view {
    uint256 amount = uint256(type(uint64).max) + 1;
    (bool ok, bytes4 selector) = cb.canPayForeign(UNKNOWN_PAYABLE, address(usdc), amount, 0);
    assertFalse(ok);
    assertEq(selector, AmountExceedsCrossChainLimit.selector);
  }

  function test_CanPayForeign_InvalidPayableId() public view {
    (bool ok, bytes4 selector) = cb.canPayForeign(UNKNOWN_PAYABLE, address(usdc), 1, 0);
    assertFalse(ok);
    assertEq(selector, InvalidPayableId.selector);
  }

  // ---------------------------------------------------------------------------
  // canWithdraw
  // ---------------------------------------------------------------------------

  function test_CanWithdraw_FailsWhenGloballyPaused() public {
    vm.prank(owner);
    cb.pause();
    (bool ok, bytes4 selector) = cb.canWithdraw(UNKNOWN_PAYABLE, host, address(usdc), 1);
    assertFalse(ok);
    assertEq(selector, EnforcedPause.selector);
  }

  function test_CanWithdraw_FailsWhenFeaturePaused() public {
    vm.prank(owner);
    cb.pauseFeatures(FEATURE_WITHDRAW);
    (bool ok, bytes4 selector) = cb.canWithdraw(UNKNOWN_PAYABLE, host, address(usdc), 1);
    assertFalse(ok);
    assertEq(selector, FeaturePaused.selector);
  }

  function test_CanWithdraw_InvalidPayableId() public view {
    (bool ok, bytes4 selector) = cb.canWithdraw(UNKNOWN_PAYABLE, host, address(usdc), 1);
    assertFalse(ok);
    assertEq(selector, InvalidPayableId.selector);
  }

  // ---------------------------------------------------------------------------
  // getUntrackedBalance
  // ---------------------------------------------------------------------------

  function test_GetUntrackedBalance_ZeroWhenNothingSent() public view {
    assertEq(cb.getUntrackedBalance(native), 0);
    assertEq(cb.getUntrackedBalance(address(usdc)), 0);
  }

  function test_GetUntrackedBalance_ReflectsDirectErc20Transfer() public {
    usdc.mint(address(this), 1_000);
    require(usdc.transfer(address(cb), 1_000));
    assertEq(cb.getUntrackedBalance(address(usdc)), 1_000);
  }

  function test_GetUntrackedBalance_ReflectsDirectNativeBalance() public {
    vm.deal(address(cb), 5 ether);
    assertEq(cb.getUntrackedBalance(native), 5 ether);
  }

  function test_GetUntrackedBalance_AccumulatesMultipleTransfers() public {
    usdc.mint(address(this), 2_000);
    require(usdc.transfer(address(cb), 500));
    require(usdc.transfer(address(cb), 1_500));
    assertEq(cb.getUntrackedBalance(address(usdc)), 2_000);
  }
}
