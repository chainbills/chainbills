// SPDX-License-Identifier: Apache 2
pragma solidity ^0.8.30;

import {
  FEATURE_CREATE_PAYABLE,
  FEATURE_PUBLISH_PAYABLE,
  FEATURE_UPDATE_PAYABLE,
  PAYABLE_ACTION_CLOSE,
  PAYABLE_ACTION_CREATE,
  PAYABLE_ACTION_REOPEN,
  PAYABLE_ACTION_UPDATE_ALLOWED_TOKENS_AND_AMOUNTS
} from 'src/types/CbConstants.sol';
import {TokenAndAmount, TokenPaymentLimits} from 'src/types/CbTypes.sol';
import {CbTestBase} from '../base/CbTestBase.sol';

contract PayablesTest is CbTestBase {
  function setUp() public override {
    super.setUp();
    vm.deal(host, 100 ether);
  }

  // ---------------------------------------------------------------------------
  // createPayable
  // ---------------------------------------------------------------------------

  function test_CreatePayable_EmitsAndBroadcasts() public {
    // The payable ID is generated on chain and unknown ahead of time; only the host and counts are checked.
    vm.expectEmit(false, true, false, true, address(cb));
    emit CreatedPayable(bytes32(0), host, 1, 1);
    vm.prank(host);
    (bytes32 payableId, uint64 sequence) = cb.createPayable{value: WORMHOLE_FEE}(_anyToken(), false);
    assertTrue(payableId != bytes32(0));
    assertEq(sequence, 0);
    assertEq(chainA.wormhole.publishedCount(), 1);
  }

  function test_CreatePayable_WithAllowedTokens() public {
    TokenAndAmount[] memory list = _only(address(usdc), 100e6);
    vm.prank(host);
    (bytes32 payableId,) = cb.createPayable{value: WORMHOLE_FEE}(list, true);
    assertTrue(payableId != bytes32(0));
  }

  function test_RevertWhen_CreatePayable_IncorrectFeeTooLow() public {
    vm.expectRevert(abi.encodeWithSelector(IncorrectWormholeFee.selector, 0, WORMHOLE_FEE));
    vm.prank(host);
    cb.createPayable(_anyToken(), false);
  }

  function test_RevertWhen_CreatePayable_IncorrectFeeTooHigh() public {
    vm.expectRevert(abi.encodeWithSelector(IncorrectWormholeFee.selector, WORMHOLE_FEE * 2, WORMHOLE_FEE));
    vm.prank(host);
    cb.createPayable{value: WORMHOLE_FEE * 2}(_anyToken(), false);
  }

  function test_CreatePayable_ZeroFeeWhenWormholeInactive() public {
    vm.prank(owner);
    cb.setWormholeEnabled(false);
    vm.prank(host);
    (bytes32 payableId, uint64 sequence) = cb.createPayable(_anyToken(), false);
    assertTrue(payableId != bytes32(0));
    assertEq(sequence, 0);
  }

  function test_RevertWhen_CreatePayable_TooManyAllowedTokensAndAmounts() public {
    TokenAndAmount[] memory list = new TokenAndAmount[](DEFAULT_MAX_ALLOWED_TOKENS_AND_AMOUNTS + 1);
    for (uint256 i; i < list.length; i++) {
      list[i] = TokenAndAmount(address(usdc), i + 1);
    }
    vm.expectRevert(
      abi.encodeWithSelector(
        TooManyAllowedTokensAndAmounts.selector, list.length, DEFAULT_MAX_ALLOWED_TOKENS_AND_AMOUNTS
      )
    );
    vm.prank(host);
    cb.createPayable{value: WORMHOLE_FEE}(list, false);
  }

  function test_RevertWhen_CreatePayable_InvalidTokenAddress() public {
    vm.expectRevert(InvalidTokenAddress.selector);
    vm.prank(host);
    cb.createPayable{value: WORMHOLE_FEE}(_only(address(0), 1), false);
  }

  function test_RevertWhen_CreatePayable_UnsupportedToken() public {
    address unsupported = makeAddr('unsupported-token');
    vm.expectRevert(abi.encodeWithSelector(UnsupportedToken.selector, unsupported));
    vm.prank(host);
    cb.createPayable{value: WORMHOLE_FEE}(_only(unsupported, 1), false);
  }

  function test_RevertWhen_CreatePayable_ZeroAmountSpecified() public {
    vm.expectRevert(ZeroAmountSpecified.selector);
    vm.prank(host);
    cb.createPayable{value: WORMHOLE_FEE}(_only(address(usdc), 0), false);
  }

  function test_RevertWhen_CreatePayable_AmountExceedsCrossChainLimit() public {
    vm.expectRevert(AmountExceedsCrossChainLimit.selector);
    vm.prank(host);
    cb.createPayable{value: WORMHOLE_FEE}(_only(address(usdc), uint256(type(uint64).max) + 1), false);
  }

  function test_RevertWhen_CreatePayable_PaymentBelowMinimum() public {
    vm.prank(owner);
    cb.setTokenPaymentLimits(address(usdc), TokenPaymentLimits(true, 100, false, 0));
    vm.expectRevert(abi.encodeWithSelector(PaymentBelowMinimum.selector, 50, 100));
    vm.prank(host);
    cb.createPayable{value: WORMHOLE_FEE}(_only(address(usdc), 50), false);
  }

  function test_RevertWhen_CreatePayable_PaymentAboveMaximum() public {
    vm.prank(owner);
    cb.setTokenPaymentLimits(address(usdc), TokenPaymentLimits(false, 0, true, 100));
    vm.expectRevert(abi.encodeWithSelector(PaymentAboveMaximum.selector, 200, 100));
    vm.prank(host);
    cb.createPayable{value: WORMHOLE_FEE}(_only(address(usdc), 200), false);
  }

  function test_RevertWhen_CreatePayable_DuplicateTokenAndAmount() public {
    TokenAndAmount[] memory list = new TokenAndAmount[](2);
    list[0] = TokenAndAmount(address(usdc), 100);
    list[1] = TokenAndAmount(address(usdc), 100);
    vm.expectRevert(DuplicateTokenAndAmount.selector);
    vm.prank(host);
    cb.createPayable{value: WORMHOLE_FEE}(list, false);
  }

  function test_RevertWhen_CreatePayable_Paused() public {
    vm.prank(owner);
    cb.pauseFeatures(FEATURE_CREATE_PAYABLE);
    vm.expectRevert(abi.encodeWithSelector(FeaturePaused.selector, FEATURE_CREATE_PAYABLE));
    vm.prank(host);
    cb.createPayable{value: WORMHOLE_FEE}(_anyToken(), false);
  }

  // ---------------------------------------------------------------------------
  // closePayable / reopenPayable
  // ---------------------------------------------------------------------------

  function test_ClosePayable_EmitsAndBroadcasts() public {
    bytes32 payableId = _createPayableDirect(host, _anyToken(), false);
    vm.expectEmit(true, true, true, true, address(cb));
    emit ClosedPayable(payableId, host);
    vm.prank(host);
    cb.closePayable{value: WORMHOLE_FEE}(payableId);
  }

  function test_RevertWhen_ClosePayable_InvalidPayableId() public {
    vm.expectRevert(InvalidPayableId.selector);
    vm.prank(host);
    cb.closePayable{value: WORMHOLE_FEE}(bytes32('nope'));
  }

  function test_RevertWhen_ClosePayable_NotYourPayable() public {
    bytes32 payableId = _createPayableDirect(host, _anyToken(), false);
    vm.deal(stranger, WORMHOLE_FEE);
    vm.expectRevert(NotYourPayable.selector);
    vm.prank(stranger);
    cb.closePayable{value: WORMHOLE_FEE}(payableId);
  }

  function test_RevertWhen_ClosePayable_AlreadyClosed() public {
    bytes32 payableId = _createPayableDirect(host, _anyToken(), false);
    vm.prank(host);
    cb.closePayable{value: WORMHOLE_FEE}(payableId);
    vm.expectRevert(PayableIsAlreadyClosed.selector);
    vm.prank(host);
    cb.closePayable{value: WORMHOLE_FEE}(payableId);
  }

  function test_RevertWhen_ClosePayable_IncorrectFee() public {
    bytes32 payableId = _createPayableDirect(host, _anyToken(), false);
    vm.expectRevert(abi.encodeWithSelector(IncorrectWormholeFee.selector, 0, WORMHOLE_FEE));
    vm.prank(host);
    cb.closePayable(payableId);
  }

  function test_ReopenPayable_EmitsAndBroadcasts() public {
    bytes32 payableId = _createPayableDirect(host, _anyToken(), false);
    vm.startPrank(host);
    cb.closePayable{value: WORMHOLE_FEE}(payableId);
    vm.expectEmit(true, true, true, true, address(cb));
    emit ReopenedPayable(payableId, host);
    cb.reopenPayable{value: WORMHOLE_FEE}(payableId);
    vm.stopPrank();
  }

  function test_RevertWhen_ReopenPayable_NotClosed() public {
    bytes32 payableId = _createPayableDirect(host, _anyToken(), false);
    vm.expectRevert(PayableIsNotClosed.selector);
    vm.prank(host);
    cb.reopenPayable{value: WORMHOLE_FEE}(payableId);
  }

  // ---------------------------------------------------------------------------
  // updatePayableAllowedTokensAndAmounts
  // ---------------------------------------------------------------------------

  function test_UpdatePayableAllowedTokensAndAmounts_EmitsAndBroadcasts() public {
    bytes32 payableId = _createPayableDirect(host, _anyToken(), false);
    vm.expectEmit(true, true, true, true, address(cb));
    emit UpdatedPayableAllowedTokensAndAmounts(payableId, host);
    vm.prank(host);
    cb.updatePayableAllowedTokensAndAmounts{value: WORMHOLE_FEE}(payableId, _only(address(usdc), 5e6));
  }

  function test_RevertWhen_UpdatePayableAllowedTokensAndAmounts_NotYourPayable() public {
    bytes32 payableId = _createPayableDirect(host, _anyToken(), false);
    vm.deal(stranger, WORMHOLE_FEE);
    vm.expectRevert(NotYourPayable.selector);
    vm.prank(stranger);
    cb.updatePayableAllowedTokensAndAmounts{value: WORMHOLE_FEE}(payableId, _anyToken());
  }

  function test_RevertWhen_UpdatePayableAllowedTokensAndAmounts_InvalidPayableId() public {
    vm.expectRevert(InvalidPayableId.selector);
    vm.prank(host);
    cb.updatePayableAllowedTokensAndAmounts{value: WORMHOLE_FEE}(bytes32('nope'), _anyToken());
  }

  function test_UpdatePayableAllowedTokensAndAmounts_WorksOnClosedPayable() public {
    bytes32 payableId = _createPayableDirect(host, _anyToken(), false);
    vm.startPrank(host);
    cb.closePayable{value: WORMHOLE_FEE}(payableId);
    cb.updatePayableAllowedTokensAndAmounts{value: WORMHOLE_FEE}(payableId, _only(address(usdc), 5e6));
    vm.stopPrank();
  }

  // ---------------------------------------------------------------------------
  // updatePayableAutoWithdraw
  // ---------------------------------------------------------------------------

  function test_UpdatePayableAutoWithdraw_TogglesAndEmits() public {
    bytes32 payableId = _createPayableDirect(host, _anyToken(), false);
    vm.expectEmit(true, true, true, true, address(cb));
    emit UpdatedPayableAutoWithdrawStatus(payableId, host, true);
    vm.prank(host);
    cb.updatePayableAutoWithdraw(payableId, true);
  }

  function test_RevertWhen_UpdatePayableAutoWithdraw_NotYourPayable() public {
    bytes32 payableId = _createPayableDirect(host, _anyToken(), false);
    vm.expectRevert(NotYourPayable.selector);
    vm.prank(stranger);
    cb.updatePayableAutoWithdraw(payableId, true);
  }

  function test_RevertWhen_UpdatePayableAutoWithdraw_InvalidPayableId() public {
    vm.expectRevert(InvalidPayableId.selector);
    vm.prank(host);
    cb.updatePayableAutoWithdraw(bytes32('nope'), true);
  }

  function test_RevertWhen_UpdatePayableAutoWithdraw_Paused() public {
    bytes32 payableId = _createPayableDirect(host, _anyToken(), false);
    vm.prank(owner);
    cb.pauseFeatures(FEATURE_UPDATE_PAYABLE);
    vm.expectRevert(abi.encodeWithSelector(FeaturePaused.selector, FEATURE_UPDATE_PAYABLE));
    vm.prank(host);
    cb.updatePayableAutoWithdraw(payableId, true);
  }

  // ---------------------------------------------------------------------------
  // publishPayableDetails
  // ---------------------------------------------------------------------------

  function test_PublishPayableDetails_OpenPayable_SendsOneMessage() public {
    bytes32 payableId = _createPayableDirect(host, _anyToken(), false);
    uint256 before = chainA.wormhole.publishedCount();
    vm.prank(host);
    cb.publishPayableDetails{value: WORMHOLE_FEE}(payableId);
    assertEq(chainA.wormhole.publishedCount(), before + 1);
  }

  function test_PublishPayableDetails_ClosedPayable_SendsTwoMessages() public {
    bytes32 payableId = _createPayableDirect(host, _anyToken(), false);
    vm.prank(host);
    cb.closePayable{value: WORMHOLE_FEE}(payableId);
    uint256 before = chainA.wormhole.publishedCount();
    vm.prank(host);
    cb.publishPayableDetails{value: WORMHOLE_FEE * 2}(payableId);
    assertEq(chainA.wormhole.publishedCount(), before + 2);
  }

  function test_RevertWhen_PublishPayableDetails_InvalidPayableId() public {
    vm.expectRevert(InvalidPayableId.selector);
    vm.prank(host);
    cb.publishPayableDetails{value: WORMHOLE_FEE}(bytes32('nope'));
  }

  function test_RevertWhen_PublishPayableDetails_IncorrectFeeForClosedPayable() public {
    bytes32 payableId = _createPayableDirect(host, _anyToken(), false);
    vm.prank(host);
    cb.closePayable{value: WORMHOLE_FEE}(payableId);
    vm.expectRevert(abi.encodeWithSelector(IncorrectWormholeFee.selector, WORMHOLE_FEE, WORMHOLE_FEE * 2));
    vm.prank(host);
    cb.publishPayableDetails{value: WORMHOLE_FEE}(payableId);
  }

  function test_RevertWhen_PublishPayableDetails_RestrictedNotHostNotRelayer() public {
    bytes32 payableId = _createPayableDirect(host, _anyToken(), false);
    vm.prank(owner);
    cb.setPublishPayableRestricted(true);
    vm.deal(stranger, WORMHOLE_FEE);
    vm.expectRevert(abi.encodeWithSelector(PublishPayableRestricted.selector, stranger));
    vm.prank(stranger);
    cb.publishPayableDetails{value: WORMHOLE_FEE}(payableId);
  }

  function test_PublishPayableDetails_RestrictedAllowsHostAndRelayer() public {
    bytes32 payableId = _createPayableDirect(host, _anyToken(), false);
    vm.prank(owner);
    cb.setPublishPayableRestricted(true);
    vm.prank(host);
    cb.publishPayableDetails{value: WORMHOLE_FEE}(payableId);

    vm.deal(relayer, WORMHOLE_FEE);
    vm.prank(relayer);
    cb.publishPayableDetails{value: WORMHOLE_FEE}(payableId);
  }

  function test_RevertWhen_PublishPayableDetails_Paused() public {
    bytes32 payableId = _createPayableDirect(host, _anyToken(), false);
    vm.prank(owner);
    cb.pauseFeatures(FEATURE_PUBLISH_PAYABLE);
    vm.expectRevert(abi.encodeWithSelector(FeaturePaused.selector, FEATURE_PUBLISH_PAYABLE));
    vm.prank(host);
    cb.publishPayableDetails{value: WORMHOLE_FEE}(payableId);
  }

  // ---------------------------------------------------------------------------
  // Helpers
  // ---------------------------------------------------------------------------

  function _createPayableDirect(address host_, TokenAndAmount[] memory allowed, bool isAutoWithdraw)
    internal
    returns (bytes32 payableId)
  {
    vm.deal(host_, host_.balance + WORMHOLE_FEE);
    vm.prank(host_);
    (payableId,) = cb.createPayable{value: WORMHOLE_FEE}(allowed, isAutoWithdraw);
  }
}
