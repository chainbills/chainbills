// SPDX-License-Identifier: Apache 2
pragma solidity ^0.8.30;

import {IERC20Errors} from '@openzeppelin/contracts/interfaces/draft-IERC6093.sol';
import {ERC1967Proxy} from '@openzeppelin/contracts/proxy/ERC1967/ERC1967Proxy.sol';
import {Test} from 'forge-std/Test.sol';
import {Chainbills} from 'src/Chainbills.sol';
import {CbGetters} from 'src/CbGetters.sol';
import {CbStructs} from 'src/CbStructs.sol';
import {CbPayables} from 'src/CbPayables.sol';
import {CbTransactions} from 'src/CbTransactions.sol';
import {toWormholeFormat} from 'wormhole/Utils.sol';
import {USDC} from './mocks/MockUSDC.sol';
import {RejectEth} from './mocks/RejectEth.sol';

contract CbPayablesFundsTest is CbStructs, Test {
  Chainbills chainbills;
  CbGetters cbGetters;
  USDC usdc;

  address feeCollector = makeAddr('fee-collector');
  address host = makeAddr('host');
  address owner = makeAddr('owner');
  address user = makeAddr('user');

  uint256 ethAmt = 1e16; // 0.01 ETH
  uint16 feePercent = 200; // 2% (with 2 decimals)
  uint256 maxWtdlFeesEth = 5e17; // 0.5 ETH
  uint256 maxWtdlFeesUsdc = 2e8; // 200 USDC
  uint256 usdcAmt = 1e8; // 100 USDC

  // Blank Test Function to exclude this Test contract itself from test coverage reports.
  function test() public {}

  function setUp() public {
    vm.startPrank(owner);
    chainbills = Chainbills(payable(address(new ERC1967Proxy(address(new Chainbills()), ''))));
    usdc = new USDC();

    chainbills.initialize(feeCollector, feePercent);
    chainbills.setPayablesLogic(address(new CbPayables()));
    chainbills.setTransactionsLogic(address(new CbTransactions()));

    chainbills.allowPaymentsForToken(address(chainbills));
    chainbills.updateMaxWithdrawalFees(address(chainbills), maxWtdlFeesEth);

    chainbills.allowPaymentsForToken(address(usdc));
    chainbills.updateMaxWithdrawalFees(address(usdc), maxWtdlFeesUsdc);
    cbGetters = new CbGetters(address(chainbills));
    vm.stopPrank();

    deal(user, ethAmt * 2);
    deal(address(usdc), user, usdcAmt * 2);
    vm.prank(user);
    usdc.approve(address(chainbills), usdcAmt * 2);
  }

  function testRevertingPayablePayment() public {
    // Create payable that enforces tokens and amounts
    TokenAndAmount[] memory ataa = new TokenAndAmount[](2);
    ataa[0] = TokenAndAmount({token: address(chainbills), amount: ethAmt});
    ataa[1] = TokenAndAmount({token: address(usdc), amount: usdcAmt});
    vm.prank(host);
    (bytes32 payableId,) = chainbills.createPayable(ataa, false);

    vm.prank(user);
    // Test invalid payable ID
    vm.expectRevert(InvalidPayableId.selector);
    chainbills.pay{value: ethAmt}(bytes32(0), address(chainbills), ethAmt);

    // Test closed payable
    vm.prank(host);
    chainbills.closePayable(payableId);

    vm.expectRevert(PayableIsClosed.selector);
    chainbills.pay{value: ethAmt}(payableId, address(chainbills), ethAmt);

    vm.prank(host);
    chainbills.reopenPayable(payableId);

    // Test not matching token and amount
    vm.startPrank(user);
    vm.expectRevert(MatchingTokenAndAmountNotFound.selector);
    chainbills.pay{value: ethAmt * 2}(payableId, address(chainbills), ethAmt * 2);

    vm.expectRevert(MatchingTokenAndAmountNotFound.selector);
    chainbills.pay(payableId, address(usdc), usdcAmt * 2);

    // Test insufficient payment value for native token
    vm.expectRevert(InsufficientPaymentValue.selector);
    chainbills.pay{value: ethAmt / 2}(payableId, address(chainbills), ethAmt);

    // Test incorrect payment value for native token
    vm.expectRevert(IncorrectPaymentValue.selector);
    chainbills.pay{value: ethAmt * 2}(payableId, address(chainbills), ethAmt);

    // Test unauthorized ERC20 transfer
    usdc.approve(address(chainbills), 0); // reset approval done in setUp above
    vm.expectPartialRevert(IERC20Errors.ERC20InsufficientAllowance.selector);
    chainbills.pay(payableId, address(usdc), usdcAmt);
    vm.stopPrank();
  }

  function testSuccessfulPayablePayment() public {
    TokenAndAmount[] memory ataa = new TokenAndAmount[](2);
    ataa[0] = TokenAndAmount({token: address(chainbills), amount: ethAmt});
    ataa[1] = TokenAndAmount({token: address(usdc), amount: usdcAmt});
    vm.prank(host);
    (bytes32 payableId,) = chainbills.createPayable(ataa, false);

    vm.startPrank(user);

    // First payment: ETH — assert before and after to avoid keeping snapshot variables.
    assertEq(address(chainbills).balance, 0);
    vm.expectEmit(true, true, false, true);
    emit PayableReceived(payableId, toWormholeFormat(user), bytes32(0), 0, 1, 1);
    (, bytes32 paymentId1) = chainbills.pay{value: ethAmt}(payableId, address(chainbills), ethAmt);

    assertEq(address(chainbills).balance, ethAmt);
    assertEq(cbGetters.getChainStats().payablePaymentsCount, 1);
    assertEq(cbGetters.getTokenDetails(address(chainbills)).totalUserPaid, ethAmt);
    assertEq(cbGetters.getTokenDetails(address(chainbills)).totalPayableReceived, ethAmt);

    // Second payment: USDC.
    assertEq(usdc.balanceOf(address(chainbills)), 0);
    vm.expectEmit(true, true, false, true);
    emit PayableReceived(payableId, toWormholeFormat(user), bytes32(0), 0, 2, 2);
    (, bytes32 paymentId2) = chainbills.pay(payableId, address(usdc), usdcAmt);

    assertEq(usdc.balanceOf(address(chainbills)), usdcAmt);
    assertEq(cbGetters.getChainStats().payablePaymentsCount, 2);
    assertEq(cbGetters.getTokenDetails(address(usdc)).totalUserPaid, usdcAmt);
    assertEq(cbGetters.getTokenDetails(address(usdc)).totalPayableReceived, usdcAmt);
    vm.stopPrank();

    // Payable balances.
    assertEq(cbGetters.getBalances(payableId)[0].token, address(chainbills));
    assertEq(cbGetters.getBalances(payableId)[0].amount, ethAmt);
    assertEq(cbGetters.getBalances(payableId)[1].token, address(usdc));
    assertEq(cbGetters.getBalances(payableId)[1].amount, usdcAmt);

    // Stored payment IDs.
    assertEq(paymentId1, cbGetters.payablePaymentIdsPaginated(payableId, 0, 1)[0]);
    assertEq(paymentId2, cbGetters.payablePaymentIdsPaginated(payableId, 1, 1)[0]);

    // Payable counts.
    assertEq(cbGetters.getPayable(payableId).paymentsCount, 2);
    assertEq(cbGetters.getPayable(payableId).balancesCount, 2);

    // Local chain payment IDs.
    uint256 localCount = cbGetters.getPayableChainPaymentsCount(payableId, 0);
    assertEq(localCount, 2);
    bytes32[] memory localIds = cbGetters.payableChainPaymentIdsPaginated(payableId, 0, 0, localCount);
    assertEq(localIds[0], paymentId1);
    assertEq(localIds[1], paymentId2);

    // Payment 1 details.
    PayablePayment memory p = cbGetters.getPayablePayment(paymentId1);
    assertEq(p.payableId, payableId);
    assertEq(p.payer, toWormholeFormat(user));
    assertEq(p.token, address(chainbills));
    assertEq(p.chainCount, 1);
    assertEq(p.payerChainId, 0);
    assertEq(p.localChainCount, localCount - 1);
    assertGt(p.timestamp, 0);
    assertGe(p.timestamp, block.timestamp);
    assertEq(p.amount, ethAmt);

    // Payment 2 details (reuse p).
    p = cbGetters.getPayablePayment(paymentId2);
    assertEq(p.payableId, payableId);
    assertEq(p.payer, toWormholeFormat(user));
    assertEq(p.token, address(usdc));
    assertEq(p.chainCount, 2);
    assertEq(p.payerChainId, 0);
    assertEq(p.localChainCount, localCount);
    assertGt(p.timestamp, 0);
    assertGe(p.timestamp, block.timestamp);
    assertEq(p.amount, usdcAmt);
  }

  function testRevertingPayableWithdrawal() public {
    // Create payable and make payments
    TokenAndAmount[] memory ataa = new TokenAndAmount[](2);
    ataa[0] = TokenAndAmount({token: address(chainbills), amount: ethAmt});
    ataa[1] = TokenAndAmount({token: address(usdc), amount: usdcAmt});
    vm.prank(host);
    (bytes32 payableId,) = chainbills.createPayable(ataa, false);

    vm.startPrank(user);
    chainbills.pay{value: ethAmt}(payableId, address(chainbills), ethAmt);
    chainbills.pay(payableId, address(usdc), usdcAmt);
    vm.stopPrank();

    // Test invalid payable ID
    vm.expectRevert(InvalidPayableId.selector);
    vm.prank(host);
    chainbills.withdraw(bytes32(0), address(chainbills), ethAmt);

    // Test Caller not owner of Payable
    vm.expectRevert(NotYourPayable.selector);
    vm.prank(user);
    chainbills.withdraw(payableId, address(chainbills), ethAmt);

    // Test Zero Amount
    vm.startPrank(host);
    vm.expectRevert(ZeroAmountSpecified.selector);
    chainbills.withdraw(payableId, address(chainbills), 0);

    // Test no balance for withdrawal token
    vm.expectRevert(NoBalanceForWithdrawalToken.selector);
    chainbills.withdraw(payableId, makeAddr('unsupported-token'), usdcAmt);

    // Test Insufficient Withdraw Amount
    vm.expectRevert(InsufficientWithdrawAmount.selector);
    chainbills.withdraw(payableId, address(chainbills), ethAmt * 2);
    vm.stopPrank();
  }

  function testSuccessfulPayableWithdrawal() public {
    bytes32 payableId;
    {
      TokenAndAmount[] memory ataa = new TokenAndAmount[](2);
      ataa[0] = TokenAndAmount({token: address(chainbills), amount: ethAmt});
      ataa[1] = TokenAndAmount({token: address(usdc), amount: usdcAmt});
      vm.startPrank(user);
      (payableId,) = chainbills.createPayable(ataa, false);
      chainbills.pay{value: ethAmt}(payableId, address(chainbills), ethAmt);
      chainbills.pay(payableId, address(usdc), usdcAmt);
    }
    // ataa freed; prank still active.

    bytes32 wId1;
    uint256 ethFee;
    {
      uint256 prevCbEthBal = address(chainbills).balance;
      uint256 prevPybleEthBal = cbGetters.getBalances(payableId)[0].amount;
      uint256 ethPercent = (ethAmt * feePercent) / 10000;
      ethFee = ethPercent > maxWtdlFeesEth ? maxWtdlFeesEth : ethPercent;
      uint256 prevFeeColEth = feeCollector.balance;

      vm.expectEmit(true, true, false, true);
      emit Withdrew(payableId, user, bytes32(0), 1, 1, 1);
      wId1 = chainbills.withdraw(payableId, address(chainbills), ethAmt);

      assertEq(address(chainbills).balance, prevCbEthBal - ethAmt);
      assertEq(cbGetters.getBalances(payableId)[0].amount, prevPybleEthBal - ethAmt);
      assertEq(feeCollector.balance, prevFeeColEth + ethFee);
      assertEq(cbGetters.getChainStats().withdrawalsCount, 1);
      assertEq(wId1, cbGetters.payableWithdrawalIdsPaginated(payableId, 0, 1)[0]);
    }

    bytes32 wId2;
    uint256 usdcFee;
    {
      uint256 prevCbUsdcBal = usdc.balanceOf(address(chainbills));
      uint256 prevPybleUsdcBal = cbGetters.getBalances(payableId)[1].amount;
      uint256 usdcPercent = (usdcAmt * feePercent) / 10000;
      usdcFee = usdcPercent > maxWtdlFeesUsdc ? maxWtdlFeesUsdc : usdcPercent;
      uint256 prevFeeColUsdc = usdc.balanceOf(feeCollector);

      vm.expectEmit(true, true, false, true);
      emit Withdrew(payableId, user, bytes32(0), 2, 2, 2);
      wId2 = chainbills.withdraw(payableId, address(usdc), usdcAmt);

      assertEq(usdc.balanceOf(address(chainbills)), prevCbUsdcBal - usdcAmt);
      assertEq(cbGetters.getBalances(payableId)[1].amount, prevPybleUsdcBal - usdcAmt);
      assertEq(usdc.balanceOf(feeCollector), prevFeeColUsdc + usdcFee);
      assertEq(cbGetters.getChainStats().withdrawalsCount, 2);
      assertEq(wId2, cbGetters.payableWithdrawalIdsPaginated(payableId, 1, 1)[0]);
    }
    vm.stopPrank();

    // Token totals — known absolute values since setUp creates a fresh contract.
    assertEq(cbGetters.getTokenDetails(address(chainbills)).totalWithdrawn, ethAmt);
    assertEq(cbGetters.getTokenDetails(address(chainbills)).totalWithdrawalFeesCollected, ethFee);
    assertEq(cbGetters.getTokenDetails(address(usdc)).totalWithdrawn, usdcAmt);
    assertEq(cbGetters.getTokenDetails(address(usdc)).totalWithdrawalFeesCollected, usdcFee);

    assertEq(cbGetters.getPayable(payableId).withdrawalsCount, 2);
    assertEq(cbGetters.getChainStats().withdrawalsCount, 2);

    // Withdrawal 1 details.
    Withdrawal memory w = cbGetters.getWithdrawal(wId1);
    assertEq(w.payableId, payableId);
    assertEq(w.host, user);
    assertEq(w.token, address(chainbills));
    assertEq(w.chainCount, 1);
    assertEq(w.hostCount, 1);
    assertEq(w.payableCount, 1);
    assertGt(w.timestamp, 0);
    assertGe(w.timestamp, block.timestamp);
    assertEq(w.amount, ethAmt);

    // Withdrawal 2 details (reuse w).
    w = cbGetters.getWithdrawal(wId2);
    assertEq(w.payableId, payableId);
    assertEq(w.host, user);
    assertEq(w.token, address(usdc));
    assertEq(w.chainCount, 2);
    assertEq(w.hostCount, 2);
    assertEq(w.payableCount, 2);
    assertGt(w.timestamp, 0);
    assertGe(w.timestamp, block.timestamp);
    assertEq(w.amount, usdcAmt);
  }

  function testPaySameTokenTwiceUpdatesExistingBalance() public {
    // First payment adds a new balance entry; second payment hits the existing
    // entry (wasMatchingBalanceUpdated = true path in CbTransactions._receivePayment).
    vm.prank(host);
    (bytes32 payableId,) = chainbills.createPayable(new TokenAndAmount[](0), false);

    vm.startPrank(user);
    deal(address(usdc), user, usdcAmt * 3);
    usdc.approve(address(chainbills), usdcAmt * 3);

    chainbills.pay(payableId, address(usdc), usdcAmt);
    chainbills.pay(payableId, address(usdc), usdcAmt);
    vm.stopPrank();

    assertEq(cbGetters.getPayable(payableId).paymentsCount, 2);
    assertEq(cbGetters.getPayable(payableId).balancesCount, 1); // same token — only one balance entry
    assertEq(cbGetters.getBalances(payableId)[0].amount, usdcAmt * 2);
  }

  function testSuccessfulPayableAutoWithdrawalOnPayment() public {
    TokenAndAmount[] memory ataa = new TokenAndAmount[](2);
    ataa[0] = TokenAndAmount({token: address(chainbills), amount: ethAmt});
    ataa[1] = TokenAndAmount({token: address(usdc), amount: usdcAmt});
    vm.prank(host);
    (bytes32 payableId,) = chainbills.createPayable(ataa, true);

    // Fee calc — use feePercent state var directly instead of fetching config.
    uint256 ethFee = (ethAmt * feePercent) / 10000;
    if (ethFee > maxWtdlFeesEth) ethFee = maxWtdlFeesEth;
    uint256 usdcFee = (usdcAmt * feePercent) / 10000;
    if (usdcFee > maxWtdlFeesUsdc) usdcFee = maxWtdlFeesUsdc;

    uint256 initPayments = cbGetters.getChainStats().payablePaymentsCount;
    uint256 initWithdrawals = cbGetters.getChainStats().withdrawalsCount;

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

    // Final balances — setUp gives user ethAmt*2 ETH and usdcAmt*2 USDC;
    // host and feeCollector start at 0.
    assertEq(user.balance, ethAmt);
    assertEq(usdc.balanceOf(user), usdcAmt);
    assertEq(host.balance, ethAmt - ethFee);
    assertEq(usdc.balanceOf(host), usdcAmt - usdcFee);
    assertEq(feeCollector.balance, ethFee);
    assertEq(usdc.balanceOf(feeCollector), usdcFee);

    // Token totals — absolute values since contract is fresh.
    assertEq(cbGetters.getTokenDetails(address(chainbills)).totalUserPaid, ethAmt);
    assertEq(cbGetters.getTokenDetails(address(chainbills)).totalPayableReceived, ethAmt);
    assertEq(cbGetters.getTokenDetails(address(usdc)).totalUserPaid, usdcAmt);
    assertEq(cbGetters.getTokenDetails(address(usdc)).totalPayableReceived, usdcAmt);
    assertEq(cbGetters.getTokenDetails(address(chainbills)).totalWithdrawn, ethAmt);
    assertEq(cbGetters.getTokenDetails(address(chainbills)).totalWithdrawalFeesCollected, ethFee);
    assertEq(cbGetters.getTokenDetails(address(usdc)).totalWithdrawn, usdcAmt);
    assertEq(cbGetters.getTokenDetails(address(usdc)).totalWithdrawalFeesCollected, usdcFee);

    // Payable state.
    assertEq(cbGetters.getPayable(payableId).paymentsCount, 2);
    assertEq(cbGetters.getPayable(payableId).withdrawalsCount, 2);
    assertEq(cbGetters.getBalances(payableId)[0].token, address(chainbills));
    assertEq(cbGetters.getBalances(payableId)[0].amount, 0);
    assertEq(cbGetters.getBalances(payableId)[1].token, address(usdc));
    assertEq(cbGetters.getBalances(payableId)[1].amount, 0);

    // Chain stats.
    assertEq(cbGetters.getChainStats().payablePaymentsCount, initPayments + 2);
    assertEq(cbGetters.getChainStats().withdrawalsCount, initWithdrawals + 2);
  }

  function testWithdrawRevertsWhenHostRejectsEth() public {
    RejectEth rejecter = new RejectEth();
    vm.prank(address(rejecter));
    (bytes32 pid,) = chainbills.createPayable(new TokenAndAmount[](0), false);

    deal(user, ethAmt);
    vm.prank(user);
    chainbills.pay{value: ethAmt}(pid, address(chainbills), ethAmt);

    vm.prank(address(rejecter));
    vm.expectRevert(UnsuccessfulWithdrawal.selector);
    chainbills.withdraw(pid, address(chainbills), ethAmt);
  }

  function testWithdrawRevertsWhenFeeCollectorRejectsEth() public {
    vm.prank(host);
    (bytes32 pid,) = chainbills.createPayable(new TokenAndAmount[](0), false);

    deal(user, ethAmt);
    vm.prank(user);
    chainbills.pay{value: ethAmt}(pid, address(chainbills), ethAmt);

    RejectEth rejecter = new RejectEth();
    vm.prank(owner);
    chainbills.setFeeCollectorAddress(address(rejecter));

    vm.prank(host);
    vm.expectRevert(UnsuccessfulFeesWithdrawal.selector);
    chainbills.withdraw(pid, address(chainbills), ethAmt);
  }
}
