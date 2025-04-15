// SPDX-License-Identifier: Apache 2
pragma solidity ^0.8.20;

import '@openzeppelin/contracts/interfaces/draft-IERC6093.sol';
import '@openzeppelin/contracts/proxy/ERC1967/ERC1967Proxy.sol';
import '@openzeppelin/contracts/token/ERC20/ERC20.sol';
import '@openzeppelin/contracts-upgradeable/access/OwnableUpgradeable.sol';
import 'forge-std/Test.sol';
import 'src/Chainbills.sol';

contract USDC is ERC20 {
  constructor() ERC20('USDC', 'USDC') {}

  function decimals() public view virtual override returns (uint8) {
    return 6;
  }
}

contract CbPayablesFundsTest is CbStructs, Test {
  Chainbills chainbills;
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
    // Create payable that enforces tokens and amounts
    TokenAndAmount[] memory ataa = new TokenAndAmount[](2);
    ataa[0] = TokenAndAmount({token: address(chainbills), amount: ethAmt});
    ataa[1] = TokenAndAmount({token: address(usdc), amount: usdcAmt});
    vm.prank(host);
    (bytes32 payableId,) = chainbills.createPayable(ataa, false);

    vm.startPrank(user);
    ChainStats memory prevChainStats = chainbills.getChainStats();
    TokenDetails memory prevEthDetails = chainbills.getTokenDetails(address(chainbills));
    TokenDetails memory prevUsdcDetails = chainbills.getTokenDetails(address(usdc));

    // testing successful first payment with native token (ETH)
    uint256 prevCbEthBal = address(chainbills).balance;

    vm.expectEmit(true, true, false, true);
    emit PayableReceived(payableId, toWormholeFormat(user), bytes32(0), 0, 1, 1);
    (, bytes32 paymentId1) = chainbills.pay{value: ethAmt}(payableId, address(chainbills), ethAmt);

    uint256 newCbEthBal = address(chainbills).balance;
    bytes32 fetchedP1Id = chainbills.payablePaymentIds(payableId, 0);
    PayablePayment memory p1 = chainbills.getPayablePayment(paymentId1);
    ChainStats memory newChainStats = chainbills.getChainStats();

    // testing successful second payment with ERC20 token (USDC)
    uint256 prevCbUsdcBal = usdc.balanceOf(address(chainbills));

    vm.expectEmit(true, true, false, true);
    emit PayableReceived(payableId, toWormholeFormat(user), bytes32(0), 0, 2, 2);
    (, bytes32 paymentId2) = chainbills.pay(payableId, address(usdc), usdcAmt);

    uint256 newCbUsdcBal = usdc.balanceOf(address(chainbills));
    bytes32 fetchedP2Id = chainbills.payablePaymentIds(payableId, 1);
    PayablePayment memory p2 = chainbills.getPayablePayment(paymentId2);

    ChainStats memory newerChainStats = chainbills.getChainStats();
    Payable memory pyble = chainbills.getPayable(payableId);
    TokenDetails memory newEthDetails = chainbills.getTokenDetails(address(chainbills));
    TokenDetails memory newUsdcDetails = chainbills.getTokenDetails(address(usdc));

    uint256 localChainCount = chainbills.getPayableChainPaymentsCount(payableId, 0);
    bytes32[] memory localChainPaymentIds = chainbills.getPayableChainPaymentIds(payableId, 0);
    vm.stopPrank();

    // check balances
    assertEq(prevCbEthBal + ethAmt, newCbEthBal);
    assertEq(prevCbUsdcBal + usdcAmt, newCbUsdcBal);
    assertEq(chainbills.getBalances(payableId)[0].token, address(chainbills));
    assertEq(chainbills.getBalances(payableId)[0].amount, ethAmt);
    assertEq(chainbills.getBalances(payableId)[1].token, address(usdc));
    assertEq(chainbills.getBalances(payableId)[1].amount, usdcAmt);

    // check stored IDs
    assertEq(paymentId1, fetchedP1Id);
    assertEq(paymentId2, fetchedP2Id);

    // check counts
    assertEq(prevChainStats.payablePaymentsCount, 0);
    assertEq(newChainStats.payablePaymentsCount, 1);
    assertEq(newerChainStats.payablePaymentsCount, 2);
    assertEq(pyble.paymentsCount, 2);
    assertEq(pyble.balancesCount, 2);
    assertEq(newerChainStats.payablePaymentsCount, pyble.paymentsCount);
    assertEq(localChainCount, 2);
    assertEq(localChainPaymentIds[0], paymentId1);
    assertEq(localChainPaymentIds[1], paymentId2);

    // check token totals
    assertEq(prevEthDetails.totalUserPaid + ethAmt, newEthDetails.totalUserPaid);
    assertEq(prevEthDetails.totalPayableReceived + ethAmt, newEthDetails.totalPayableReceived);
    assertEq(prevUsdcDetails.totalUserPaid + usdcAmt, newUsdcDetails.totalUserPaid);
    assertEq(prevUsdcDetails.totalPayableReceived + usdcAmt, newUsdcDetails.totalPayableReceived);

    // check payment 1's details
    assertEq(p1.payableId, payableId);
    assertEq(p1.payer, toWormholeFormat(user));
    assertEq(p1.token, address(chainbills));
    assertEq(p1.chainCount, newChainStats.payablePaymentsCount);
    assertEq(p1.payerChainId, 0);
    assertEq(p1.localChainCount, localChainCount - 1);
    assertGt(p1.timestamp, 0);
    assertGe(p1.timestamp, block.timestamp);
    assertEq(p1.amount, ethAmt);

    // check payment 2's details
    assertEq(p2.payableId, payableId);
    assertEq(p2.payer, toWormholeFormat(user));
    assertEq(p2.token, address(usdc));
    assertEq(p2.chainCount, newerChainStats.payablePaymentsCount);
    assertEq(p2.payerChainId, 0);
    assertEq(p2.localChainCount, localChainCount);
    assertGt(p2.timestamp, 0);
    assertGe(p2.timestamp, block.timestamp);
    assertEq(p2.amount, usdcAmt);
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
    // Create payable that enforces tokens and amounts
    vm.startPrank(user);
    TokenAndAmount[] memory ataa = new TokenAndAmount[](2);
    ataa[0] = TokenAndAmount({token: address(chainbills), amount: ethAmt});
    ataa[1] = TokenAndAmount({token: address(usdc), amount: usdcAmt});
    (bytes32 payableId,) = chainbills.createPayable(ataa, false);

    ChainStats memory prevChainStats = chainbills.getChainStats();
    TokenDetails memory prevEthDetails = chainbills.getTokenDetails(address(chainbills));
    TokenDetails memory prevUsdcDetails = chainbills.getTokenDetails(address(usdc));

    // Make payments in native token (ETH) and ERC20 token (USDC)
    chainbills.pay{value: ethAmt}(payableId, address(chainbills), ethAmt);
    chainbills.pay(payableId, address(usdc), usdcAmt);

    // obtain balances before withdrawals
    uint256 prevCbEthBal = address(chainbills).balance;
    uint256 prevPybleEthBal = chainbills.getBalances(payableId)[0].amount;
    uint256 prevFeeCollectorEthBal = feeCollector.balance;
    uint256 prevCbUsdcBal = usdc.balanceOf(address(chainbills));
    uint256 prevFeeCollectorUsdcBal = usdc.balanceOf(feeCollector);
    uint256 prevPybleUsdcBal = chainbills.getBalances(payableId)[1].amount;

    // Make withdrawal in native token (ETH)
    vm.expectEmit(true, true, false, true);
    emit Withdrew(payableId, user, bytes32(0), 1, 1, 1);
    (bytes32 wId1) = chainbills.withdraw(payableId, address(chainbills), ethAmt);
    bytes32 fetchedW1Id = chainbills.payableWithdrawalIds(payableId, 0);
    Withdrawal memory w1 = chainbills.getWithdrawal(wId1);
    ChainStats memory newChainStats = chainbills.getChainStats();

    // Make withdrawal in ERC20 token (USDC)
    vm.expectEmit(true, true, false, true);
    emit Withdrew(payableId, user, bytes32(0), 2, 2, 2);
    (bytes32 wId2) = chainbills.withdraw(payableId, address(usdc), usdcAmt);
    bytes32 fetchedW2Id = chainbills.payableWithdrawalIds(payableId, 1);
    Withdrawal memory w2 = chainbills.getWithdrawal(wId2);

    // Obtain balances after withdrawals
    uint256 newCbEthBal = address(chainbills).balance;
    uint256 newPybleEthBal = chainbills.getBalances(payableId)[0].amount;
    uint256 newFeeCollectorEthBal = feeCollector.balance;
    uint256 newCbUsdcBal = usdc.balanceOf(address(chainbills));
    uint256 newPybleUsdcBal = chainbills.getBalances(payableId)[1].amount;
    uint256 newFeeCollectorUsdcBal = usdc.balanceOf(feeCollector);

    ChainStats memory newerChainStats = chainbills.getChainStats();
    Payable memory pyble = chainbills.getPayable(payableId);
    TokenDetails memory newEthDetails = chainbills.getTokenDetails(address(chainbills));
    TokenDetails memory newUsdcDetails = chainbills.getTokenDetails(address(usdc));

    vm.stopPrank();

    // obtain fees and amount due
    Config memory config = chainbills.getConfig();
    // 10000 means 100 but with 2 decimal places
    uint256 ethPercent = (ethAmt * config.withdrawalFeePercentage) / 10000;
    uint256 ethFee = ethPercent > maxWtdlFeesEth ? maxWtdlFeesEth : ethPercent;
    uint256 usdcPercent = (usdcAmt * config.withdrawalFeePercentage) / 10000;
    uint256 usdcFee = usdcPercent > maxWtdlFeesUsdc ? maxWtdlFeesUsdc : usdcPercent;

    // check balances
    assertEq(prevCbEthBal - ethAmt, newCbEthBal);
    assertEq(prevPybleEthBal - ethAmt, newPybleEthBal);
    assertEq(prevFeeCollectorEthBal + ethFee, newFeeCollectorEthBal);
    assertEq(prevCbUsdcBal - usdcAmt, newCbUsdcBal);
    assertEq(prevPybleUsdcBal - usdcAmt, newPybleUsdcBal);
    assertEq(prevFeeCollectorUsdcBal + usdcFee, newFeeCollectorUsdcBal);

    // check stored IDs
    assertEq(wId1, fetchedW1Id);
    assertEq(wId2, fetchedW2Id);

    // check counts
    assertEq(prevChainStats.withdrawalsCount, 0);
    assertEq(newChainStats.withdrawalsCount, 1);
    assertEq(newerChainStats.withdrawalsCount, 2);
    assertEq(pyble.withdrawalsCount, 2);
    assertEq(newerChainStats.withdrawalsCount, pyble.withdrawalsCount);

    // check token totals
    assertEq(prevEthDetails.totalWithdrawn + ethAmt, newEthDetails.totalWithdrawn);
    assertEq(prevEthDetails.totalWithdrawalFeesCollected + ethFee, newEthDetails.totalWithdrawalFeesCollected);
    assertEq(prevUsdcDetails.totalWithdrawn + usdcAmt, newUsdcDetails.totalWithdrawn);
    assertEq(prevUsdcDetails.totalWithdrawalFeesCollected + usdcFee, newUsdcDetails.totalWithdrawalFeesCollected);

    // check withdrawal 1's details
    assertEq(w1.payableId, payableId);
    assertEq(w1.host, user);
    assertEq(w1.token, address(chainbills));
    assertEq(w1.chainCount, newChainStats.withdrawalsCount);
    assertEq(w1.hostCount, chainbills.getUser(user).withdrawalsCount - 1);
    assertEq(w1.payableCount, pyble.withdrawalsCount - 1);
    assertGt(w1.timestamp, 0);
    assertGe(w1.timestamp, block.timestamp);
    assertEq(w1.amount, ethAmt);

    // check withdrawal 2's details
    assertEq(w2.payableId, payableId);
    assertEq(w2.host, user);
    assertEq(w2.token, address(usdc));
    assertEq(w2.chainCount, newerChainStats.withdrawalsCount);
    assertEq(w2.hostCount, chainbills.getUser(user).withdrawalsCount);
    assertEq(w2.payableCount, pyble.withdrawalsCount);
    assertGt(w2.timestamp, 0);
    assertGe(w2.timestamp, block.timestamp);
    assertEq(w2.amount, usdcAmt);
  }

  function testSuccessfulPayableAutoWithdrawalOnPayment() public {
    // Create payable that enforces tokens and amounts with autoWithdraw enabled
    TokenAndAmount[] memory ataa = new TokenAndAmount[](2);
    ataa[0] = TokenAndAmount({token: address(chainbills), amount: ethAmt});
    ataa[1] = TokenAndAmount({token: address(usdc), amount: usdcAmt});
    vm.prank(host);
    (bytes32 payableId,) = chainbills.createPayable(ataa, true);

    // Get initial balances and stats
    uint256 initialUserEthBal = user.balance;
    uint256 initialUserUsdcBal = usdc.balanceOf(user);
    uint256 initialHostEthBal = host.balance;
    uint256 initialHostUsdcBal = usdc.balanceOf(host);
    uint256 initialFeeCollectorEthBal = feeCollector.balance;
    uint256 initialFeeCollectorUsdcBal = usdc.balanceOf(feeCollector);
    ChainStats memory initialStats = chainbills.getChainStats();
    TokenDetails memory prevEthDetails = chainbills.getTokenDetails(address(chainbills));
    TokenDetails memory prevUsdcDetails = chainbills.getTokenDetails(address(usdc));

    // Calculate fees
    Config memory config = chainbills.getConfig();
    uint256 ethFee = (ethAmt * config.withdrawalFeePercentage) / 10000;
    ethFee = ethFee > maxWtdlFeesEth ? maxWtdlFeesEth : ethFee;
    uint256 ethAmtDue = ethAmt - ethFee;
    uint256 usdcFee = (usdcAmt * config.withdrawalFeePercentage) / 10000;
    usdcFee = usdcFee > maxWtdlFeesUsdc ? maxWtdlFeesUsdc : usdcFee;
    uint256 usdcAmtDue = usdcAmt - usdcFee;
    vm.startPrank(user);

    // Make ETH payment and check auto-withdrawal
    vm.expectEmit(true, true, false, true);
    emit PayableReceived(payableId, toWormholeFormat(user), bytes32(0), 0, 1, 1);
    vm.expectEmit(true, true, false, true);
    emit Withdrew(payableId, host, bytes32(0), 1, 1, 1);
    chainbills.pay{value: ethAmt}(payableId, address(chainbills), ethAmt);

    // Make USDC payment and check auto-withdrawal
    vm.expectEmit(true, true, false, true);
    emit PayableReceived(payableId, toWormholeFormat(user), bytes32(0), 0, 2, 2);
    vm.expectEmit(true, true, false, true);
    emit Withdrew(payableId, host, bytes32(0), 2, 2, 2);
    chainbills.pay(payableId, address(usdc), usdcAmt);

    vm.stopPrank();

    TokenDetails memory newEthDetails = chainbills.getTokenDetails(address(chainbills));
    TokenDetails memory newUsdcDetails = chainbills.getTokenDetails(address(usdc));

    // Verify final balances
    assertEq(user.balance, initialUserEthBal - ethAmt);
    assertEq(usdc.balanceOf(user), initialUserUsdcBal - usdcAmt);
    assertEq(host.balance, initialHostEthBal + ethAmtDue);
    assertEq(usdc.balanceOf(host), initialHostUsdcBal + usdcAmtDue);
    assertEq(feeCollector.balance, initialFeeCollectorEthBal + ethFee);
    assertEq(usdc.balanceOf(feeCollector), initialFeeCollectorUsdcBal + usdcFee);

    // check token totals
    assertEq(prevEthDetails.totalUserPaid + ethAmt, newEthDetails.totalUserPaid);
    assertEq(prevEthDetails.totalPayableReceived + ethAmt, newEthDetails.totalPayableReceived);
    assertEq(prevUsdcDetails.totalUserPaid + usdcAmt, newUsdcDetails.totalUserPaid);
    assertEq(prevUsdcDetails.totalPayableReceived + usdcAmt, newUsdcDetails.totalPayableReceived);
    assertEq(prevEthDetails.totalWithdrawn + ethAmt, newEthDetails.totalWithdrawn);
    assertEq(prevEthDetails.totalWithdrawalFeesCollected + ethFee, newEthDetails.totalWithdrawalFeesCollected);
    assertEq(prevUsdcDetails.totalWithdrawn + usdcAmt, newUsdcDetails.totalWithdrawn);
    assertEq(prevUsdcDetails.totalWithdrawalFeesCollected + usdcFee, newUsdcDetails.totalWithdrawalFeesCollected);

    // Verify payable state
    Payable memory pyble = chainbills.getPayable(payableId);
    assertEq(pyble.paymentsCount, 2);
    assertEq(pyble.withdrawalsCount, 2);
    assertEq(chainbills.getBalances(payableId)[0].token, address(chainbills));
    assertEq(chainbills.getBalances(payableId)[0].amount, 0);
    assertEq(chainbills.getBalances(payableId)[1].token, address(usdc));
    assertEq(chainbills.getBalances(payableId)[1].amount, 0);

    // Verify chain stats
    ChainStats memory finalStats = chainbills.getChainStats();
    assertEq(finalStats.payablePaymentsCount, initialStats.payablePaymentsCount + 2);
    assertEq(finalStats.withdrawalsCount, initialStats.withdrawalsCount + 2);
  }
}
