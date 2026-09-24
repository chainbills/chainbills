// SPDX-License-Identifier: Apache 2
pragma solidity ^0.8.30;

import {FEATURE_WITHDRAW} from 'src/types/CbConstants.sol';
import {RESCUER_ROLE} from 'src/types/CbRoles.sol';
import {TokenAndAmount, TokenFeeConfig} from 'src/types/CbTypes.sol';
import {CbTestBase} from '../base/CbTestBase.sol';

contract WithdrawalsTest is CbTestBase {
  bytes32 internal payableId;

  function setUp() public override {
    super.setUp();
    vm.deal(host, 10 ether);
    vm.prank(host);
    (payableId,) = cb.createPayable{value: WORMHOLE_FEE}(_anyToken(), false);
    vm.deal(payer, 100 ether);
    _fundUsdc(chainA, payer, 1_000e6);
  }

  function _payNative(uint256 amount) internal {
    vm.prank(payer);
    cb.pay{value: amount}(payableId, native, amount, amount);
  }

  function _payUsdc(uint256 amount) internal {
    vm.prank(payer);
    cb.pay(payableId, address(usdc), amount, amount);
  }

  // ---------------------------------------------------------------------------
  // withdraw
  // ---------------------------------------------------------------------------

  function test_Withdraw_Native_PaysHostAndFeeCollector() public {
    _payNative(1 ether);
    uint256 hostBefore = host.balance;
    uint256 feeCollectorBefore = feeCollector.balance;
    uint256 fee = (uint256(1 ether) * uint256(DEFAULT_FEE_BPS)) / 10_000;

    vm.expectEmit(true, true, false, true, address(cb));
    emit Withdrew(payableId, host, bytes32(0), native, 1 ether, fee, 1, 1, 1);
    vm.prank(host);
    cb.withdraw(payableId, native, 1 ether);

    assertEq(host.balance, hostBefore + 1 ether - fee);
    assertEq(feeCollector.balance, feeCollectorBefore + fee);
    assertEq(address(cb).balance, 0);
  }

  function test_Withdraw_Erc20_PaysHostAndFeeCollector() public {
    _payUsdc(100e6);
    uint256 fee = (uint256(100e6) * uint256(DEFAULT_FEE_BPS)) / 10_000;
    vm.prank(host);
    cb.withdraw(payableId, address(usdc), 100e6);
    assertEq(usdc.balanceOf(host), 100e6 - fee);
    assertEq(usdc.balanceOf(feeCollector), fee);
  }

  function test_RevertWhen_Withdraw_InvalidPayableId() public {
    vm.expectRevert(InvalidPayableId.selector);
    vm.prank(host);
    cb.withdraw(bytes32('nope'), native, 1);
  }

  function test_RevertWhen_Withdraw_NotYourPayable() public {
    _payNative(1 ether);
    vm.expectRevert(NotYourPayable.selector);
    vm.prank(stranger);
    cb.withdraw(payableId, native, 1 ether);
  }

  function test_RevertWhen_Withdraw_ZeroAmount() public {
    _payNative(1 ether);
    vm.expectRevert(ZeroAmountSpecified.selector);
    vm.prank(host);
    cb.withdraw(payableId, native, 0);
  }

  function test_RevertWhen_Withdraw_NoBalanceForToken() public {
    vm.expectRevert(NoBalanceForWithdrawalToken.selector);
    vm.prank(host);
    cb.withdraw(payableId, address(usdc), 1);
  }

  function test_RevertWhen_Withdraw_InsufficientBalance() public {
    _payNative(1 ether);
    vm.expectRevert(abi.encodeWithSelector(InsufficientWithdrawAmount.selector, 1 ether, 2 ether));
    vm.prank(host);
    cb.withdraw(payableId, native, 2 ether);
  }

  function test_RevertWhen_Withdraw_Paused() public {
    _payNative(1 ether);
    vm.prank(owner);
    cb.pauseFeatures(FEATURE_WITHDRAW);
    vm.expectRevert(abi.encodeWithSelector(FeaturePaused.selector, FEATURE_WITHDRAW));
    vm.prank(host);
    cb.withdraw(payableId, native, 1 ether);
  }

  // ---------------------------------------------------------------------------
  // withdrawAll
  // ---------------------------------------------------------------------------

  function test_WithdrawAll_WithdrawsFullBalance() public {
    _payNative(1 ether);
    _payNative(0.5 ether);
    vm.prank(host);
    cb.withdrawAll(payableId, native);
    assertEq(address(cb).balance, 0);
  }

  function test_RevertWhen_WithdrawAll_NoBalance() public {
    vm.expectRevert(NoBalanceForWithdrawalToken.selector);
    vm.prank(host);
    cb.withdrawAll(payableId, native);
  }

  function test_RevertWhen_WithdrawAll_NotYourPayable() public {
    _payNative(1 ether);
    vm.expectRevert(NotYourPayable.selector);
    vm.prank(stranger);
    cb.withdrawAll(payableId, native);
  }

  function test_RevertWhen_WithdrawAll_InvalidPayableId() public {
    vm.expectRevert(InvalidPayableId.selector);
    vm.prank(host);
    cb.withdrawAll(bytes32('nope'), native);
  }

  // ---------------------------------------------------------------------------
  // Fee math
  // ---------------------------------------------------------------------------

  function test_Withdraw_FeeOverrideBps_AppliesInsteadOfGlobal() public {
    vm.prank(owner);
    cb.setTokenFeeBps(address(usdc), 1000); // 10%, overriding the 2% global default.
    _payUsdc(100e6);
    vm.prank(host);
    cb.withdraw(payableId, address(usdc), 100e6);
    assertEq(usdc.balanceOf(host), 90e6);
    assertEq(usdc.balanceOf(feeCollector), 10e6);
  }

  function test_Withdraw_FeeOverrideZero_SkipsTransfer() public {
    vm.prank(owner);
    cb.setTokenFeeBps(address(usdc), 0);
    _payUsdc(100e6);
    vm.prank(host);
    cb.withdraw(payableId, address(usdc), 100e6);
    assertEq(usdc.balanceOf(host), 100e6);
    assertEq(usdc.balanceOf(feeCollector), 0);
  }

  function test_Withdraw_FeeCap_ReducesFee() public {
    vm.prank(owner);
    cb.setTokenMaxWithdrawalFee(address(usdc), 1e6); // 2% of 100e6 would be 2e6; cap it at 1e6.
    _payUsdc(100e6);
    vm.prank(host);
    cb.withdraw(payableId, address(usdc), 100e6);
    assertEq(usdc.balanceOf(host), 99e6);
    assertEq(usdc.balanceOf(feeCollector), 1e6);
  }

  function test_Withdraw_FeeCapCleared_RestoresPercentage() public {
    vm.startPrank(owner);
    cb.setTokenMaxWithdrawalFee(address(usdc), 1e6);
    cb.clearTokenMaxWithdrawalFee(address(usdc));
    vm.stopPrank();
    _payUsdc(100e6);
    uint256 fee = (uint256(100e6) * uint256(DEFAULT_FEE_BPS)) / 10_000;
    vm.prank(host);
    cb.withdraw(payableId, address(usdc), 100e6);
    assertEq(usdc.balanceOf(feeCollector), fee);
  }

  function test_Withdraw_FeeCapZero_MakesWithdrawalFree() public {
    vm.prank(owner);
    cb.setTokenMaxWithdrawalFee(address(usdc), 0);
    _payUsdc(100e6);
    vm.prank(host);
    cb.withdraw(payableId, address(usdc), 100e6);
    assertEq(usdc.balanceOf(host), 100e6);
    assertEq(usdc.balanceOf(feeCollector), 0);
  }

  // ---------------------------------------------------------------------------
  // Rescue
  // ---------------------------------------------------------------------------

  function test_RescueUntrackedBalance_MovesOnlyExcess() public {
    _payUsdc(100e6);
    // Send untracked USDC directly to the diamond, bypassing `pay`.
    usdc.mint(address(cb), 5e6);
    address to = makeAddr('rescue-target');

    vm.expectEmit(true, true, true, true, address(cb));
    emit UntrackedBalanceRescued(address(usdc), to, 5e6);
    vm.prank(owner);
    uint256 rescued = cb.rescueUntrackedBalance(address(usdc), to);
    assertEq(rescued, 5e6);
    assertEq(usdc.balanceOf(to), 5e6);
    // The tracked payable balance is untouched.
    assertEq(usdc.balanceOf(address(cb)), 100e6);
  }

  function test_RevertWhen_RescueUntrackedBalance_Nothing() public {
    _payUsdc(100e6);
    vm.expectRevert(abi.encodeWithSelector(NothingToRescue.selector, address(usdc)));
    vm.prank(owner);
    cb.rescueUntrackedBalance(address(usdc), makeAddr('rescue-target'));
  }

  function test_RevertWhen_RescueUntrackedBalance_ZeroRecipient() public {
    usdc.mint(address(cb), 1e6);
    vm.expectRevert(InvalidAddress.selector);
    vm.prank(owner);
    cb.rescueUntrackedBalance(address(usdc), address(0));
  }

  function test_RevertWhen_RescueUntrackedBalance_CallerLacksRescuerRole() public {
    usdc.mint(address(cb), 1e6);
    vm.expectRevert(abi.encodeWithSelector(AccessControlUnauthorizedAccount.selector, stranger, RESCUER_ROLE));
    vm.prank(stranger);
    cb.rescueUntrackedBalance(address(usdc), makeAddr('rescue-target'));
  }

  function test_RescueUntrackedBalance_NeverMovesPayableFunds() public {
    _payUsdc(100e6);
    // No untracked balance exists; rescuing must revert rather than touch the payable's funds.
    vm.expectRevert(abi.encodeWithSelector(NothingToRescue.selector, address(usdc)));
    vm.prank(owner);
    cb.rescueUntrackedBalance(address(usdc), makeAddr('rescue-target'));
    assertEq(usdc.balanceOf(address(cb)), 100e6);
  }

  // ---------------------------------------------------------------------------
  // Fuzz
  // ---------------------------------------------------------------------------

  function testFuzz_Withdraw_ConservesBalance(uint256 amount, uint16 feeBps) public {
    amount = bound(amount, 1, 1_000_000e6);
    feeBps = uint16(bound(feeBps, 0, 10_000));
    vm.prank(owner);
    cb.setTokenFeeBps(address(usdc), feeBps);
    usdc.mint(payer, amount);
    vm.prank(payer);
    usdc.approve(address(cb), amount);
    vm.prank(payer);
    cb.pay(payableId, address(usdc), amount, amount);

    uint256 expectedFee = (amount * feeBps) / 10_000;
    vm.prank(host);
    cb.withdraw(payableId, address(usdc), amount);

    assertEq(usdc.balanceOf(host), amount - expectedFee);
    assertEq(usdc.balanceOf(feeCollector), expectedFee);
    assertEq(usdc.balanceOf(address(cb)), 0);
  }
}
