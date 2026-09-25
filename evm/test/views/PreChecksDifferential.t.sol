// SPDX-License-Identifier: Apache 2
pragma solidity ^0.8.30;

import {CCTP_FINALITY_FAST, FEATURE_PAY, FEATURE_PAY_FOREIGN, FEATURE_WITHDRAW} from 'src/types/CbConstants.sol';
import {
  ForeignChain,
  ForeignChainLimits,
  ForeignChainSwitches,
  TokenAndAmount,
  TokenPaymentLimits,
  WithdrawalQuote
} from 'src/types/CbTypes.sol';
import {VmSafe} from 'forge-std/Vm.sol';
import {CbTestBase} from '../base/CbTestBase.sol';
import {MockERC20} from '../mocks/MockERC20.sol';
import {RejectEth} from '../mocks/RejectEth.sol';

/// Differential tests: every pre-flight check (`canPay`, `canPayForeign`, `canWithdraw`) and fee quote
/// (`quoteWithdrawal`, `quotePublishPayableDetailsFee`) is compared against the outcome of the real state-changing call
/// with the same inputs.
contract PreChecksDifferentialTest is CbTestBase {
  /// Storage slot of `LibChainRegistryStorage.Layout`.
  bytes32 private constant CHAINS_STORAGE_SLOT = 0xd36bb9122292cfdfa7e70515711ada5c51f7ac394a1273e985cd69b7552e6e00;
  bytes32 private constant UNKNOWN_PAYABLE = keccak256('unknown-payable');
  uint256 private constant AMOUNT = 100e6;
  uint256 private constant PAYER_USDC = 1_000_000e6;
  uint256 private constant FUNDED_USDC = 500e6;
  uint256 private constant FUNDED_NATIVE = 1 ether;

  /// Host of the chain B payables. Payable IDs hash `block.chainid`, which both simulated chains share, so a distinct
  /// host keeps chain B IDs from colliding with chain A IDs.
  address internal foreignHost = makeAddr('foreign-host');

  /// Token never allowed for payments on chain A.
  MockERC20 internal rogue;
  /// Token allowed on chain A without a matching token on chain B.
  MockERC20 internal loose;

  /// Local payables on chain A.
  bytes32 internal openId;
  bytes32 internal restrictedId;
  bytes32 internal closedId;
  bytes32 internal fundedId;

  /// Payables hosted on chain B and mirrored on chain A.
  bytes32 internal foreignOpenId;
  bytes32 internal foreignRestrictedId;
  bytes32 internal foreignClosedId;

  function setUp() public override {
    super.setUp();
    _setUpChainB();

    rogue = new MockERC20('Rogue', 'RGE', 18);
    loose = new MockERC20('Loose', 'LSE', 6);
    vm.prank(owner);
    cb.allowPaymentsForToken(address(loose));

    _fundUsdc(chainA, payer, PAYER_USDC);
    _fundToken(rogue, payer);
    _fundToken(loose, payer);
    vm.deal(payer, 100 ether);

    openId = _createPayable(chainA, host, _anyToken(), false);
    restrictedId = _createPayable(chainA, host, _only(address(usdc), AMOUNT), false);
    closedId = _createPayable(chainA, host, _anyToken(), false);
    _close(chainA, closedId);

    fundedId = _createPayable(chainA, host, _anyToken(), false);
    vm.prank(payer);
    cb.pay(fundedId, address(usdc), FUNDED_USDC, FUNDED_USDC);
    vm.prank(payer);
    cb.pay{value: FUNDED_NATIVE}(fundedId, native, FUNDED_NATIVE, FUNDED_NATIVE);

    foreignOpenId = _createForeignPayable(_anyToken());
    foreignRestrictedId = _createForeignPayable(_only(address(chainB.usdc), AMOUNT));
    foreignClosedId = _createForeignPayable(_anyToken());
    _close(chainB, foreignClosedId);
    cb.receivePayableUpdateViaWormhole(_lastVaa(chainB));
  }

  // ---------------------------------------------------------------------------
  // canPay vs pay: failure branches, in check order
  // ---------------------------------------------------------------------------

  function test_RevertWhen_Pay_EnforcedPause() public {
    vm.prank(owner);
    cb.pause();
    _assertCanPay(openId, address(usdc), AMOUNT, EnforcedPause.selector);
    vm.expectRevert(EnforcedPause.selector);
    vm.prank(payer);
    cb.pay(openId, address(usdc), AMOUNT, AMOUNT);
  }

  function test_RevertWhen_Pay_FeaturePaused() public {
    vm.prank(owner);
    cb.pauseFeatures(FEATURE_PAY);
    _assertCanPay(openId, address(usdc), AMOUNT, FeaturePaused.selector);
    vm.expectRevert(abi.encodeWithSelector(FeaturePaused.selector, FEATURE_PAY));
    vm.prank(payer);
    cb.pay(openId, address(usdc), AMOUNT, AMOUNT);
  }

  function test_RevertWhen_Pay_OtherFeaturePausedDoesNotBlock() public {
    vm.prank(owner);
    cb.pauseFeatures(FEATURE_PAY_FOREIGN | FEATURE_WITHDRAW);
    _assertCanPay(openId, address(usdc), AMOUNT, bytes4(0));
    vm.prank(payer);
    cb.pay(openId, address(usdc), AMOUNT, AMOUNT);
    assertEq(cb.getBalance(openId, address(usdc)), AMOUNT);
  }

  function test_RevertWhen_Pay_InvalidTokenAddress() public {
    _assertCanPay(openId, address(0), AMOUNT, InvalidTokenAddress.selector);
    vm.expectRevert(InvalidTokenAddress.selector);
    vm.prank(payer);
    cb.pay(openId, address(0), AMOUNT, AMOUNT);
  }

  function test_RevertWhen_Pay_UnsupportedToken_NeverAllowed() public {
    _assertCanPay(openId, address(rogue), AMOUNT, UnsupportedToken.selector);
    vm.expectRevert(abi.encodeWithSelector(UnsupportedToken.selector, address(rogue)));
    vm.prank(payer);
    cb.pay(openId, address(rogue), AMOUNT, AMOUNT);
  }

  function test_RevertWhen_Pay_UnsupportedToken_Stopped() public {
    vm.prank(owner);
    cb.stopPaymentsForToken(address(usdc));
    _assertCanPay(openId, address(usdc), AMOUNT, UnsupportedToken.selector);
    vm.expectRevert(abi.encodeWithSelector(UnsupportedToken.selector, address(usdc)));
    vm.prank(payer);
    cb.pay(openId, address(usdc), AMOUNT, AMOUNT);
  }

  function test_RevertWhen_Pay_UnsupportedToken_NativeStopped() public {
    vm.prank(owner);
    cb.stopPaymentsForToken(native);
    _assertCanPay(openId, native, 1 ether, UnsupportedToken.selector);
    vm.expectRevert(abi.encodeWithSelector(UnsupportedToken.selector, native));
    vm.prank(payer);
    cb.pay{value: 1 ether}(openId, native, 1 ether, 1 ether);
  }

  function test_RevertWhen_Pay_ZeroAmountSpecified() public {
    _assertCanPay(openId, address(usdc), 0, ZeroAmountSpecified.selector);
    vm.expectRevert(ZeroAmountSpecified.selector);
    vm.prank(payer);
    cb.pay(openId, address(usdc), 0, 0);
  }

  function test_RevertWhen_Pay_PaymentBelowMinimum() public {
    _setLimits(address(usdc), true, 50e6, false, 0);
    _assertCanPay(openId, address(usdc), 50e6 - 1, PaymentBelowMinimum.selector);
    vm.expectRevert(abi.encodeWithSelector(PaymentBelowMinimum.selector, 50e6 - 1, 50e6));
    vm.prank(payer);
    cb.pay(openId, address(usdc), 50e6 - 1, 50e6 - 1);
  }

  function test_RevertWhen_Pay_PaymentAboveMaximum() public {
    _setLimits(address(usdc), false, 0, true, 150e6);
    _assertCanPay(openId, address(usdc), 150e6 + 1, PaymentAboveMaximum.selector);
    vm.expectRevert(abi.encodeWithSelector(PaymentAboveMaximum.selector, 150e6 + 1, 150e6));
    vm.prank(payer);
    cb.pay(openId, address(usdc), 150e6 + 1, 150e6 + 1);
  }

  function test_RevertWhen_Pay_InvalidPayableId_Unknown() public {
    _assertCanPay(UNKNOWN_PAYABLE, address(usdc), AMOUNT, InvalidPayableId.selector);
    vm.expectRevert(InvalidPayableId.selector);
    vm.prank(payer);
    cb.pay(UNKNOWN_PAYABLE, address(usdc), AMOUNT, AMOUNT);
  }

  function test_RevertWhen_Pay_InvalidPayableId_ForeignPayable() public {
    // A payable mirrored from chain B is not payable with same-chain `pay`.
    _assertCanPay(foreignOpenId, address(usdc), AMOUNT, InvalidPayableId.selector);
    vm.expectRevert(InvalidPayableId.selector);
    vm.prank(payer);
    cb.pay(foreignOpenId, address(usdc), AMOUNT, AMOUNT);
  }

  function test_RevertWhen_Pay_PayableIsClosed() public {
    _assertCanPay(closedId, address(usdc), AMOUNT, PayableIsClosed.selector);
    vm.expectRevert(PayableIsClosed.selector);
    vm.prank(payer);
    cb.pay(closedId, address(usdc), AMOUNT, AMOUNT);
  }

  function test_RevertWhen_Pay_MatchingTokenAndAmountNotFound_WrongAmount() public {
    _assertCanPay(restrictedId, address(usdc), AMOUNT - 1, MatchingTokenAndAmountNotFound.selector);
    vm.expectRevert(MatchingTokenAndAmountNotFound.selector);
    vm.prank(payer);
    cb.pay(restrictedId, address(usdc), AMOUNT - 1, AMOUNT - 1);
  }

  function test_RevertWhen_Pay_MatchingTokenAndAmountNotFound_WrongToken() public {
    _assertCanPay(restrictedId, native, AMOUNT, MatchingTokenAndAmountNotFound.selector);
    vm.expectRevert(MatchingTokenAndAmountNotFound.selector);
    vm.prank(payer);
    cb.pay{value: AMOUNT}(restrictedId, native, AMOUNT, AMOUNT);
  }

  // ---------------------------------------------------------------------------
  // canPay vs pay: check precedence with stacked failures
  // ---------------------------------------------------------------------------

  function test_RevertWhen_Pay_GlobalPauseBeforeFeaturePause() public {
    vm.startPrank(owner);
    cb.pause();
    cb.pauseFeatures(FEATURE_PAY);
    vm.stopPrank();
    _assertCanPay(UNKNOWN_PAYABLE, address(0), 0, EnforcedPause.selector);
    vm.expectRevert(EnforcedPause.selector);
    vm.prank(payer);
    cb.pay(UNKNOWN_PAYABLE, address(0), 0, 0);
  }

  function test_RevertWhen_Pay_InvalidTokenBeforeZeroAmount() public {
    _assertCanPay(UNKNOWN_PAYABLE, address(0), 0, InvalidTokenAddress.selector);
    vm.expectRevert(InvalidTokenAddress.selector);
    vm.prank(payer);
    cb.pay(UNKNOWN_PAYABLE, address(0), 0, 0);
  }

  function test_RevertWhen_Pay_UnsupportedTokenBeforeZeroAmount() public {
    _assertCanPay(closedId, address(rogue), 0, UnsupportedToken.selector);
    vm.expectRevert(abi.encodeWithSelector(UnsupportedToken.selector, address(rogue)));
    vm.prank(payer);
    cb.pay(closedId, address(rogue), 0, 0);
  }

  function test_RevertWhen_Pay_LimitsBeforePayableChecks() public {
    _setLimits(address(usdc), true, 50e6, false, 0);
    _assertCanPay(closedId, address(usdc), 1, PaymentBelowMinimum.selector);
    vm.expectRevert(abi.encodeWithSelector(PaymentBelowMinimum.selector, 1, 50e6));
    vm.prank(payer);
    cb.pay(closedId, address(usdc), 1, 1);
  }

  function test_RevertWhen_Pay_ClosedBeforeAllowedTokenMismatch() public {
    _close(chainA, restrictedId);
    _assertCanPay(restrictedId, address(usdc), AMOUNT - 1, PayableIsClosed.selector);
    vm.expectRevert(PayableIsClosed.selector);
    vm.prank(payer);
    cb.pay(restrictedId, address(usdc), AMOUNT - 1, AMOUNT - 1);
  }

  // ---------------------------------------------------------------------------
  // canPay vs pay: success
  // ---------------------------------------------------------------------------

  function test_Pay_CanPayTrue_Erc20AnyToken() public {
    _assertCanPay(openId, address(usdc), AMOUNT, bytes4(0));
    uint256 payerBefore = usdc.balanceOf(payer);
    vm.prank(payer);
    cb.pay(openId, address(usdc), AMOUNT, AMOUNT);
    assertEq(usdc.balanceOf(payer), payerBefore - AMOUNT);
    assertEq(cb.getBalance(openId, address(usdc)), AMOUNT);
  }

  function test_Pay_CanPayTrue_Native() public {
    _assertCanPay(openId, native, 2 ether, bytes4(0));
    uint256 diamondBefore = address(cb).balance;
    vm.prank(payer);
    cb.pay{value: 2 ether}(openId, native, 2 ether, 2 ether);
    assertEq(address(cb).balance, diamondBefore + 2 ether);
    assertEq(cb.getBalance(openId, native), 2 ether);
  }

  function test_Pay_CanPayTrue_ExactAllowedMatch() public {
    _assertCanPay(restrictedId, address(usdc), AMOUNT, bytes4(0));
    vm.prank(payer);
    cb.pay(restrictedId, address(usdc), AMOUNT, AMOUNT);
    assertEq(cb.getBalance(restrictedId, address(usdc)), AMOUNT);
  }

  function test_Pay_CanPayTrue_AtLimitBoundaries() public {
    _setLimits(address(usdc), true, 50e6, true, 150e6);
    _assertCanPay(openId, address(usdc), 50e6, bytes4(0));
    _assertCanPay(openId, address(usdc), 150e6, bytes4(0));
    vm.startPrank(payer);
    cb.pay(openId, address(usdc), 50e6, 50e6);
    cb.pay(openId, address(usdc), 150e6, 150e6);
    vm.stopPrank();
    assertEq(cb.getBalance(openId, address(usdc)), 200e6);
  }

  function test_Pay_CanPayTrue_AutoWithdrawSendsToHost() public {
    bytes32 autoId = _createPayable(chainA, host, _anyToken(), true);
    _assertCanPay(autoId, address(usdc), AMOUNT, bytes4(0));
    WithdrawalQuote memory quote = cb.quoteWithdrawal(autoId, address(usdc), AMOUNT);
    uint256 hostBefore = usdc.balanceOf(host);
    uint256 collectorBefore = usdc.balanceOf(feeCollector);
    vm.prank(payer);
    cb.pay(autoId, address(usdc), AMOUNT, AMOUNT);
    assertEq(usdc.balanceOf(host) - hostBefore, quote.net);
    assertEq(usdc.balanceOf(feeCollector) - collectorBefore, quote.fee);
    assertEq(cb.getBalance(autoId, address(usdc)), 0);
  }

  /// `canPay` takes no `maxAmountIn` and no `msg.value`: the errors that only depend on those inputs are outside what
  /// it can predict, so it reports success while the call reverts.
  function test_Pay_CanPayTrueDespiteInvalidCallerInputs() public {
    _assertCanPay(openId, address(usdc), AMOUNT, bytes4(0));
    vm.expectRevert(abi.encodeWithSelector(InvalidMaxAmountIn.selector, AMOUNT - 1, AMOUNT));
    vm.prank(payer);
    cb.pay(openId, address(usdc), AMOUNT, AMOUNT - 1);

    vm.expectRevert(abi.encodeWithSelector(TransferTaxNotAllowed.selector, address(usdc)));
    vm.prank(payer);
    cb.pay(openId, address(usdc), AMOUNT, AMOUNT + 1);

    vm.expectRevert(abi.encodeWithSelector(IncorrectNativeValue.selector, 1, 0));
    vm.prank(payer);
    cb.pay{value: 1}(openId, address(usdc), AMOUNT, AMOUNT);

    _assertCanPay(openId, native, AMOUNT, bytes4(0));
    vm.expectRevert(abi.encodeWithSelector(IncorrectNativeValue.selector, AMOUNT - 1, AMOUNT));
    vm.prank(payer);
    cb.pay{value: AMOUNT - 1}(openId, native, AMOUNT, AMOUNT);
  }

  // ---------------------------------------------------------------------------
  // canPayForeign vs payForeignViaCctp: failure branches, in check order
  // ---------------------------------------------------------------------------

  function test_RevertWhen_PayForeign_EnforcedPause() public {
    vm.prank(owner);
    cb.pause();
    _assertCanPayForeign(foreignOpenId, address(usdc), AMOUNT, 0, EnforcedPause.selector);
    vm.expectRevert(EnforcedPause.selector);
    vm.prank(payer);
    cb.payForeignViaCctp(foreignOpenId, address(usdc), AMOUNT, 0);
  }

  function test_RevertWhen_PayForeign_FeaturePaused() public {
    vm.prank(owner);
    cb.pauseFeatures(FEATURE_PAY_FOREIGN);
    _assertCanPayForeign(foreignOpenId, address(usdc), AMOUNT, 0, FeaturePaused.selector);
    vm.expectRevert(abi.encodeWithSelector(FeaturePaused.selector, FEATURE_PAY_FOREIGN));
    vm.prank(payer);
    cb.payForeignViaCctp(foreignOpenId, address(usdc), AMOUNT, 0);
  }

  function test_RevertWhen_PayForeign_CctpNotEnabled() public {
    vm.prank(owner);
    cb.setCctpEnabled(false);
    _assertCanPayForeign(foreignOpenId, address(usdc), AMOUNT, 0, CctpNotEnabled.selector);
    vm.expectRevert(CctpNotEnabled.selector);
    vm.prank(payer);
    cb.payForeignViaCctp(foreignOpenId, address(usdc), AMOUNT, 0);
  }

  function test_RevertWhen_PayForeign_NativeTokenNotBridgeable() public {
    _assertCanPayForeign(foreignOpenId, native, AMOUNT, 0, NativeTokenNotBridgeable.selector);
    vm.expectRevert(NativeTokenNotBridgeable.selector);
    vm.prank(payer);
    cb.payForeignViaCctp(foreignOpenId, native, AMOUNT, 0);
  }

  function test_RevertWhen_PayForeign_InvalidTokenAddress() public {
    _assertCanPayForeign(foreignOpenId, address(0), AMOUNT, 0, InvalidTokenAddress.selector);
    vm.expectRevert(InvalidTokenAddress.selector);
    vm.prank(payer);
    cb.payForeignViaCctp(foreignOpenId, address(0), AMOUNT, 0);
  }

  function test_RevertWhen_PayForeign_UnsupportedToken() public {
    _assertCanPayForeign(foreignOpenId, address(rogue), AMOUNT, 0, UnsupportedToken.selector);
    vm.expectRevert(abi.encodeWithSelector(UnsupportedToken.selector, address(rogue)));
    vm.prank(payer);
    cb.payForeignViaCctp(foreignOpenId, address(rogue), AMOUNT, 0);
  }

  function test_RevertWhen_PayForeign_UnsupportedToken_Stopped() public {
    vm.prank(owner);
    cb.stopPaymentsForToken(address(usdc));
    _assertCanPayForeign(foreignOpenId, address(usdc), AMOUNT, 0, UnsupportedToken.selector);
    vm.expectRevert(abi.encodeWithSelector(UnsupportedToken.selector, address(usdc)));
    vm.prank(payer);
    cb.payForeignViaCctp(foreignOpenId, address(usdc), AMOUNT, 0);
  }

  function test_RevertWhen_PayForeign_ZeroAmountSpecified() public {
    _assertCanPayForeign(foreignOpenId, address(usdc), 0, 0, ZeroAmountSpecified.selector);
    vm.expectRevert(ZeroAmountSpecified.selector);
    vm.prank(payer);
    cb.payForeignViaCctp(foreignOpenId, address(usdc), 0, 0);
  }

  function test_RevertWhen_PayForeign_PaymentBelowMinimum() public {
    _setLimits(address(usdc), true, 50e6, false, 0);
    _assertCanPayForeign(foreignOpenId, address(usdc), 50e6 - 1, 0, PaymentBelowMinimum.selector);
    vm.expectRevert(abi.encodeWithSelector(PaymentBelowMinimum.selector, 50e6 - 1, 50e6));
    vm.prank(payer);
    cb.payForeignViaCctp(foreignOpenId, address(usdc), 50e6 - 1, 0);
  }

  function test_RevertWhen_PayForeign_PaymentAboveMaximum() public {
    _setLimits(address(usdc), false, 0, true, 150e6);
    _assertCanPayForeign(foreignOpenId, address(usdc), 150e6 + 1, 0, PaymentAboveMaximum.selector);
    vm.expectRevert(abi.encodeWithSelector(PaymentAboveMaximum.selector, 150e6 + 1, 150e6));
    vm.prank(payer);
    cb.payForeignViaCctp(foreignOpenId, address(usdc), 150e6 + 1, 0);
  }

  function test_RevertWhen_PayForeign_AmountExceedsCrossChainLimit() public {
    uint256 amount = uint256(type(uint64).max) + 1;
    _assertCanPayForeign(foreignOpenId, address(usdc), amount, 0, AmountExceedsCrossChainLimit.selector);
    vm.expectRevert(AmountExceedsCrossChainLimit.selector);
    vm.prank(payer);
    cb.payForeignViaCctp(foreignOpenId, address(usdc), amount, 0);
  }

  function test_RevertWhen_PayForeign_InvalidPayableId_Unknown() public {
    _assertCanPayForeign(UNKNOWN_PAYABLE, address(usdc), AMOUNT, 0, InvalidPayableId.selector);
    vm.expectRevert(InvalidPayableId.selector);
    vm.prank(payer);
    cb.payForeignViaCctp(UNKNOWN_PAYABLE, address(usdc), AMOUNT, 0);
  }

  function test_RevertWhen_PayForeign_InvalidPayableId_LocalPayable() public {
    // A payable hosted on this chain is not a foreign payable.
    _assertCanPayForeign(openId, address(usdc), AMOUNT, 0, InvalidPayableId.selector);
    vm.expectRevert(InvalidPayableId.selector);
    vm.prank(payer);
    cb.payForeignViaCctp(openId, address(usdc), AMOUNT, 0);
  }

  function test_RevertWhen_PayForeign_PayableIsClosed() public {
    _assertCanPayForeign(foreignClosedId, address(usdc), AMOUNT, 0, PayableIsClosed.selector);
    vm.expectRevert(PayableIsClosed.selector);
    vm.prank(payer);
    cb.payForeignViaCctp(foreignClosedId, address(usdc), AMOUNT, 0);
  }

  function test_RevertWhen_PayForeign_ForeignChainNotRegistered() public {
    // The mirrored payable outlives the registration of its hosting chain.
    vm.prank(owner);
    cb.unregisterForeignChain(chainB.cbChainId);
    _assertCanPayForeign(foreignOpenId, address(usdc), AMOUNT, 0, ForeignChainNotRegistered.selector);
    vm.expectRevert(abi.encodeWithSelector(ForeignChainNotRegistered.selector, chainB.cbChainId));
    vm.prank(payer);
    cb.payForeignViaCctp(foreignOpenId, address(usdc), AMOUNT, 0);
  }

  function test_RevertWhen_PayForeign_OutboundPaymentsDisabled() public {
    _disableOutboundPayments();
    _assertCanPayForeign(foreignOpenId, address(usdc), AMOUNT, 0, OutboundPaymentsDisabled.selector);
    vm.expectRevert(abi.encodeWithSelector(OutboundPaymentsDisabled.selector, chainB.cbChainId));
    vm.prank(payer);
    cb.payForeignViaCctp(foreignOpenId, address(usdc), AMOUNT, 0);
  }

  /// The chain registry rejects outbound payments without a Circle domain, so this state is written directly to
  /// storage to exercise the defensive check in both paths.
  function test_RevertWhen_PayForeign_ForeignChainHasNoCircleDomain() public {
    _clearCircleDomainInStorage(chainB.cbChainId);
    _assertCanPayForeign(foreignOpenId, address(usdc), AMOUNT, 0, ForeignChainHasNoCircleDomain.selector);
    vm.expectRevert(abi.encodeWithSelector(ForeignChainHasNoCircleDomain.selector, chainB.cbChainId));
    vm.prank(payer);
    cb.payForeignViaCctp(foreignOpenId, address(usdc), AMOUNT, 0);
  }

  function test_RevertWhen_PayForeign_CctpMaxFeeTooHigh() public {
    _setFeeCap(100); // 1%
    _assertCanPayForeign(foreignOpenId, address(usdc), AMOUNT, 1e6 + 1, CctpMaxFeeTooHigh.selector);
    vm.expectRevert(abi.encodeWithSelector(CctpMaxFeeTooHigh.selector, 1e6 + 1, 1e6));
    vm.prank(payer);
    cb.payForeignViaCctp(foreignOpenId, address(usdc), AMOUNT, 1e6 + 1);
  }

  function test_RevertWhen_PayForeign_CctpMaxFeeTooHigh_ZeroCap() public {
    _setFeeCap(0);
    _assertCanPayForeign(foreignOpenId, address(usdc), AMOUNT, 1, CctpMaxFeeTooHigh.selector);
    vm.expectRevert(abi.encodeWithSelector(CctpMaxFeeTooHigh.selector, 1, 0));
    vm.prank(payer);
    cb.payForeignViaCctp(foreignOpenId, address(usdc), AMOUNT, 1);
  }

  function test_RevertWhen_PayForeign_CctpMaxFeeTooHigh_RoundsLimitDown() public {
    // 1% of 199 base units is 1.99, floored to 1.
    _setFeeCap(100);
    _assertCanPayForeign(foreignOpenId, address(usdc), 199, 2, CctpMaxFeeTooHigh.selector);
    vm.expectRevert(abi.encodeWithSelector(CctpMaxFeeTooHigh.selector, 2, 1));
    vm.prank(payer);
    cb.payForeignViaCctp(foreignOpenId, address(usdc), 199, 2);
  }

  function test_RevertWhen_PayForeign_MatchingTokenNotFound_NeverMatched() public {
    _assertCanPayForeign(foreignOpenId, address(loose), AMOUNT, 0, MatchingTokenNotFound.selector);
    vm.expectRevert(abi.encodeWithSelector(MatchingTokenNotFound.selector, chainB.cbChainId, bytes32(0)));
    vm.prank(payer);
    cb.payForeignViaCctp(foreignOpenId, address(loose), AMOUNT, 0);
  }

  function test_RevertWhen_PayForeign_MatchingTokenNotFound_Unregistered() public {
    vm.prank(owner);
    cb.unregisterMatchingToken(chainB.cbChainId, _toBytes32(address(chainB.usdc)));
    _assertCanPayForeign(foreignOpenId, address(usdc), AMOUNT, 0, MatchingTokenNotFound.selector);
    vm.expectRevert(abi.encodeWithSelector(MatchingTokenNotFound.selector, chainB.cbChainId, bytes32(0)));
    vm.prank(payer);
    cb.payForeignViaCctp(foreignOpenId, address(usdc), AMOUNT, 0);
  }

  function test_RevertWhen_PayForeign_MatchingTokenAndAmountNotFound() public {
    _assertCanPayForeign(foreignRestrictedId, address(usdc), AMOUNT - 1, 0, MatchingTokenAndAmountNotFound.selector);
    vm.expectRevert(MatchingTokenAndAmountNotFound.selector);
    vm.prank(payer);
    cb.payForeignViaCctp(foreignRestrictedId, address(usdc), AMOUNT - 1, 0);
  }

  function test_RevertWhen_PayForeign_MatchingTokenAndAmountNotFound_MatchRemapped() public {
    // The allowed entry names chain B USDC, which now maps to `loose` instead of chain A USDC.
    vm.prank(owner);
    cb.registerMatchingToken(chainB.cbChainId, _toBytes32(address(chainB.usdc)), address(loose));
    vm.prank(owner);
    cb.registerMatchingToken(chainB.cbChainId, keccak256('other-foreign-token'), address(usdc));
    _assertCanPayForeign(foreignRestrictedId, address(usdc), AMOUNT, 0, MatchingTokenAndAmountNotFound.selector);
    vm.expectRevert(MatchingTokenAndAmountNotFound.selector);
    vm.prank(payer);
    cb.payForeignViaCctp(foreignRestrictedId, address(usdc), AMOUNT, 0);
  }

  // ---------------------------------------------------------------------------
  // canPayForeign vs payForeignViaCctp: check precedence with stacked failures
  // ---------------------------------------------------------------------------

  function test_RevertWhen_PayForeign_CctpDisabledBeforeNativeToken() public {
    vm.prank(owner);
    cb.setCctpEnabled(false);
    _assertCanPayForeign(UNKNOWN_PAYABLE, native, 0, 0, CctpNotEnabled.selector);
    vm.expectRevert(CctpNotEnabled.selector);
    vm.prank(payer);
    cb.payForeignViaCctp(UNKNOWN_PAYABLE, native, 0, 0);
  }

  function test_RevertWhen_PayForeign_CrossChainLimitBeforePayableChecks() public {
    uint256 amount = uint256(type(uint64).max) + 1;
    _assertCanPayForeign(UNKNOWN_PAYABLE, address(usdc), amount, 0, AmountExceedsCrossChainLimit.selector);
    vm.expectRevert(AmountExceedsCrossChainLimit.selector);
    vm.prank(payer);
    cb.payForeignViaCctp(UNKNOWN_PAYABLE, address(usdc), amount, 0);
  }

  function test_RevertWhen_PayForeign_ClosedBeforeChainChecks() public {
    vm.prank(owner);
    cb.unregisterForeignChain(chainB.cbChainId);
    _assertCanPayForeign(foreignClosedId, address(usdc), AMOUNT, 0, PayableIsClosed.selector);
    vm.expectRevert(PayableIsClosed.selector);
    vm.prank(payer);
    cb.payForeignViaCctp(foreignClosedId, address(usdc), AMOUNT, 0);
  }

  function test_RevertWhen_PayForeign_OutboundDisabledBeforeFeeCap() public {
    _setFeeCap(0);
    _disableOutboundPayments();
    _assertCanPayForeign(foreignOpenId, address(loose), AMOUNT, 1, OutboundPaymentsDisabled.selector);
    vm.expectRevert(abi.encodeWithSelector(OutboundPaymentsDisabled.selector, chainB.cbChainId));
    vm.prank(payer);
    cb.payForeignViaCctp(foreignOpenId, address(loose), AMOUNT, 1);
  }

  function test_RevertWhen_PayForeign_FeeCapBeforeMatchingToken() public {
    _setFeeCap(0);
    _assertCanPayForeign(foreignOpenId, address(loose), AMOUNT, 1, CctpMaxFeeTooHigh.selector);
    vm.expectRevert(abi.encodeWithSelector(CctpMaxFeeTooHigh.selector, 1, 0));
    vm.prank(payer);
    cb.payForeignViaCctp(foreignOpenId, address(loose), AMOUNT, 1);
  }

  // ---------------------------------------------------------------------------
  // canPayForeign vs payForeignViaCctp: success
  // ---------------------------------------------------------------------------

  function test_PayForeign_CanPayForeignTrue_BurnsAndCreditsOnChainB() public {
    uint256 maxFee = 1e6;
    _assertCanPayForeign(foreignOpenId, address(usdc), AMOUNT, maxFee, bytes4(0));
    uint256 payerBefore = usdc.balanceOf(payer);
    uint256 sentBefore = chainA.transmitter.sentCount();

    vm.prank(payer);
    cb.payForeignViaCctp(foreignOpenId, address(usdc), AMOUNT, maxFee);
    assertEq(usdc.balanceOf(payer), payerBefore - AMOUNT - maxFee);
    assertEq(chainA.transmitter.sentCount(), sentBefore + 1);
    // The diamond keeps nothing: the whole pull is burned.
    assertEq(usdc.balanceOf(address(cb)), FUNDED_USDC);

    (bytes memory message, bytes memory attestation) = _lastCctp(chainA, CCTP_FINALITY_FAST, maxFee, true);
    vm.prank(relayer);
    chainB.cb.receiveForeignPaymentViaCctp(message, attestation);
    assertEq(chainB.cb.getBalance(foreignOpenId, address(chainB.usdc)), AMOUNT);
  }

  function test_PayForeign_CanPayForeignTrue_ExactAllowedMatch() public {
    _assertCanPayForeign(foreignRestrictedId, address(usdc), AMOUNT, 0, bytes4(0));
    uint256 payerBefore = usdc.balanceOf(payer);
    vm.prank(payer);
    cb.payForeignViaCctp(foreignRestrictedId, address(usdc), AMOUNT, 0);
    assertEq(usdc.balanceOf(payer), payerBefore - AMOUNT);
  }

  function test_PayForeign_CanPayForeignTrue_MaxFeeAtCap() public {
    _setFeeCap(100);
    _assertCanPayForeign(foreignOpenId, address(usdc), AMOUNT, 1e6, bytes4(0));
    uint256 payerBefore = usdc.balanceOf(payer);
    vm.prank(payer);
    cb.payForeignViaCctp(foreignOpenId, address(usdc), AMOUNT, 1e6);
    assertEq(usdc.balanceOf(payer), payerBefore - AMOUNT - 1e6);
  }

  function test_PayForeign_CanPayForeignTrue_AtCrossChainLimit() public {
    uint256 amount = type(uint64).max;
    _fundUsdc(chainA, payer, amount);
    _assertCanPayForeign(foreignOpenId, address(usdc), amount, 0, bytes4(0));
    vm.prank(payer);
    cb.payForeignViaCctp(foreignOpenId, address(usdc), amount, 0);
  }

  function test_PayForeign_CanPayForeignTrue_AfterReregistration() public {
    ForeignChain memory chain = cb.getForeignChain(chainB.cbChainId);
    vm.startPrank(owner);
    cb.unregisterForeignChain(chainB.cbChainId);
    cb.registerForeignChain(chainB.cbChainId, chain.config);
    vm.stopPrank();
    _assertCanPayForeign(foreignOpenId, address(usdc), AMOUNT, 0, bytes4(0));
    vm.prank(payer);
    cb.payForeignViaCctp(foreignOpenId, address(usdc), AMOUNT, 0);
  }

  // ---------------------------------------------------------------------------
  // canWithdraw vs withdraw: failure branches, in check order
  // ---------------------------------------------------------------------------

  function test_RevertWhen_Withdraw_EnforcedPause() public {
    vm.prank(owner);
    cb.pause();
    _assertCanWithdraw(fundedId, host, address(usdc), 1, EnforcedPause.selector);
    vm.expectRevert(EnforcedPause.selector);
    vm.prank(host);
    cb.withdraw(fundedId, address(usdc), 1);
  }

  function test_RevertWhen_Withdraw_FeaturePaused() public {
    vm.prank(owner);
    cb.pauseFeatures(FEATURE_WITHDRAW);
    _assertCanWithdraw(fundedId, host, address(usdc), 1, FeaturePaused.selector);
    vm.expectRevert(abi.encodeWithSelector(FeaturePaused.selector, FEATURE_WITHDRAW));
    vm.prank(host);
    cb.withdraw(fundedId, address(usdc), 1);
  }

  function test_RevertWhen_Withdraw_InvalidPayableId_Unknown() public {
    _assertCanWithdraw(UNKNOWN_PAYABLE, host, address(usdc), 1, InvalidPayableId.selector);
    vm.expectRevert(InvalidPayableId.selector);
    vm.prank(host);
    cb.withdraw(UNKNOWN_PAYABLE, address(usdc), 1);
  }

  function test_RevertWhen_Withdraw_InvalidPayableId_ForeignPayable() public {
    _assertCanWithdraw(foreignOpenId, host, address(usdc), 1, InvalidPayableId.selector);
    vm.expectRevert(InvalidPayableId.selector);
    vm.prank(host);
    cb.withdraw(foreignOpenId, address(usdc), 1);
  }

  function test_RevertWhen_Withdraw_NotYourPayable() public {
    _assertCanWithdraw(fundedId, stranger, address(usdc), 1, NotYourPayable.selector);
    vm.expectRevert(NotYourPayable.selector);
    vm.prank(stranger);
    cb.withdraw(fundedId, address(usdc), 1);
  }

  function test_RevertWhen_Withdraw_ZeroAmountSpecified() public {
    _assertCanWithdraw(fundedId, host, address(usdc), 0, ZeroAmountSpecified.selector);
    vm.expectRevert(ZeroAmountSpecified.selector);
    vm.prank(host);
    cb.withdraw(fundedId, address(usdc), 0);
  }

  function test_RevertWhen_Withdraw_NoBalanceForWithdrawalToken_NeverReceived() public {
    _assertCanWithdraw(fundedId, host, address(loose), 1, NoBalanceForWithdrawalToken.selector);
    vm.expectRevert(NoBalanceForWithdrawalToken.selector);
    vm.prank(host);
    cb.withdraw(fundedId, address(loose), 1);
  }

  function test_RevertWhen_Withdraw_NoBalanceForWithdrawalToken_EmptyPayable() public {
    _assertCanWithdraw(openId, host, address(usdc), 1, NoBalanceForWithdrawalToken.selector);
    vm.expectRevert(NoBalanceForWithdrawalToken.selector);
    vm.prank(host);
    cb.withdraw(openId, address(usdc), 1);
  }

  function test_RevertWhen_Withdraw_InsufficientWithdrawAmount() public {
    _assertCanWithdraw(fundedId, host, address(usdc), FUNDED_USDC + 1, InsufficientWithdrawAmount.selector);
    vm.expectRevert(abi.encodeWithSelector(InsufficientWithdrawAmount.selector, FUNDED_USDC, FUNDED_USDC + 1));
    vm.prank(host);
    cb.withdraw(fundedId, address(usdc), FUNDED_USDC + 1);
  }

  function test_RevertWhen_Withdraw_InsufficientWithdrawAmount_AfterDrained() public {
    // A drained token stays in the balance list, so the balance check fires rather than the token check.
    vm.prank(host);
    cb.withdraw(fundedId, address(usdc), FUNDED_USDC);
    _assertCanWithdraw(fundedId, host, address(usdc), 1, InsufficientWithdrawAmount.selector);
    vm.expectRevert(abi.encodeWithSelector(InsufficientWithdrawAmount.selector, 0, 1));
    vm.prank(host);
    cb.withdraw(fundedId, address(usdc), 1);
  }

  // ---------------------------------------------------------------------------
  // canWithdraw vs withdraw: check precedence with stacked failures
  // ---------------------------------------------------------------------------

  function test_RevertWhen_Withdraw_PauseBeforeHostCheck() public {
    vm.prank(owner);
    cb.pauseFeatures(FEATURE_WITHDRAW);
    _assertCanWithdraw(UNKNOWN_PAYABLE, stranger, address(0), 0, FeaturePaused.selector);
    vm.expectRevert(abi.encodeWithSelector(FeaturePaused.selector, FEATURE_WITHDRAW));
    vm.prank(stranger);
    cb.withdraw(UNKNOWN_PAYABLE, address(0), 0);
  }

  function test_RevertWhen_Withdraw_NotHostBeforeZeroAmount() public {
    _assertCanWithdraw(fundedId, stranger, address(loose), 0, NotYourPayable.selector);
    vm.expectRevert(NotYourPayable.selector);
    vm.prank(stranger);
    cb.withdraw(fundedId, address(loose), 0);
  }

  function test_RevertWhen_Withdraw_ZeroAmountBeforeTokenCheck() public {
    _assertCanWithdraw(fundedId, host, address(loose), 0, ZeroAmountSpecified.selector);
    vm.expectRevert(ZeroAmountSpecified.selector);
    vm.prank(host);
    cb.withdraw(fundedId, address(loose), 0);
  }

  // ---------------------------------------------------------------------------
  // canWithdraw vs withdraw: success
  // ---------------------------------------------------------------------------

  function test_Withdraw_CanWithdrawTrue_PartialErc20() public {
    uint256 amount = 123e6;
    _assertCanWithdraw(fundedId, host, address(usdc), amount, bytes4(0));
    WithdrawalQuote memory quote = cb.quoteWithdrawal(fundedId, address(usdc), amount);
    uint256 hostBefore = usdc.balanceOf(host);
    vm.prank(host);
    cb.withdraw(fundedId, address(usdc), amount);
    assertEq(usdc.balanceOf(host) - hostBefore, quote.net);
    assertEq(cb.getBalance(fundedId, address(usdc)), FUNDED_USDC - amount);
  }

  function test_Withdraw_CanWithdrawTrue_FullNative() public {
    _assertCanWithdraw(fundedId, host, native, FUNDED_NATIVE, bytes4(0));
    WithdrawalQuote memory quote = cb.quoteWithdrawal(fundedId, native, FUNDED_NATIVE);
    uint256 hostBefore = host.balance;
    vm.prank(host);
    cb.withdraw(fundedId, native, FUNDED_NATIVE);
    assertEq(host.balance - hostBefore, quote.net);
    assertEq(cb.getBalance(fundedId, native), 0);
  }

  function test_Withdraw_CanWithdrawTrue_TokenStoppedForPayments() public {
    // Stopping payments for a token never traps balances already received.
    vm.prank(owner);
    cb.stopPaymentsForToken(address(usdc));
    _assertCanWithdraw(fundedId, host, address(usdc), FUNDED_USDC, bytes4(0));
    vm.prank(host);
    cb.withdraw(fundedId, address(usdc), FUNDED_USDC);
    assertEq(cb.getBalance(fundedId, address(usdc)), 0);
  }

  function test_Withdraw_CanWithdrawTrue_ClosedPayable() public {
    vm.prank(payer);
    cb.pay(restrictedId, address(usdc), AMOUNT, AMOUNT);
    _close(chainA, restrictedId);
    _assertCanWithdraw(restrictedId, host, address(usdc), AMOUNT, bytes4(0));
    vm.prank(host);
    cb.withdraw(restrictedId, address(usdc), AMOUNT);
    assertEq(cb.getBalance(restrictedId, address(usdc)), 0);
  }

  /// `canWithdraw` does not model the outgoing transfer: a host that rejects native tokens passes the check while the
  /// withdrawal reverts in the transfer.
  function test_Withdraw_CanWithdrawTrueDespiteRejectingHost() public {
    RejectEth rejecter = new RejectEth();
    bytes32 id = _createPayable(chainA, address(rejecter), _anyToken(), false);
    vm.prank(payer);
    cb.pay{value: 1 ether}(id, native, 1 ether, 1 ether);
    WithdrawalQuote memory quote = cb.quoteWithdrawal(id, native, 1 ether);

    _assertCanWithdraw(id, address(rejecter), native, 1 ether, bytes4(0));
    vm.expectRevert(abi.encodeWithSelector(NativeTransferFailed.selector, address(rejecter), quote.net));
    vm.prank(address(rejecter));
    cb.withdraw(id, native, 1 ether);
  }

  // ---------------------------------------------------------------------------
  // Differential fuzzing: pre-flight check outcome equals real call outcome
  // ---------------------------------------------------------------------------

  function testFuzz_CanPay_AgreesWithPay(
    uint8 pauseMode,
    uint8 limitMode,
    uint8 tokenKind,
    uint8 amountKind,
    uint8 payableKind
  ) public {
    _applyPause(pauseMode, FEATURE_PAY);

    address token = [address(0), address(rogue), address(usdc), native, address(loose)][tokenKind % 5];
    uint256 amount = [uint256(0), 10e6, AMOUNT, 200e6][amountKind % 4];
    bytes32 id = [UNKNOWN_PAYABLE, openId, restrictedId, closedId, foreignOpenId][payableKind % 5];
    if (token != address(0) && token != address(rogue)) _applyLimits(token, limitMode);

    (bool isOk, bytes4 selector) = cb.canPay(id, token, amount);
    uint256 balanceBefore = token == address(0) ? 0 : cb.getBalance(id, token);
    (bool isRealOk, bytes4 realSelector) = _tryPay(id, token, amount);
    assertEq(isRealOk, isOk, 'canPay success mismatch');
    assertEq(realSelector, selector, 'canPay selector mismatch');
    if (isRealOk) assertEq(cb.getBalance(id, token), balanceBefore + amount);
  }

  function testFuzz_CanPayForeign_AgreesWithPayForeignViaCctp(
    uint8 pauseMode,
    bool isCctpDisabled,
    uint8 limitMode,
    uint8 tokenKind,
    uint8 amountKind,
    uint8 payableKind,
    uint8 chainMode,
    uint8 capMode,
    uint8 maxFeeKind
  ) public {
    _applyPause(pauseMode, FEATURE_PAY_FOREIGN);
    if (isCctpDisabled) {
      vm.prank(owner);
      cb.setCctpEnabled(false);
    }

    address token = [native, address(0), address(rogue), address(usdc), address(loose)][tokenKind % 5];
    uint256 amount = [uint256(0), 10e6, AMOUNT, uint256(type(uint64).max) + 1][amountKind % 4];
    bytes32 id = [UNKNOWN_PAYABLE, foreignOpenId, foreignRestrictedId, foreignClosedId, openId][payableKind % 5];
    uint256 maxFee = [uint256(0), 1e6, 5e6][maxFeeKind % 3];
    if (token == address(usdc) || token == address(loose)) _applyLimits(token, limitMode);

    // Fee caps need a registered chain, so they are set before any registration change.
    capMode %= 3;
    if (capMode == 1) _setFeeCap(100);
    else if (capMode == 2) _setFeeCap(0);

    chainMode %= 4;
    if (chainMode == 1) {
      vm.prank(owner);
      cb.unregisterForeignChain(chainB.cbChainId);
    } else if (chainMode == 2) {
      _disableOutboundPayments();
    } else if (chainMode == 3) {
      _clearCircleDomainInStorage(chainB.cbChainId);
    }

    (bool isOk, bytes4 selector) = cb.canPayForeign(id, token, amount, maxFee);
    uint256 payerBefore = token.code.length == 0 || token == native ? 0 : MockERC20(token).balanceOf(payer);
    (bool isRealOk, bytes4 realSelector) = _tryPayForeign(id, token, amount, maxFee);
    assertEq(isRealOk, isOk, 'canPayForeign success mismatch');
    assertEq(realSelector, selector, 'canPayForeign selector mismatch');
    if (isRealOk) assertEq(MockERC20(token).balanceOf(payer), payerBefore - amount - maxFee);
  }

  function testFuzz_CanWithdraw_AgreesWithWithdraw(
    uint8 pauseMode,
    uint8 payableKind,
    bool isStranger,
    uint8 tokenKind,
    uint8 amountKind
  ) public {
    _applyPause(pauseMode, FEATURE_WITHDRAW);

    bytes32 id = [UNKNOWN_PAYABLE, fundedId, openId, foreignOpenId][payableKind % 4];
    address caller = isStranger ? stranger : host;
    address token = [address(usdc), native, address(loose), address(0)][tokenKind % 4];
    uint256 amount = [uint256(0), 1, FUNDED_USDC, FUNDED_USDC + 1, FUNDED_NATIVE, FUNDED_NATIVE + 1][amountKind % 6];

    (bool isOk, bytes4 selector) = cb.canWithdraw(id, caller, token, amount);
    uint256 balanceBefore = cb.getBalance(id, token);
    (bool isRealOk, bytes4 realSelector) = _tryWithdraw(caller, id, token, amount);
    assertEq(isRealOk, isOk, 'canWithdraw success mismatch');
    assertEq(realSelector, selector, 'canWithdraw selector mismatch');
    if (isRealOk) assertEq(cb.getBalance(id, token), balanceBefore - amount);
  }

  // ---------------------------------------------------------------------------
  // quoteWithdrawal vs withdraw
  // ---------------------------------------------------------------------------

  function test_QuoteWithdrawal_MatchesWithdraw_GlobalFee() public {
    WithdrawalQuote memory quote = _assertQuoteMatchesWithdraw(address(usdc), 10_000e6, 3_333e6);
    assertEq(quote.feeBps, DEFAULT_FEE_BPS);
    assertEq(quote.fee, (3_333e6 * uint256(DEFAULT_FEE_BPS)) / 10_000);
    assertFalse(quote.isFeeCapped);
  }

  function test_QuoteWithdrawal_MatchesWithdraw_GlobalFeeNative() public {
    WithdrawalQuote memory quote = _assertQuoteMatchesWithdraw(native, 3 ether, 3 ether);
    assertEq(quote.fee, (3 ether * uint256(DEFAULT_FEE_BPS)) / 10_000);
  }

  function test_QuoteWithdrawal_MatchesWithdraw_GlobalFeeChanged() public {
    vm.prank(owner);
    cb.setWithdrawalFeeBps(75);
    WithdrawalQuote memory quote = _assertQuoteMatchesWithdraw(address(usdc), 1_000e6, 1_000e6);
    assertEq(quote.feeBps, 75);
    assertEq(quote.fee, 7.5e6);
  }

  function test_QuoteWithdrawal_MatchesWithdraw_FeeRoundsDownToZero() public {
    // 49 * 200 / 10_000 = 0.98, floored to zero: the fee transfer is skipped.
    WithdrawalQuote memory quote = _assertQuoteMatchesWithdraw(address(usdc), 49, 49);
    assertEq(quote.fee, 0);
    assertEq(quote.net, 49);
  }

  function test_QuoteWithdrawal_MatchesWithdraw_TokenFeeBpsOverride() public {
    vm.prank(owner);
    cb.setTokenFeeBps(address(usdc), 500);
    WithdrawalQuote memory quote = _assertQuoteMatchesWithdraw(address(usdc), 1_000e6, 400e6);
    assertEq(quote.feeBps, 500);
    assertEq(quote.fee, 20e6);
    assertFalse(quote.isFeeCapped);
  }

  function test_QuoteWithdrawal_MatchesWithdraw_TokenFeeBpsOverrideOnlyAffectsThatToken() public {
    vm.prank(owner);
    cb.setTokenFeeBps(address(usdc), 500);
    WithdrawalQuote memory quote = _assertQuoteMatchesWithdraw(native, 1 ether, 1 ether);
    assertEq(quote.feeBps, DEFAULT_FEE_BPS);
  }

  function test_QuoteWithdrawal_MatchesWithdraw_FeeCapReducesFee() public {
    vm.startPrank(owner);
    cb.setTokenFeeBps(address(usdc), 500);
    cb.setTokenMaxWithdrawalFee(address(usdc), 3e6);
    vm.stopPrank();
    WithdrawalQuote memory quote = _assertQuoteMatchesWithdraw(address(usdc), 1_000e6, 1_000e6);
    assertEq(quote.fee, 3e6);
    assertEq(quote.net, 997e6);
    assertTrue(quote.isFeeCapped);
  }

  function test_QuoteWithdrawal_MatchesWithdraw_FeeCapOnGlobalFee() public {
    vm.prank(owner);
    cb.setTokenMaxWithdrawalFee(address(usdc), 1e6);
    WithdrawalQuote memory quote = _assertQuoteMatchesWithdraw(address(usdc), 1_000e6, 1_000e6);
    assertEq(quote.feeBps, DEFAULT_FEE_BPS);
    assertEq(quote.fee, 1e6);
    assertTrue(quote.isFeeCapped);
  }

  function test_QuoteWithdrawal_MatchesWithdraw_FeeCapAboveFeeUnapplied() public {
    vm.prank(owner);
    cb.setTokenMaxWithdrawalFee(address(usdc), 1_000e6);
    WithdrawalQuote memory quote = _assertQuoteMatchesWithdraw(address(usdc), 1_000e6, 1_000e6);
    assertEq(quote.fee, 20e6);
    assertFalse(quote.isFeeCapped);
  }

  function test_QuoteWithdrawal_MatchesWithdraw_FeeCapZeroIsFree() public {
    vm.prank(owner);
    cb.setTokenMaxWithdrawalFee(address(usdc), 0);
    WithdrawalQuote memory quote = _assertQuoteMatchesWithdraw(address(usdc), 1_000e6, 1_000e6);
    assertEq(quote.fee, 0);
    assertEq(quote.net, 1_000e6);
    assertTrue(quote.isFeeCapped);
  }

  function test_QuoteWithdrawal_MatchesWithdraw_FeeBpsOverrideZero() public {
    vm.prank(owner);
    cb.setTokenFeeBps(address(usdc), 0);
    WithdrawalQuote memory quote = _assertQuoteMatchesWithdraw(address(usdc), 1_000e6, 1_000e6);
    assertEq(quote.feeBps, 0);
    assertEq(quote.fee, 0);
    assertEq(quote.net, 1_000e6);
    assertFalse(quote.isFeeCapped);
  }

  function test_QuoteWithdrawal_MatchesWithdraw_FeeBpsOverrideCleared() public {
    vm.startPrank(owner);
    cb.setTokenFeeBps(address(usdc), 0);
    cb.clearTokenFeeBps(address(usdc));
    vm.stopPrank();
    WithdrawalQuote memory quote = _assertQuoteMatchesWithdraw(address(usdc), 1_000e6, 1_000e6);
    assertEq(quote.feeBps, DEFAULT_FEE_BPS);
    assertEq(quote.fee, 20e6);
  }

  function test_QuoteWithdrawal_MatchesWithdraw_FullFee() public {
    vm.prank(owner);
    cb.setTokenFeeBps(address(usdc), 10_000);
    WithdrawalQuote memory quote = _assertQuoteMatchesWithdraw(address(usdc), 1_000e6, 1_000e6);
    assertEq(quote.fee, 1_000e6);
    assertEq(quote.net, 0);
  }

  function testFuzz_QuoteWithdrawal_MatchesWithdraw(
    uint256 funded,
    uint256 amount,
    uint16 globalBps,
    bool hasOverride,
    uint16 overrideBps,
    bool hasCap,
    uint256 cap
  ) public {
    funded = bound(funded, 1, 1e30);
    amount = bound(amount, 1, funded);
    globalBps = uint16(bound(globalBps, 0, 10_000));
    overrideBps = uint16(bound(overrideBps, 0, 10_000));
    cap = bound(cap, 0, funded);

    vm.startPrank(owner);
    cb.setWithdrawalFeeBps(globalBps);
    if (hasOverride) cb.setTokenFeeBps(address(usdc), overrideBps);
    if (hasCap) cb.setTokenMaxWithdrawalFee(address(usdc), cap);
    vm.stopPrank();

    WithdrawalQuote memory quote = _assertQuoteMatchesWithdraw(address(usdc), funded, amount);
    assertEq(quote.fee + quote.net, amount);
    assertLe(quote.fee, amount);
    if (hasCap) assertLe(quote.fee, cap);
  }

  // ---------------------------------------------------------------------------
  // quotePublishPayableDetailsFee vs publishPayableDetails
  // ---------------------------------------------------------------------------

  function test_QuotePublishPayableDetailsFee_OpenPayable_WormholeActive() public {
    uint256 quote = cb.quotePublishPayableDetailsFee(openId);
    assertEq(quote, WORMHOLE_FEE);
    assertEq(quote, cb.quoteBroadcastFee());
    _assertPublishRequiresExactly(openId, quote, 1, true);
  }

  function test_QuotePublishPayableDetailsFee_ClosedPayable_WormholeActive() public {
    uint256 quote = cb.quotePublishPayableDetailsFee(closedId);
    assertEq(quote, WORMHOLE_FEE * 2);
    assertEq(quote, cb.quoteBroadcastFee() * 2);
    _assertPublishRequiresExactly(closedId, quote, 2, true);
  }

  function test_QuotePublishPayableDetailsFee_OpenPayable_WormholeDisabled() public {
    vm.prank(owner);
    cb.setWormholeEnabled(false);
    uint256 quote = cb.quotePublishPayableDetailsFee(openId);
    assertEq(quote, 0);
    _assertPublishRequiresExactly(openId, quote, 1, false);
  }

  function test_QuotePublishPayableDetailsFee_ClosedPayable_WormholeDisabled() public {
    vm.prank(owner);
    cb.setWormholeEnabled(false);
    uint256 quote = cb.quotePublishPayableDetailsFee(closedId);
    assertEq(quote, 0);
    _assertPublishRequiresExactly(closedId, quote, 2, false);
  }

  function test_QuotePublishPayableDetailsFee_WormholeActiveWithZeroMessageFee() public {
    chainA.wormhole.setMessageFee(0);
    assertEq(cb.quotePublishPayableDetailsFee(openId), 0);
    assertEq(cb.quotePublishPayableDetailsFee(closedId), 0);
    _assertPublishRequiresExactly(openId, 0, 1, true);
    _assertPublishRequiresExactly(closedId, 0, 2, true);
  }

  function test_QuotePublishPayableDetailsFee_TracksWormholeFeeChange() public {
    chainA.wormhole.setMessageFee(0.007 ether);
    assertEq(cb.quotePublishPayableDetailsFee(openId), 0.007 ether);
    assertEq(cb.quotePublishPayableDetailsFee(closedId), 0.014 ether);
    _assertPublishRequiresExactly(openId, 0.007 ether, 1, true);
    _assertPublishRequiresExactly(closedId, 0.014 ether, 2, true);
  }

  function test_QuotePublishPayableDetailsFee_FollowsReopen() public {
    vm.deal(host, WORMHOLE_FEE);
    vm.prank(host);
    cb.reopenPayable{value: WORMHOLE_FEE}(closedId);
    uint256 quote = cb.quotePublishPayableDetailsFee(closedId);
    assertEq(quote, WORMHOLE_FEE);
    _assertPublishRequiresExactly(closedId, quote, 1, true);
  }

  function test_QuotePublishPayableDetailsFee_ClosedPayableReplaysAsClosedOnChainB() public {
    uint256 quote = cb.quotePublishPayableDetailsFee(closedId);
    uint256 before = chainA.wormhole.publishedCount();
    vm.deal(host, quote);
    vm.prank(host);
    cb.publishPayableDetails{value: quote}(closedId);
    assertEq(chainA.wormhole.publishedCount(), before + 2);

    // Chain B applies the snapshot and then the close, ending closed.
    chainB.cb.receivePayableUpdateViaWormhole(chainA.wormhole.vaaOf(before));
    assertFalse(chainB.cb.getForeignPayable(closedId).isClosed);
    chainB.cb.receivePayableUpdateViaWormhole(chainA.wormhole.vaaOf(before + 1));
    assertTrue(chainB.cb.getForeignPayable(closedId).isClosed);

    _fundUsdc(chainB, payer, AMOUNT);
    (bool isOk, bytes4 selector) = chainB.cb.canPayForeign(closedId, address(chainB.usdc), AMOUNT, 0);
    assertFalse(isOk);
    assertEq(selector, PayableIsClosed.selector);
    vm.expectRevert(PayableIsClosed.selector);
    vm.prank(payer);
    chainB.cb.payForeignViaCctp(closedId, address(chainB.usdc), AMOUNT, 0);
  }

  // ---------------------------------------------------------------------------
  // Helpers
  // ---------------------------------------------------------------------------

  function _assertCanPay(bytes32 id, address token, uint256 amount, bytes4 expected) internal view {
    (bool isOk, bytes4 selector) = cb.canPay(id, token, amount);
    assertEq(isOk, expected == bytes4(0), 'canPay success');
    assertEq(selector, expected, 'canPay selector');
  }

  function _assertCanPayForeign(bytes32 id, address token, uint256 amount, uint256 maxFee, bytes4 expected)
    internal
    view
  {
    (bool isOk, bytes4 selector) = cb.canPayForeign(id, token, amount, maxFee);
    assertEq(isOk, expected == bytes4(0), 'canPayForeign success');
    assertEq(selector, expected, 'canPayForeign selector');
  }

  function _assertCanWithdraw(bytes32 id, address caller, address token, uint256 amount, bytes4 expected)
    internal
    view
  {
    (bool isOk, bytes4 selector) = cb.canWithdraw(id, caller, token, amount);
    assertEq(isOk, expected == bytes4(0), 'canWithdraw success');
    assertEq(selector, expected, 'canWithdraw selector');
  }

  /// Pays with `maxAmountIn == amount` and the matching `msg.value`, returning success or the revert selector.
  function _tryPay(bytes32 id, address token, uint256 amount) internal returns (bool, bytes4) {
    uint256 value = token == native ? amount : 0;
    vm.prank(payer);
    try cb.pay{value: value}(id, token, amount, amount) {
      return (true, bytes4(0));
    } catch (bytes memory reason) {
      return (false, bytes4(reason));
    }
  }

  function _tryPayForeign(bytes32 id, address token, uint256 amount, uint256 maxFee) internal returns (bool, bytes4) {
    vm.prank(payer);
    try cb.payForeignViaCctp(id, token, amount, maxFee) {
      return (true, bytes4(0));
    } catch (bytes memory reason) {
      return (false, bytes4(reason));
    }
  }

  function _tryWithdraw(address caller, bytes32 id, address token, uint256 amount) internal returns (bool, bytes4) {
    vm.prank(caller);
    try cb.withdraw(id, token, amount) {
      return (true, bytes4(0));
    } catch (bytes memory reason) {
      return (false, bytes4(reason));
    }
  }

  /// Funds a fresh payable with `funded` of `token`, withdraws `amount`, and asserts the event, balances, and stored
  /// withdrawal match the quote taken just before.
  function _assertQuoteMatchesWithdraw(address token, uint256 funded, uint256 amount)
    internal
    returns (WithdrawalQuote memory quote)
  {
    bytes32 id = _createPayable(chainA, host, _anyToken(), false);
    if (token == native) {
      vm.deal(payer, funded);
      vm.prank(payer);
      cb.pay{value: funded}(id, native, funded, funded);
    } else {
      _fundUsdc(chainA, payer, funded);
      vm.prank(payer);
      cb.pay(id, token, funded, funded);
    }

    quote = cb.quoteWithdrawal(id, token, amount);
    assertEq(quote.amount, amount);
    assertEq(quote.fee + quote.net, amount);

    uint256 hostBefore = _balanceOf(token, host);
    uint256 collectorBefore = _balanceOf(token, feeCollector);
    uint256 diamondBefore = _balanceOf(token, address(cb));

    vm.recordLogs();
    vm.prank(host);
    bytes32 withdrawalId = cb.withdraw(id, token, amount);

    (bool isFound, uint256 eventAmount, uint256 eventFee) = _findWithdrew(id, withdrawalId);
    assertTrue(isFound, 'Withdrew not emitted');
    assertEq(eventAmount, amount, 'event amount');
    assertEq(eventFee, quote.fee, 'event fee');

    assertEq(_balanceOf(token, host) - hostBefore, quote.net, 'host delta');
    assertEq(_balanceOf(token, feeCollector) - collectorBefore, quote.fee, 'fee collector delta');
    assertEq(diamondBefore - _balanceOf(token, address(cb)), amount, 'diamond delta');
    assertEq(cb.getBalance(id, token), funded - amount, 'payable balance');
    assertEq(cb.getWithdrawal(withdrawalId).fee, quote.fee, 'stored fee');
    assertEq(cb.getWithdrawal(withdrawalId).amount, amount, 'stored amount');
  }

  /// Returns the amount and fee of the `Withdrew` event recorded for `withdrawalId`.
  function _findWithdrew(bytes32 id, bytes32 withdrawalId)
    internal
    returns (bool isFound, uint256 amount, uint256 fee)
  {
    VmSafe.Log[] memory logs = vm.getRecordedLogs();
    for (uint256 i; i < logs.length; i++) {
      VmSafe.Log memory log = logs[i];
      if (
        log.emitter == address(cb) && log.topics.length == 4 && log.topics[0] == Withdrew.selector
          && log.topics[1] == id && log.topics[2] == _toBytes32(host) && log.topics[3] == withdrawalId
      ) {
        (, amount, fee,,,) = abi.decode(log.data, (address, uint256, uint256, uint256, uint256, uint256));
        return (true, amount, fee);
      }
    }
  }

  /// Publishes `id` with `quote` and asserts that one wei more or less is rejected with the quoted expectation and
  /// that the exact quote sends `messages` Wormhole messages (when active) and CCTP update messages.
  function _assertPublishRequiresExactly(bytes32 id, uint256 quote, uint256 messages, bool isWormholeActive) internal {
    vm.deal(host, quote + 1);
    if (quote > 0) {
      vm.expectRevert(abi.encodeWithSelector(IncorrectWormholeFee.selector, quote - 1, quote));
      vm.prank(host);
      cb.publishPayableDetails{value: quote - 1}(id);
    }
    vm.expectRevert(abi.encodeWithSelector(IncorrectWormholeFee.selector, quote + 1, quote));
    vm.prank(host);
    cb.publishPayableDetails{value: quote + 1}(id);

    uint256 wormholeBefore = chainA.wormhole.publishedCount();
    uint256 cctpBefore = chainA.transmitter.sentCount();
    uint256 wormholeBalanceBefore = address(chainA.wormhole).balance;
    vm.prank(host);
    cb.publishPayableDetails{value: quote}(id);
    assertEq(chainA.wormhole.publishedCount(), wormholeBefore + (isWormholeActive ? messages : 0), 'wormhole messages');
    assertEq(chainA.transmitter.sentCount(), cctpBefore + messages, 'cctp messages');
    assertEq(address(chainA.wormhole).balance - wormholeBalanceBefore, quote, 'wormhole fee forwarded');
    assertEq(address(cb).balance, FUNDED_NATIVE, 'diamond keeps no fee');
  }

  function _balanceOf(address token, address account) internal view returns (uint256) {
    return token == native ? account.balance : MockERC20(token).balanceOf(account);
  }

  function _fundToken(MockERC20 token, address to) internal {
    token.mint(to, PAYER_USDC);
    vm.prank(to);
    token.approve(address(cb), type(uint256).max);
  }

  function _createForeignPayable(TokenAndAmount[] memory allowed) internal returns (bytes32 id) {
    id = _createPayable(chainB, foreignHost, allowed, false);
    cb.receivePayableUpdateViaWormhole(_lastVaa(chainB));
  }

  function _close(SimChain memory chain, bytes32 id) internal {
    address payableHost = chain.cbChainId == chainA.cbChainId ? host : foreignHost;
    vm.deal(payableHost, payableHost.balance + WORMHOLE_FEE);
    vm.prank(payableHost);
    chain.cb.closePayable{value: WORMHOLE_FEE}(id);
  }

  function _setLimits(address token, bool hasMin, uint256 min, bool hasMax, uint256 max) internal {
    vm.prank(owner);
    cb.setTokenPaymentLimits(
      token,
      TokenPaymentLimits({
        hasMinPaymentAmount: hasMin, minPaymentAmount: min, hasMaxPaymentAmount: hasMax, maxPaymentAmount: max
      })
    );
  }

  /// Mode 0 leaves no limits; 1 sets a 50e6 minimum; 2 sets a 150e6 maximum; 3 sets both.
  function _applyLimits(address token, uint8 mode) internal {
    mode %= 4;
    if (mode == 1) _setLimits(token, true, 50e6, false, 0);
    else if (mode == 2) _setLimits(token, false, 0, true, 150e6);
    else if (mode == 3) _setLimits(token, true, 50e6, true, 150e6);
  }

  /// Mode 0 pauses nothing; 1 pauses globally; 2 pauses `feature`; 3 pauses every other checked feature.
  function _applyPause(uint8 mode, uint256 feature) internal {
    mode %= 4;
    vm.startPrank(owner);
    if (mode == 1) cb.pause();
    else if (mode == 2) cb.pauseFeatures(feature);
    else if (mode == 3) cb.pauseFeatures((FEATURE_PAY | FEATURE_PAY_FOREIGN | FEATURE_WITHDRAW) & ~feature);
    vm.stopPrank();
  }

  function _setFeeCap(uint16 bps) internal {
    vm.prank(owner);
    cb.setForeignChainLimits(
      chainB.cbChainId, ForeignChainLimits({hasMaxOutboundCctpFeeBps: true, maxOutboundCctpFeeBps: bps})
    );
  }

  function _disableOutboundPayments() internal {
    vm.prank(owner);
    cb.setForeignChainSwitches(
      chainB.cbChainId,
      ForeignChainSwitches({
        isCctpUpdateEnabled: true,
        isInboundUpdateEnabled: true,
        isOutboundPaymentEnabled: false,
        isInboundPaymentEnabled: true
      })
    );
  }

  /// Clears `hasCircleDomain` of a registered chain in storage, leaving every other field (including the enabled
  /// outbound payment switch) intact.
  function _clearCircleDomainInStorage(bytes32 cbChainId) internal {
    // Layout: registeredChainIds (2 slots), then the `chains` mapping. ForeignChain: cbChainId, isRegistered,
    // registeredAt, then the packed protocol IDs (uint16 | bool | uint32 | bool), with `hasCircleDomain` in byte 7.
    bytes32 chainSlot = keccak256(abi.encode(cbChainId, uint256(CHAINS_STORAGE_SLOT) + 2));
    bytes32 protocolIdsSlot = bytes32(uint256(chainSlot) + 3);
    uint256 packed = uint256(vm.load(address(cb), protocolIdsSlot));
    vm.store(address(cb), protocolIdsSlot, bytes32(packed & ~(uint256(0xff) << 56)));

    ForeignChain memory chain = cb.getForeignChain(cbChainId);
    assertFalse(chain.config.protocolIds.hasCircleDomain);
    assertTrue(chain.config.protocolIds.hasWormholeChainId);
    assertEq(chain.config.protocolIds.wormholeChainId, chainB.wormholeChainId);
    assertEq(chain.config.protocolIds.circleDomain, chainB.circleDomain);
    assertTrue(chain.config.switches.isOutboundPaymentEnabled);
    assertTrue(chain.isRegistered);
  }
}
