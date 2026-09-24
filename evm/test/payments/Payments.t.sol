// SPDX-License-Identifier: Apache 2
pragma solidity ^0.8.30;

import {ERC20} from '@openzeppelin/contracts/token/ERC20/ERC20.sol';
import {FEATURE_AUTO_WITHDRAW, FEATURE_PAY} from 'src/types/CbConstants.sol';
import {TokenAndAmount, TokenPaymentLimits} from 'src/types/CbTypes.sol';
import {CbTestBase} from '../base/CbTestBase.sol';
import {MockTaxToken} from '../mocks/MockTaxToken.sol';
import {RejectEth} from '../mocks/RejectEth.sol';

/// ERC-20 whose `transferFrom` delivers more than requested, used to exercise the defensive
/// "unexpected amount received" check on non-transfer-tax tokens.
contract MockOverpayToken is ERC20 {
  constructor() ERC20('Overpay', 'OVP') {}

  function mint(address to, uint256 amount) external {
    _mint(to, amount);
  }

  function transferFrom(address from, address to, uint256 amount) public override returns (bool) {
    bool ok = super.transferFrom(from, to, amount);
    _mint(to, 1);
    return ok;
  }
}

contract PaymentsTest is CbTestBase {
  bytes32 internal payableId;
  bytes32 internal payableIdUsdc;

  function setUp() public override {
    super.setUp();
    vm.deal(host, 10 ether);
    payableId = _createPayableDirect(host, _anyToken(), false);
    payableIdUsdc = _createPayableDirect(host, _only(address(usdc), 100e6), false);
    _fundUsdc(chainA, payer, 1_000e6);
    vm.deal(payer, 100 ether);
  }

  // ---------------------------------------------------------------------------
  // Native payments
  // ---------------------------------------------------------------------------

  function test_Pay_Native_CreditsPayableAndEmits() public {
    // The user payment ID is generated on chain and unknown ahead of time.
    vm.expectEmit(true, true, false, true, address(cb));
    emit UserPaid(payableId, payer, bytes32(0), chainA.cbChainId, native, 1 ether, 1 ether, 1, 1);
    vm.prank(payer);
    cb.pay{value: 1 ether}(payableId, native, 1 ether, 1 ether);
    assertEq(address(cb).balance, 1 ether);
  }

  function test_RevertWhen_Pay_Native_IncorrectValue() public {
    vm.expectRevert(abi.encodeWithSelector(IncorrectNativeValue.selector, 0.5 ether, 1 ether));
    vm.prank(payer);
    cb.pay{value: 0.5 ether}(payableId, native, 1 ether, 1 ether);
  }

  function test_RevertWhen_Pay_Native_MaxAmountInMismatch() public {
    // A buffer above `amount` requires transfer-tax allowance even for the native token; grant it so the native
    // branch's own `maxAmountIn == amount` check is what fires.
    vm.prank(owner);
    cb.setTokenTransferTaxAllowed(native, true);
    vm.expectRevert(abi.encodeWithSelector(IncorrectNativeValue.selector, 1 ether, 1 ether));
    vm.prank(payer);
    cb.pay{value: 1 ether}(payableId, native, 1 ether, 2 ether);
  }

  // ---------------------------------------------------------------------------
  // ERC-20 payments
  // ---------------------------------------------------------------------------

  function test_Pay_Erc20_CreditsPayableAndEmits() public {
    // The payable payment ID is generated on chain and unknown ahead of time.
    vm.expectEmit(true, true, false, true, address(cb));
    emit PayableReceived(
      payableIdUsdc, _toBytes32(payer), bytes32(0), chainA.cbChainId, address(usdc), 100e6, 100e6, 1, 1
    );
    vm.prank(payer);
    cb.pay(payableIdUsdc, address(usdc), 100e6, 100e6);
    assertEq(usdc.balanceOf(address(cb)), 100e6);
  }

  function test_RevertWhen_Pay_Erc20_NonZeroNativeValue() public {
    vm.expectRevert(abi.encodeWithSelector(IncorrectNativeValue.selector, 1, 0));
    vm.prank(payer);
    cb.pay{value: 1}(payableIdUsdc, address(usdc), 100e6, 100e6);
  }

  // ---------------------------------------------------------------------------
  // Shared checks
  // ---------------------------------------------------------------------------

  function test_RevertWhen_Pay_InvalidTokenAddress() public {
    vm.expectRevert(InvalidTokenAddress.selector);
    vm.prank(payer);
    cb.pay(payableId, address(0), 1, 1);
  }

  function test_RevertWhen_Pay_UnsupportedToken() public {
    address unsupported = makeAddr('unsupported');
    vm.expectRevert(abi.encodeWithSelector(UnsupportedToken.selector, unsupported));
    vm.prank(payer);
    cb.pay(payableId, unsupported, 1, 1);
  }

  function test_RevertWhen_Pay_ZeroAmountSpecified() public {
    vm.expectRevert(ZeroAmountSpecified.selector);
    vm.prank(payer);
    cb.pay(payableId, address(usdc), 0, 0);
  }

  function test_RevertWhen_Pay_PaymentBelowMinimum() public {
    vm.prank(owner);
    cb.setTokenPaymentLimits(address(usdc), TokenPaymentLimits(true, 50e6, false, 0));
    vm.expectRevert(abi.encodeWithSelector(PaymentBelowMinimum.selector, 10e6, 50e6));
    vm.prank(payer);
    cb.pay(payableId, address(usdc), 10e6, 10e6);
  }

  function test_RevertWhen_Pay_PaymentAboveMaximum() public {
    vm.prank(owner);
    cb.setTokenPaymentLimits(address(usdc), TokenPaymentLimits(false, 0, true, 50e6));
    vm.expectRevert(abi.encodeWithSelector(PaymentAboveMaximum.selector, 100e6, 50e6));
    vm.prank(payer);
    cb.pay(payableId, address(usdc), 100e6, 100e6);
  }

  function test_RevertWhen_Pay_InvalidPayableId() public {
    vm.expectRevert(InvalidPayableId.selector);
    vm.prank(payer);
    cb.pay(bytes32('nope'), address(usdc), 1, 1);
  }

  function test_RevertWhen_Pay_PayableIsClosed() public {
    vm.prank(host);
    cb.closePayable{value: WORMHOLE_FEE}(payableId);
    vm.expectRevert(PayableIsClosed.selector);
    vm.prank(payer);
    cb.pay(payableId, address(usdc), 1e6, 1e6);
  }

  function test_RevertWhen_Pay_MatchingTokenAndAmountNotFound() public {
    vm.expectRevert(MatchingTokenAndAmountNotFound.selector);
    vm.prank(payer);
    cb.pay(payableIdUsdc, address(usdc), 50e6, 50e6);
  }

  function test_Pay_AnyTokenAllowed_WhenPayableHasNoRestriction() public {
    vm.prank(payer);
    cb.pay(payableId, address(usdc), 42e6, 42e6);
  }

  function test_RevertWhen_Pay_InvalidMaxAmountIn() public {
    vm.expectRevert(abi.encodeWithSelector(InvalidMaxAmountIn.selector, 50e6, 100e6));
    vm.prank(payer);
    cb.pay(payableId, address(usdc), 100e6, 50e6);
  }

  function test_RevertWhen_Pay_TransferTaxNotAllowed() public {
    vm.expectRevert(abi.encodeWithSelector(TransferTaxNotAllowed.selector, address(usdc)));
    vm.prank(payer);
    cb.pay(payableId, address(usdc), 100e6, 110e6);
  }

  function test_RevertWhen_Pay_Paused() public {
    vm.prank(owner);
    cb.pauseFeatures(FEATURE_PAY);
    vm.expectRevert(abi.encodeWithSelector(FeaturePaused.selector, FEATURE_PAY));
    vm.prank(payer);
    cb.pay(payableId, address(usdc), 1e6, 1e6);
  }

  // ---------------------------------------------------------------------------
  // Transfer-tax tokens
  // ---------------------------------------------------------------------------

  function test_Pay_TransferTaxToken_CreditsReceivedAmount() public {
    MockTaxToken tax = new MockTaxToken(500); // 5%
    vm.startPrank(owner);
    cb.allowPaymentsForToken(address(tax));
    cb.setTokenTransferTaxAllowed(address(tax), true);
    vm.stopPrank();
    tax.mint(payer, 1000e18);
    vm.prank(payer);
    tax.approve(address(cb), type(uint256).max);

    // Requesting 100, offering a 110 buffer; the 5% tax applies to the 110 pulled, leaving 104.5 net.
    vm.prank(payer);
    cb.pay(payableId, address(tax), 100e18, 110e18);
    assertEq(tax.balanceOf(address(cb)), 104.5e18);
  }

  function test_RevertWhen_Pay_TransferTaxExceededBuffer() public {
    MockTaxToken tax = new MockTaxToken(2000); // 20%: buffer cannot cover the tax.
    vm.startPrank(owner);
    cb.allowPaymentsForToken(address(tax));
    cb.setTokenTransferTaxAllowed(address(tax), true);
    vm.stopPrank();
    tax.mint(payer, 1000e18);
    vm.prank(payer);
    tax.approve(address(cb), type(uint256).max);

    vm.expectRevert(abi.encodeWithSelector(TransferTaxExceededBuffer.selector, 88e18, 100e18));
    vm.prank(payer);
    cb.pay(payableId, address(tax), 100e18, 110e18);
  }

  function test_RevertWhen_Pay_UnexpectedAmountReceived() public {
    MockOverpayToken overpay = new MockOverpayToken();
    vm.prank(owner);
    cb.allowPaymentsForToken(address(overpay));
    overpay.mint(payer, 1000e18);
    vm.prank(payer);
    overpay.approve(address(cb), type(uint256).max);

    vm.expectRevert(abi.encodeWithSelector(UnexpectedAmountReceived.selector, 100e18 + 1, 100e18));
    vm.prank(payer);
    cb.pay(payableId, address(overpay), 100e18, 100e18);
  }

  // ---------------------------------------------------------------------------
  // Auto-withdraw
  // ---------------------------------------------------------------------------

  function test_Pay_AutoWithdraw_SendsNetToHostImmediately() public {
    bytes32 autoPayableId = _createPayableDirect(host, _anyToken(), true);
    uint256 hostBalanceBefore = host.balance;
    uint256 feeCollectorBalanceBefore = feeCollector.balance;

    vm.prank(payer);
    cb.pay{value: 1 ether}(autoPayableId, native, 1 ether, 1 ether);

    uint256 fee = (uint256(1 ether) * uint256(DEFAULT_FEE_BPS)) / 10_000;
    assertEq(host.balance, hostBalanceBefore + 1 ether - fee);
    assertEq(feeCollector.balance, feeCollectorBalanceBefore + fee);
    assertEq(address(cb).balance, 0);
  }

  function test_Pay_AutoWithdraw_SkipsWhenFeaturePaused() public {
    bytes32 autoPayableId = _createPayableDirect(host, _anyToken(), true);
    vm.prank(owner);
    cb.pauseFeatures(FEATURE_AUTO_WITHDRAW);

    vm.expectEmit(true, true, true, true, address(cb));
    emit AutoWithdrawSkipped(autoPayableId, native, 1 ether);
    vm.prank(payer);
    cb.pay{value: 1 ether}(autoPayableId, native, 1 ether, 1 ether);
    assertEq(address(cb).balance, 1 ether);
  }

  function test_RevertWhen_Pay_AutoWithdraw_HostRejectsNative() public {
    RejectEth rejectingHost = new RejectEth();
    vm.deal(address(rejectingHost), WORMHOLE_FEE);
    bytes memory createCall = abi.encodeCall(cb.createPayable, (_anyToken(), true));
    bytes memory result = rejectingHost.execute{value: WORMHOLE_FEE}(address(cb), createCall);
    (bytes32 autoPayableId,) = abi.decode(result, (bytes32, uint64));

    uint256 fee = (uint256(1 ether) * uint256(DEFAULT_FEE_BPS)) / 10_000;
    vm.expectRevert(abi.encodeWithSelector(NativeTransferFailed.selector, address(rejectingHost), 1 ether - fee));
    vm.prank(payer);
    cb.pay{value: 1 ether}(autoPayableId, native, 1 ether, 1 ether);
  }

  // ---------------------------------------------------------------------------
  // Helpers
  // ---------------------------------------------------------------------------

  function _createPayableDirect(address host_, TokenAndAmount[] memory allowed, bool isAutoWithdraw)
    internal
    returns (bytes32 id)
  {
    vm.deal(host_, host_.balance + WORMHOLE_FEE);
    vm.prank(host_);
    (id,) = cb.createPayable{value: WORMHOLE_FEE}(allowed, isAutoWithdraw);
  }
}
