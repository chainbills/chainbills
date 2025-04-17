// SPDX-License-Identifier: Apache 2
pragma solidity ^0.8.20;

import '@openzeppelin/contracts/token/ERC20/ERC20.sol';
import '@openzeppelin/contracts-upgradeable/access/OwnableUpgradeable.sol';
import '@openzeppelin/contracts/proxy/ERC1967/ERC1967Proxy.sol';
import 'forge-std/Test.sol';
import 'src/Chainbills.sol';

contract USDC is ERC20 {
  constructor() ERC20('USDC', 'USDC') {}

  function decimals() public view virtual override returns (uint8) {
    return 6;
  }
}

contract CbPayablesManagementTest is CbStructs, Test {
  Chainbills chainbills;
  USDC usdc;

  address owner = makeAddr('owner');
  address user = makeAddr('user');
  address feeCollector = makeAddr('fee-collector');

  uint256 ethAmt = 1e16; // 0.01 ETH
  uint16 feePercent = 200; // 2% (with 2 decimals)
  uint256 maxWtdlFeeEth = 5e17; // 0.5 ETH
  uint256 maxWtdlFeeUsdc = 2e8; // 200 USDC
  uint256 usdcAmt = 1e8; // 100 USDC

  function setUp() public {
    vm.startPrank(owner);
    chainbills = Chainbills(payable(address(new ERC1967Proxy(address(new Chainbills()), ''))));
    usdc = new USDC();

    chainbills.initialize(feeCollector, feePercent);
    chainbills.setPayablesLogic(address(new CbPayables()));
    chainbills.setTransactionsLogic(address(new CbTransactions()));

    chainbills.allowPaymentsForToken(address(chainbills));
    chainbills.updateMaxWithdrawalFees(address(chainbills), maxWtdlFeeEth);

    chainbills.allowPaymentsForToken(address(usdc));
    chainbills.updateMaxWithdrawalFees(address(usdc), maxWtdlFeeUsdc);
    vm.stopPrank();

    deal(user, ethAmt * 5);
    deal(address(usdc), user, usdcAmt * 5);
    vm.prank(user);
    usdc.approve(address(chainbills), usdcAmt * 5);
  }

  function testRevertingPayableCreation() public {
    vm.startPrank(user);
    // Invalid Token in Token and Amounts
    TokenAndAmount[] memory invalidTokenAtaa = new TokenAndAmount[](1);
    invalidTokenAtaa[0] = TokenAndAmount({token: address(0), amount: ethAmt});
    vm.expectRevert(InvalidTokenAddress.selector);
    chainbills.createPayable(invalidTokenAtaa, false);

    // Unsupported Token in Token and Amounts
    TokenAndAmount[] memory unsupportedTokenAtaa = new TokenAndAmount[](1);
    unsupportedTokenAtaa[0] = TokenAndAmount({token: makeAddr('unsupported'), amount: ethAmt});
    vm.startPrank(user);
    vm.expectRevert(UnsupportedToken.selector);
    chainbills.createPayable(unsupportedTokenAtaa, false);

    // Zero amount for amount
    TokenAndAmount[] memory zeroAmount = new TokenAndAmount[](1);
    zeroAmount[0] = TokenAndAmount({token: address(usdc), amount: 0});
    vm.expectRevert(ZeroAmountSpecified.selector);
    chainbills.createPayable(zeroAmount, false);
    vm.stopPrank();
  }

  function testSuccessfulPayableCreation() public {
    // Create payable with free payments
    vm.startPrank(user);
    vm.expectEmit(false, true, false, true);
    emit CreatedPayable(bytes32(0), user, 1, 1);
    (bytes32 payableId1,) = chainbills.createPayable(new TokenAndAmount[](0), false);

    // Create payable with specific token amounts
    TokenAndAmount[] memory ataa = new TokenAndAmount[](2);
    ataa[0] = TokenAndAmount({token: address(chainbills), amount: ethAmt});
    ataa[1] = TokenAndAmount({token: address(usdc), amount: usdcAmt});

    vm.expectEmit(false, true, false, true);
    emit CreatedPayable(bytes32(0), user, 2, 2);
    (bytes32 payableId2,) = chainbills.createPayable(ataa, false);
    vm.stopPrank();

    // Verify payable data
    Payable memory p1 = chainbills.getPayable(payableId1);
    assertEq(p1.host, user);
    assertEq(p1.chainCount, 1);
    assertEq(p1.hostCount, 1);
    assertEq(p1.isClosed, false);
    assertEq(p1.isAutoWithdraw, false);
    assertEq(p1.allowedTokensAndAmountsCount, 0);
    assertEq(p1.balancesCount, 0);
    assertEq(p1.paymentsCount, 0);
    assertEq(p1.withdrawalsCount, 0);
    assertEq(p1.activitiesCount, 1);

    Payable memory p2 = chainbills.getPayable(payableId2);
    assertEq(p2.host, user);
    assertEq(p2.chainCount, 2);
    assertEq(p2.hostCount, 2);
    assertEq(p2.isClosed, false);
    assertEq(p2.isAutoWithdraw, false);
    assertEq(p2.allowedTokensAndAmountsCount, 2);
    assertEq(p2.balancesCount, 0);
    assertEq(p2.paymentsCount, 0);
    assertEq(p2.withdrawalsCount, 0);
    assertEq(p2.activitiesCount, 1);
  }

  function testRevertingUpdatePayable() public {
    // Create a payable
    vm.startPrank(user);
    (bytes32 payableId,) = chainbills.createPayable(new TokenAndAmount[](0), false);
    vm.stopPrank();

    // Test not your payable
    vm.startPrank(makeAddr('other-user'));
    vm.expectRevert(NotYourPayable.selector);
    chainbills.closePayable(payableId);
    vm.expectRevert(NotYourPayable.selector);
    chainbills.reopenPayable(payableId);
    vm.expectRevert(NotYourPayable.selector);
    chainbills.updatePayableAllowedTokensAndAmounts(payableId, new TokenAndAmount[](0));
    vm.expectRevert(NotYourPayable.selector);
    chainbills.updatePayableAutoWithdraw(payableId, true);
    vm.stopPrank();

    // Test closing closed payable
    vm.startPrank(user);
    chainbills.closePayable(payableId);
    vm.expectRevert(PayableIsAlreadyClosed.selector);
    chainbills.closePayable(payableId);

    // Test reopening open payable
    chainbills.reopenPayable(payableId);
    vm.expectRevert(PayableIsNotClosed.selector);
    chainbills.reopenPayable(payableId);

    // Test invalid token in update
    TokenAndAmount[] memory invalidTokenAtaa = new TokenAndAmount[](1);
    invalidTokenAtaa[0] = TokenAndAmount({token: address(0), amount: ethAmt});
    vm.expectRevert(InvalidTokenAddress.selector);
    chainbills.updatePayableAllowedTokensAndAmounts(payableId, invalidTokenAtaa);

    // Test unsupported token in update
    TokenAndAmount[] memory unsupportedTokenAtaa = new TokenAndAmount[](1);
    unsupportedTokenAtaa[0] = TokenAndAmount({token: makeAddr('unsupported'), amount: ethAmt});
    vm.expectRevert(UnsupportedToken.selector);
    chainbills.updatePayableAllowedTokensAndAmounts(payableId, unsupportedTokenAtaa);

    // Test zero amount in update
    TokenAndAmount[] memory zeroAmountAtaa = new TokenAndAmount[](1);
    zeroAmountAtaa[0] = TokenAndAmount({token: address(usdc), amount: 0});
    vm.expectRevert(ZeroAmountSpecified.selector);
    chainbills.updatePayableAllowedTokensAndAmounts(payableId, zeroAmountAtaa);
    vm.stopPrank();
  }

  function testSuccessfulUpdatePayableCloseAndReopen() public {
    // Create payable with specific token amounts
    vm.startPrank(user);
    TokenAndAmount[] memory ataa = new TokenAndAmount[](2);
    ataa[1] = TokenAndAmount({token: address(chainbills), amount: ethAmt});
    ataa[0] = TokenAndAmount({token: address(usdc), amount: usdcAmt});
    (bytes32 payableId,) = chainbills.createPayable(ataa, false);

    // Make payment with native token and confirm success
    vm.expectEmit(true, true, false, true);
    emit PayableReceived(payableId, toWormholeFormat(user), bytes32(0), 0, 1, 1);
    chainbills.pay{value: ethAmt}(payableId, address(chainbills), ethAmt);

    // Close payable
    vm.expectEmit(true, true, true, true);
    emit ClosedPayable(payableId, user);
    chainbills.closePayable(payableId);

    // Verify payable is closed
    assertTrue(chainbills.getPayable(payableId).isClosed);

    // Try to make payment with native token when closed and confirm revert
    vm.expectRevert(PayableIsClosed.selector);
    chainbills.pay{value: ethAmt}(payableId, address(chainbills), ethAmt);

    // Try to make payment with erc20 token when closed and confirm revert
    vm.expectRevert(PayableIsClosed.selector);
    chainbills.pay(payableId, address(usdc), usdcAmt);

    // Reopen payable
    vm.expectEmit(true, true, true, true);
    emit ReopenedPayable(payableId, user);
    chainbills.reopenPayable(payableId);

    // Verify payable is open
    assertFalse(chainbills.getPayable(payableId).isClosed);

    // Make payment with ERC20 and confirm success
    vm.expectEmit(true, true, false, true);
    emit PayableReceived(payableId, toWormholeFormat(user), bytes32(0), 0, 2, 2);
    chainbills.pay(payableId, address(usdc), usdcAmt);
    vm.stopPrank();
  }

  function testSuccessfulUpdatePayableATAA() public {
    // Create payable with free payments
    vm.startPrank(user);
    (bytes32 payableId,) = chainbills.createPayable(new TokenAndAmount[](0), false);

    // Make payments with native and ERC20 in flexible amounts
    vm.expectEmit(true, true, false, true);
    emit PayableReceived(payableId, toWormholeFormat(user), bytes32(0), 0, 1, 1);
    chainbills.pay{value: ethAmt * 2}(payableId, address(chainbills), ethAmt * 2);

    vm.expectEmit(true, true, false, true);
    emit PayableReceived(payableId, toWormholeFormat(user), bytes32(0), 0, 2, 2);
    chainbills.pay(payableId, address(usdc), usdcAmt * 2);

    // Update payable to enforce tokens and amounts
    TokenAndAmount[] memory ataa = new TokenAndAmount[](2);
    ataa[0] = TokenAndAmount({token: address(chainbills), amount: ethAmt});
    ataa[1] = TokenAndAmount({token: address(usdc), amount: usdcAmt});

    vm.expectEmit(true, true, true, true);
    emit UpdatedPayableAllowedTokensAndAmounts(payableId, user);
    chainbills.updatePayableAllowedTokensAndAmounts(payableId, ataa);

    // Verify payable data
    assertEq(chainbills.getPayable(payableId).allowedTokensAndAmountsCount, 2);

    // Try to make payments with unmatching amounts and confirm reverts
    vm.expectRevert(MatchingTokenAndAmountNotFound.selector);
    chainbills.pay{value: ethAmt * 2}(payableId, address(chainbills), ethAmt * 2);

    vm.expectRevert(MatchingTokenAndAmountNotFound.selector);
    chainbills.pay(payableId, address(usdc), usdcAmt * 2);

    // Make payments with enforced amounts and confirm success
    vm.expectEmit(true, true, false, true);
    emit PayableReceived(payableId, toWormholeFormat(user), bytes32(0), 0, 3, 3);
    chainbills.pay{value: ethAmt}(payableId, address(chainbills), ethAmt);

    vm.expectEmit(true, true, false, true);
    emit PayableReceived(payableId, toWormholeFormat(user), bytes32(0), 0, 4, 4);
    chainbills.pay(payableId, address(usdc), usdcAmt);

    // Update payable back to free payments
    vm.expectEmit(true, true, true, true);
    emit UpdatedPayableAllowedTokensAndAmounts(payableId, user);
    chainbills.updatePayableAllowedTokensAndAmounts(payableId, new TokenAndAmount[](0));

    // Verify payable data
    assertEq(chainbills.getPayable(payableId).allowedTokensAndAmountsCount, 0);

    // Make payments with any amounts and confirm success
    vm.expectEmit(true, true, false, true);
    emit PayableReceived(payableId, toWormholeFormat(user), bytes32(0), 0, 5, 5);
    chainbills.pay{value: ethAmt / 2}(payableId, address(chainbills), ethAmt / 2);

    vm.expectEmit(true, true, false, true);
    emit PayableReceived(payableId, toWormholeFormat(user), bytes32(0), 0, 6, 6);
    chainbills.pay(payableId, address(usdc), usdcAmt / 2);
    vm.stopPrank();
  }

  function testSuccessfulUpdatePayableAutoWithdraw() public {
    // Create payable with specific token amounts and autoWithdraw true
    address host = makeAddr('host');
    TokenAndAmount[] memory ataa = new TokenAndAmount[](2);
    ataa[0] = TokenAndAmount({token: address(chainbills), amount: ethAmt});
    ataa[1] = TokenAndAmount({token: address(usdc), amount: usdcAmt});
    vm.prank(host);
    (bytes32 payableId,) = chainbills.createPayable(ataa, true);

    // Make payments with native and ERC20
    vm.startPrank(user);
    vm.expectEmit(true, true, false, true);
    emit PayableReceived(payableId, toWormholeFormat(user), bytes32(0), 0, 1, 1);
    vm.expectEmit(true, true, false, true);
    emit Withdrew(payableId, host, bytes32(0), 1, 1, 1);
    chainbills.pay{value: ethAmt}(payableId, address(chainbills), ethAmt);

    vm.expectEmit(true, true, false, true);
    emit PayableReceived(payableId, toWormholeFormat(user), bytes32(0), 0, 2, 2);
    vm.expectEmit(true, true, false, true);
    emit Withdrew(payableId, host, bytes32(0), 2, 2, 2);
    chainbills.pay(payableId, address(usdc), usdcAmt);
    vm.stopPrank();

    // Verify balances
    uint256 expectedFeeEth = (ethAmt * feePercent) / 10000; // 10000 includes 2 decimal places
    uint256 expectedFeeUsdc = (usdcAmt * feePercent) / 10000;
    assertEq(host.balance, ethAmt - expectedFeeEth);
    assertEq(feeCollector.balance, expectedFeeEth);
    assertEq(usdc.balanceOf(host), usdcAmt - expectedFeeUsdc);
    assertEq(usdc.balanceOf(feeCollector), expectedFeeUsdc);
    uint256 prevHostBalEth = host.balance;
    uint256 prevHostBalUsdc = usdc.balanceOf(host);

    // Turn off auto withdraw
    vm.prank(host);
    vm.expectEmit(true, true, true, true);
    emit UpdatedPayableAutoWithdrawStatus(payableId, host, false);
    chainbills.updatePayableAutoWithdraw(payableId, false);

    // Verify payable data
    assertFalse(chainbills.getPayable(payableId).isAutoWithdraw);

    // Make payments with auto withdraw off
    vm.startPrank(user);
    vm.expectEmit(true, true, false, true);
    emit PayableReceived(payableId, toWormholeFormat(user), bytes32(0), 0, 3, 3);
    chainbills.pay{value: ethAmt}(payableId, address(chainbills), ethAmt);

    vm.expectEmit(true, true, false, true);
    emit PayableReceived(payableId, toWormholeFormat(user), bytes32(0), 0, 4, 4);
    chainbills.pay(payableId, address(usdc), usdcAmt);
    vm.stopPrank();

    // Verify balances
    assertEq(address(chainbills).balance, ethAmt); // Contract now retained balance
    assertEq(usdc.balanceOf(address(chainbills)), usdcAmt);
    assertEq(host.balance, prevHostBalEth); // Unchanged
    assertEq(usdc.balanceOf(host), prevHostBalUsdc);
    assertEq(feeCollector.balance, expectedFeeEth); // Unchanged
    assertEq(usdc.balanceOf(feeCollector), expectedFeeUsdc);

    // Turn auto withdraw back on
    vm.prank(host);
    vm.expectEmit(true, true, true, true);
    emit UpdatedPayableAutoWithdrawStatus(payableId, host, true);
    chainbills.updatePayableAutoWithdraw(payableId, true);

    // Verify payable data
    assertTrue(chainbills.getPayable(payableId).isAutoWithdraw);

    // Make payments with auto withdraw on
    vm.startPrank(user);
    vm.expectEmit(true, true, false, true);
    emit PayableReceived(payableId, toWormholeFormat(user), bytes32(0), 0, 5, 5);
    vm.expectEmit(true, true, false, true);
    emit Withdrew(payableId, host, bytes32(0), 3, 3, 3);
    chainbills.pay{value: ethAmt}(payableId, address(chainbills), ethAmt);

    vm.expectEmit(true, true, false, true);
    emit PayableReceived(payableId, toWormholeFormat(user), bytes32(0), 0, 6, 6);
    vm.expectEmit(true, true, false, true);
    emit Withdrew(payableId, host, bytes32(0), 4, 4, 4);
    chainbills.pay(payableId, address(usdc), usdcAmt);
    vm.stopPrank();

    // Verify balances
    assertEq(host.balance, (ethAmt - expectedFeeEth) * 2);
    assertGt(host.balance, prevHostBalEth);
    assertEq(usdc.balanceOf(host), (usdcAmt - expectedFeeUsdc) * 2);
    assertGt(usdc.balanceOf(host), prevHostBalUsdc);
    assertEq(feeCollector.balance, expectedFeeEth * 2);
    assertEq(usdc.balanceOf(feeCollector), expectedFeeUsdc * 2);
  }
}
