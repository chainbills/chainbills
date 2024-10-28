// SPDX-License-Identifier: Apache 2
pragma solidity ^0.8.20;

import '@openzeppelin/contracts/token/ERC20/ERC20.sol';
import 'src/CbState.sol';
import 'src/Chainbills.sol';
import 'forge-std/Test.sol';

contract USDC is ERC20 {
  constructor() ERC20('USDC', 'USDC') {}

  function decimals() public view virtual override returns (uint8) {
    return 6;
  }
}

contract CbUsersTest is Test {
  Chainbills chainbills;
  USDC usdc;

  address feeCollector = makeAddr('fee-collector');
  address wormhole = makeAddr('wormhole');
  address user = makeAddr('user');

  uint16 chainId = 10002;
  uint256 ethAmt = 1e16;
  uint256 ethMaxFee = 5e15;
  uint256 usdcAmt = 1e8;
  uint256 usdcMaxFee = 50e6;

  function setUp() public {
    chainbills = new Chainbills(feeCollector, wormhole, chainId, 200);
    usdc = new USDC();

    // calling updateMaxWithdrawalFees with contract address and USDC
    // is to allow native token (ETH) and ERC20 to be used for payments
    chainbills.updateMaxWithdrawalFees(address(chainbills), ethMaxFee);
    chainbills.updateMaxWithdrawalFees(address(usdc), usdcMaxFee);
  }

  function testUserInitOnCreatePayable() public {
    vm.startPrank(user);
    (uint256 prevUsersCount,,,,,) = chainbills.chainStats();
    (uint256 prevUserChainCount,,,,) = chainbills.users(user);

    vm.expectEmit(true, false, false, true);
    emit InitializedUser(user, prevUsersCount + 1);

    chainbills.createPayable(new TokenAndAmount[](0));

    (uint256 newUsersCount,,,,,) = chainbills.chainStats();
    (uint256 newUserChainCount,,,,) = chainbills.users(user);
    vm.stopPrank();

    assertEq(prevUserChainCount, 0);
    assertEq(newUserChainCount, newUsersCount);
    assertEq(prevUsersCount + 1, newUsersCount);
  }

  function testUserInitOnMakePayment() public {
    // create a payable to make payment to. use this test contract as the host.
    bytes32 payableId = chainbills.createPayable(new TokenAndAmount[](0));

    vm.startPrank(user);
    (uint256 prevUsersCount,,,,,) = chainbills.chainStats();
    (uint256 prevUserChainCount,,,,) = chainbills.users(user);

    vm.expectEmit(true, false, false, true);
    emit InitializedUser(user, prevUsersCount + 1);

    deal(user, ethAmt);
    chainbills.pay{value: ethAmt}(payableId, address(chainbills), ethAmt);

    (uint256 newUsersCount,,,,,) = chainbills.chainStats();
    (uint256 newUserChainCount,,,,) = chainbills.users(user);
    vm.stopPrank();

    assertEq(prevUserChainCount, 0);
    assertEq(newUserChainCount, newUsersCount);
    assertEq(prevUsersCount + 1, newUsersCount);
  }

  function testUserInitOnlyOnce() public {
    vm.startPrank(user);
    (uint256 prevUsersCount,,,,,) = chainbills.chainStats();
    (uint256 prevUserChainCount,,,,) = chainbills.users(user);

    vm.expectEmit(true, false, false, true);
    emit InitializedUser(user, prevUsersCount + 1);
    chainbills.createPayable(new TokenAndAmount[](0));

    (uint256 newUsersCount,,,,,) = chainbills.chainStats();
    (uint256 newUserChainCount,,,,) = chainbills.users(user);

    // creating multiple payables should not trigger
    // multiple user initializations
    chainbills.createPayable(new TokenAndAmount[](0));
    chainbills.createPayable(new TokenAndAmount[](0));

    (uint256 newerUsersCount,,,,,) = chainbills.chainStats();
    (uint256 newerUserChainCount,,,,) = chainbills.users(user);
    vm.stopPrank();

    assertEq(prevUserChainCount, 0);
    assertEq(newUserChainCount, newUsersCount);
    assertEq(prevUsersCount + 1, newUsersCount);
    assertEq(newerUserChainCount, newUserChainCount);
    assertEq(newerUsersCount, newUsersCount);
  }

  function testUserPayableCreation() public {
    vm.startPrank(user);
    (, uint256 prevPayablesCount,,,,) = chainbills.chainStats();
    (, uint256 prevUserPayableCount,,,) = chainbills.users(user);

    vm.expectEmit(false, true, false, true);
    emit CreatedPayable(
      bytes32(0), user, prevPayablesCount + 1, prevUserPayableCount + 1
    );
    bytes32 payableId1 = chainbills.createPayable(new TokenAndAmount[](0));
    bytes32 fetchedP1Id = chainbills.userPayableIds(user, 0);
    (
      address p1Host,
      uint256 p1ChainCount,
      uint256 p1HostCount,
      uint256 p1CreatedAt,
      ,
      ,
      ,
      ,
      ,
    ) = chainbills.payables(payableId1);

    // testing twice to further confirm expected behavior
    vm.expectEmit(false, true, false, true);
    emit CreatedPayable(
      bytes32(0), user, prevPayablesCount + 2, prevUserPayableCount + 2
    );
    bytes32 payableId2 = chainbills.createPayable(new TokenAndAmount[](0));
    bytes32 fetchedP2Id = chainbills.userPayableIds(user, 1);
    (
      address p2Host,
      uint256 p2ChainCount,
      uint256 p2HostCount,
      uint256 p2CreatedAt,
      ,
      ,
      ,
      ,
      ,
    ) = chainbills.payables(payableId2);

    (, uint256 newPayablesCount,,,,) = chainbills.chainStats();
    (, uint256 newUserPayableCount,,,) = chainbills.users(user);
    vm.stopPrank();

    // check stored IDs
    assertEq(payableId1, fetchedP1Id);
    assertEq(payableId2, fetchedP2Id);

    // check counts
    assertEq(prevUserPayableCount, 0);
    assertEq(prevUserPayableCount + 2, newUserPayableCount);
    assertEq(prevPayablesCount, 0);
    assertEq(prevPayablesCount + 2, newPayablesCount);

    // check payable 1's user details
    assertEq(p1Host, user);
    assertEq(p1ChainCount, prevPayablesCount + 1);
    assertEq(p1HostCount, prevUserPayableCount + 1);
    assertGt(p1CreatedAt, 0);
    assertGe(p1CreatedAt, block.timestamp);

    // check payable 2's user details
    assertEq(p2Host, user);
    assertEq(p2ChainCount, prevPayablesCount + 2);
    assertEq(p2HostCount, prevUserPayableCount + 2);
    assertGt(p2CreatedAt, 0);
    assertGe(p2CreatedAt, block.timestamp);
  }

  function testUserMakingFailedPayments() public {
    // create a payable to make payment to. use this test contract as the host.
    bytes32 payableId = chainbills.createPayable(new TokenAndAmount[](0));

    vm.startPrank(user);

    // payment should revert if given token is address zero, or if token is
    // not supported (doesn't have its maxWithdrawalFees updated at least once).
    // NOTE: ETH and USDC are allowed in the top-level setUp function for this
    // test contract.
    vm.expectRevert(InvalidTokenAddress.selector);
    chainbills.pay(payableId, address(0), 0);
    vm.expectRevert(UnsupportedToken.selector);
    chainbills.pay(payableId, address(this), 0);

    // payment should revert if zero amount was requested.
    vm.expectRevert(ZeroAmountSpecified.selector);
    chainbills.pay(payableId, address(chainbills), 0);

    // payment should revert if payable doesn't exist.
    vm.expectRevert(InvalidPayableId.selector);
    chainbills.pay(bytes32(0), address(chainbills), 1);

    // payment should revert if token is native (ETH) and not enough amount
    // is provided in value.
    vm.expectRevert(InsufficientPaymentValue.selector);
    chainbills.pay(payableId, address(chainbills), 1);
    deal(user, 1);
    vm.expectRevert(InsufficientPaymentValue.selector);
    chainbills.pay{value: 1}(payableId, address(chainbills), 2);

    // payment should revert if token is native (ETH) and more than enough
    // amount is provided in value.
    deal(user, 2);
    vm.expectRevert(IncorrectPaymentValue.selector);
    chainbills.pay{value: 2}(payableId, address(chainbills), 1);

    // payment should revert if token is ERC20 and amount is not approved.
    deal(address(usdc), user, 1);
    vm.expectRevert();
    chainbills.pay(payableId, address(usdc), 1);

    vm.stopPrank();
  }

  function testUserMakingSuccessfulPayments() public {
    // create a payable to make payment to. use this test contract as the host.
    bytes32 payableId = chainbills.createPayable(new TokenAndAmount[](0));

    vm.startPrank(user);
    (,, uint256 prevUserPaymentsCount,,,) = chainbills.chainStats();
    (,, uint256 prevUserPaymentCount,,) = chainbills.users(user);
    (,, uint256 prevTotalUserPaidEth, uint256 prevTotalPayableReceivedEth,,) =
      chainbills.tokenDetails(address(chainbills));
    (,, uint256 prevTotalUserPaidUsdc, uint256 prevTotalPayableReceivedUsdc,,) =
      chainbills.tokenDetails(address(usdc));

    // testing successful first payment with native token (ETH)
    deal(user, ethAmt);
    uint256 prevCbEthBal = address(chainbills).balance;
    uint256 prevUserEthBal = user.balance;

    vm.expectEmit(true, true, false, true);
    emit UserPaid(
      payableId,
      user,
      bytes32(0),
      chainId,
      prevUserPaymentsCount + 1,
      prevUserPaymentCount + 1
    );
    bytes32 paymentId1 =
      chainbills.pay{value: ethAmt}(payableId, address(chainbills), ethAmt);

    uint256 newCbEthBal = address(chainbills).balance;
    uint256 newUserEthBal = user.balance;
    bytes32 fetchedP1Id = chainbills.userPaymentIds(user, 0);
    (address p1Token, uint256 p1Amt) = chainbills.userPaymentDetails(paymentId1);
    (
      bytes32 p1PayableId,
      address p1Payer,
      uint16 p1PayableChainId,
      uint256 p1ChainCount,
      uint256 p1PayerCount,
      uint256 p1Timestamp
    ) = chainbills.userPayments(paymentId1);

    // testing successful second payment with ERC20 token (USDC)
    deal(address(usdc), user, usdcAmt);
    usdc.approve(address(chainbills), usdcAmt);
    uint256 prevCbUsdcBal = usdc.balanceOf(address(chainbills));
    uint256 prevUserUsdcBal = usdc.balanceOf(user);

    vm.expectEmit(true, true, false, true);
    emit UserPaid(
      payableId,
      user,
      bytes32(0),
      chainId,
      prevUserPaymentsCount + 2,
      prevUserPaymentCount + 2
    );
    bytes32 paymentId2 = chainbills.pay(payableId, address(usdc), usdcAmt);

    uint256 newCbUsdcBal = usdc.balanceOf(address(chainbills));
    uint256 newUserUsdcBal = usdc.balanceOf(user);
    bytes32 fetchedP2Id = chainbills.userPaymentIds(user, 1);
    (address p2Token, uint256 p2Amt) = chainbills.userPaymentDetails(paymentId2);
    (
      bytes32 p2PayableId,
      address p2Payer,
      uint16 p2PayableChainId,
      uint256 p2ChainCount,
      uint256 p2PayerCount,
      uint256 p2Timestamp
    ) = chainbills.userPayments(paymentId2);

    (,, uint256 newUserPaymentsCount,,,) = chainbills.chainStats();
    (,, uint256 newUserPaymentCount,,) = chainbills.users(user);
    (,, uint256 newTotalUserPaidEth, uint256 newTotalPayableReceivedEth,,) =
      chainbills.tokenDetails(address(chainbills));
    (,, uint256 newTotalUserPaidUsdc, uint256 newTotalPayableReceivedUsdc,,) =
      chainbills.tokenDetails(address(usdc));
    vm.stopPrank();

    // check balances
    assertEq(prevUserEthBal - ethAmt, newUserEthBal);
    assertEq(prevUserUsdcBal - usdcAmt, newUserUsdcBal);
    assertEq(prevCbEthBal + ethAmt, newCbEthBal);
    assertEq(prevCbUsdcBal + usdcAmt, newCbUsdcBal);

    // check stored IDs
    assertEq(paymentId1, fetchedP1Id);
    assertEq(paymentId2, fetchedP2Id);

    // check counts
    assertEq(prevUserPaymentCount, 0);
    assertEq(prevUserPaymentCount + 2, newUserPaymentCount);
    assertEq(prevUserPaymentsCount, 0);
    assertEq(prevUserPaymentsCount + 2, newUserPaymentsCount);

    // check token totals
    assertEq(prevTotalUserPaidEth + ethAmt, newTotalUserPaidEth);
    assertEq(prevTotalPayableReceivedEth + ethAmt, newTotalPayableReceivedEth);
    assertEq(prevTotalUserPaidUsdc + usdcAmt, newTotalUserPaidUsdc);
    assertEq(
      prevTotalPayableReceivedUsdc + usdcAmt, newTotalPayableReceivedUsdc
    );

    // check payment 1's details
    assertEq(p1PayableId, payableId);
    assertEq(p1Payer, user);
    assertEq(p1PayableChainId, chainId);
    assertEq(p1ChainCount, prevUserPaymentsCount + 1);
    assertEq(p1PayerCount, prevUserPaymentCount + 1);
    assertGt(p1Timestamp, 0);
    assertGe(p1Timestamp, block.timestamp);
    assertEq(p1Token, address(chainbills));
    assertEq(p1Amt, ethAmt);

    // check payment 2's details
    assertEq(p2PayableId, payableId);
    assertEq(p2Payer, user);
    assertEq(p2PayableChainId, chainId);
    assertEq(p2ChainCount, prevUserPaymentsCount + 2);
    assertEq(p2PayerCount, prevUserPaymentCount + 2);
    assertGt(p2Timestamp, 0);
    assertGe(p2Timestamp, block.timestamp);
    assertEq(p2Token, address(usdc));
    assertEq(p2Amt, usdcAmt);
  }

  function testUserMakingFailedWithdrawals() public {
    // withdrawal should revert if payable doesn't exist.
    vm.expectRevert(InvalidPayableId.selector);
    chainbills.withdraw(bytes32(0), address(chainbills), 1);

    // create payable to be used for testing failed withdrawals
    bytes32 payableId = chainbills.createPayable(new TokenAndAmount[](0));

    // withdrawal should revert if caller is not the payable's host.
    vm.prank(user);
    vm.expectRevert(NotYourPayable.selector);
    chainbills.withdraw(payableId, address(chainbills), 1);

    // withdrawal should revert if zero amount was requested.
    vm.expectRevert(ZeroAmountSpecified.selector);
    chainbills.withdraw(payableId, address(chainbills), 0);

    // withdrawal should revert if payable hasn't received any payments yet.
    vm.expectRevert(NoBalanceForWithdrawalToken.selector);
    chainbills.withdraw(payableId, address(chainbills), 1);
  }

  function testUserMakingSuccessfulWithdrawals() public {
    // create a payable as the user
    vm.prank(user);
    bytes32 payableId = chainbills.createPayable(new TokenAndAmount[](0));

    (,,,, uint256 prevWithdrawalsCount,) = chainbills.chainStats();
    (,,, uint256 prevUserWithdrawalCount,) = chainbills.users(user);
    (,,,,, uint256 prevPayableWithdrawalCount,,,,) =
      chainbills.payables(payableId);
    (,,,, uint256 prevTotalWithdrawnEth, uint256 prevTotalWthFeesClctdEth) =
      chainbills.tokenDetails(address(chainbills));
    (,,,, uint256 prevTotalWithdrawnUsdc, uint256 prevTotalWthFeesClctdUsdc) =
      chainbills.tokenDetails(address(usdc));

    // make payments as the test contract to the user's payable.
    deal(address(this), ethAmt);
    chainbills.pay{value: ethAmt}(payableId, address(chainbills), ethAmt);

    // withdrawal should revert if payable hasn't received payments in
    // the requested token.
    vm.prank(user);
    vm.expectRevert(NoBalanceForWithdrawalToken.selector);
    chainbills.withdraw(payableId, address(usdc), 1);

    // make payments as the test contract to the user's payable.
    deal(address(usdc), address(this), usdcAmt * 2);
    usdc.approve(address(chainbills), usdcAmt * 2);
    chainbills.pay(payableId, address(usdc), usdcAmt); // paying USDC twice
    chainbills.pay(payableId, address(usdc), usdcAmt); // is intentional
    // to simulate more payments and check balances later.

    // start prank to test withdrawals as user
    vm.startPrank(user);

    // withdrawal should revert if more than available amount was requested.
    vm.expectRevert(InsufficientWithdrawAmount.selector);
    chainbills.withdraw(payableId, address(chainbills), ethAmt * 2);

    // withdrawal should revert if payable doesn't have balance in given token.
    // well specifically for this case, withdrawal should revert if the token
    // is not supported (doesn't have its maxWithdrawalFees updated at least
    // once). Though this is redundant, it is worth having.
    // NOTE: ETH and USDC are allowed in the top-level setUp function for this
    // test contract.
    vm.expectRevert(NoBalanceForWithdrawalToken.selector);
    chainbills.withdraw(payableId, address(this), 1);

    uint256 prevCbEthBal = address(chainbills).balance;
    uint256 prevFeeCollectorEthBal = feeCollector.balance;
    uint256 prevUserEthBal = user.balance;
    uint256 prevCbUsdcBal = usdc.balanceOf(address(chainbills));
    uint256 prevFeeCollectorUsdcBal = usdc.balanceOf(feeCollector);
    uint256 prevUserUsdcBal = usdc.balanceOf(user);

    // testing successful first withdrawal with native token (ETH).
    vm.expectEmit(true, true, false, true);
    emit Withdrew(
      payableId,
      user,
      bytes32(0),
      prevWithdrawalsCount + 1,
      prevUserWithdrawalCount + 1,
      prevPayableWithdrawalCount + 1
    );
    bytes32 wId1 = chainbills.withdraw(payableId, address(chainbills), ethAmt);
    bytes32 fetchedW1Id = chainbills.userWithdrawalIds(user, 0);
    (address w1Token, uint256 w1Amt) = chainbills.withdrawalDetails(wId1);
    (
      bytes32 w1PayableId,
      address w1Host,
      uint256 w1ChainCount,
      uint256 w1HostCount,
      uint256 w1PayableCount,
      uint256 w1Timestamp
    ) = chainbills.withdrawals(wId1);

    // testing successful second withdrawal with ERC20 token (USDC)
    vm.expectEmit(true, true, false, true);
    emit Withdrew(
      payableId,
      user,
      bytes32(0),
      prevWithdrawalsCount + 2,
      prevUserWithdrawalCount + 2,
      prevPayableWithdrawalCount + 2
    );
    bytes32 wId2 = chainbills.withdraw(payableId, address(usdc), usdcAmt);
    bytes32 fetchedW2Id = chainbills.userWithdrawalIds(user, 1);
    (address w2Token, uint256 w2Amt) = chainbills.withdrawalDetails(wId2);
    (
      bytes32 w2PayableId,
      address w2Host,
      uint256 w2ChainCount,
      uint256 w2HostCount,
      uint256 w2PayableCount,
      uint256 w2Timestamp
    ) = chainbills.withdrawals(wId2);

    uint256 newCbEthBal = address(chainbills).balance;
    uint256 newFeeCollectorEthBal = feeCollector.balance;
    uint256 newUserEthBal = user.balance;
    uint256 newCbUsdcBal = usdc.balanceOf(address(chainbills));
    uint256 newFeeCollectorUsdcBal = usdc.balanceOf(feeCollector);
    uint256 newUserUsdcBal = usdc.balanceOf(user);

    (,,,, uint256 newWithdrawalsCount,) = chainbills.chainStats();
    (,,, uint256 newUserWithdrawalCount,) = chainbills.users(user);
    (,,,,, uint256 newPayableWithdrawalCount,,,,) =
      chainbills.payables(payableId);
    (,,,, uint256 newTotalWithdrawnEth, uint256 newTotalWthFeesClctdEth) =
      chainbills.tokenDetails(address(chainbills));
    (,,,, uint256 newTotalWithdrawnUsdc, uint256 newTotalWthFeesClctdUsdc) =
      chainbills.tokenDetails(address(usdc));

    vm.stopPrank();

    // obtain fees and amount due
    uint256 ethPercent = (ethAmt * chainbills.withdrawalFeePercentage()) / 10000;
    uint256 ethFee = ethPercent > ethMaxFee ? ethMaxFee : ethPercent;
    uint256 ethAmtDue = ethAmt - ethFee;
    uint256 usdcPercent =
      (usdcAmt * chainbills.withdrawalFeePercentage()) / 10000;
    uint256 usdcFee = usdcPercent > usdcMaxFee ? usdcMaxFee : usdcPercent;
    uint256 usdcAmtDue = usdcAmt - usdcFee;

    // check balances
    assertEq(prevCbEthBal - ethAmt, newCbEthBal);
    assertEq(prevFeeCollectorEthBal + ethFee, newFeeCollectorEthBal);
    assertEq(prevUserEthBal + ethAmtDue, newUserEthBal);
    assertEq(prevCbUsdcBal - usdcAmt, newCbUsdcBal);
    assertGe(newCbUsdcBal, usdcAmt); // this should pass since we paid twice
    assertEq(prevFeeCollectorUsdcBal + usdcFee, newFeeCollectorUsdcBal);
    assertEq(prevUserUsdcBal + usdcAmtDue, newUserUsdcBal);

    // check stored IDs
    assertEq(wId1, fetchedW1Id);
    assertEq(wId2, fetchedW2Id);

    // check counts
    assertEq(prevUserWithdrawalCount, 0);
    assertEq(prevUserWithdrawalCount + 2, newUserWithdrawalCount);
    assertEq(prevWithdrawalsCount, 0);
    assertEq(prevWithdrawalsCount + 2, newWithdrawalsCount);
    assertEq(prevPayableWithdrawalCount, 0);
    assertEq(prevPayableWithdrawalCount + 2, newPayableWithdrawalCount);

    // check token totals
    assertEq(prevTotalWithdrawnEth + ethAmt, newTotalWithdrawnEth);
    assertEq(prevTotalWthFeesClctdEth + ethFee, newTotalWthFeesClctdEth);
    assertEq(prevTotalWithdrawnUsdc + usdcAmt, newTotalWithdrawnUsdc);
    assertEq(prevTotalWthFeesClctdUsdc + usdcFee, newTotalWthFeesClctdUsdc);

    // check withdrawal 1's details
    assertEq(w1PayableId, payableId);
    assertEq(w1Host, user);
    assertEq(w1ChainCount, prevWithdrawalsCount + 1);
    assertEq(w1HostCount, prevUserWithdrawalCount + 1);
    assertEq(w1PayableCount, prevPayableWithdrawalCount + 1);
    assertGt(w1Timestamp, 0);
    assertGe(w1Timestamp, block.timestamp);
    assertEq(w1Token, address(chainbills));
    assertEq(w1Amt, ethAmt);

    // check withdrawal 2's details
    assertEq(w2PayableId, payableId);
    assertEq(w2Host, user);
    assertEq(w2ChainCount, prevWithdrawalsCount + 2);
    assertEq(w2HostCount, prevUserWithdrawalCount + 2);
    assertEq(w2PayableCount, prevPayableWithdrawalCount + 2);
    assertGt(w2Timestamp, 0);
    assertGe(w2Timestamp, block.timestamp);
    assertEq(w2Token, address(usdc));
    assertEq(w2Amt, usdcAmt);
  }
}
