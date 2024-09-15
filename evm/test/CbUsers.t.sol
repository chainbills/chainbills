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

    // calling updateMaxWithdrawalFee with contract address and USDC
    // is to allow native token (ETH) and ERC20 to be used for payments
    chainbills.updateMaxWithdrawalFee(address(chainbills), ethMaxFee);
    chainbills.updateMaxWithdrawalFee(address(usdc), usdcMaxFee);
  }

  function testUserInitOnCreatePayable() public {
    vm.startPrank(user);
    (uint256 prevUserChainCount,,,) = chainbills.users(user);
    (uint256 prevUsersCount,,,) = chainbills.chainStats();

    vm.expectEmit(true, false, false, true);
    emit InitializedUser(user, prevUsersCount + 1);

    chainbills.createPayable(new TokenAndAmount[](0));

    (uint256 newUserChainCount,,,) = chainbills.users(user);
    (uint256 newUsersCount,,,) = chainbills.chainStats();
    vm.stopPrank();

    assertEq(prevUserChainCount, 0);
    assertEq(newUserChainCount, newUsersCount);
    assertEq(prevUsersCount + 1, newUsersCount);
  }

  function testUserInitOnMakePayment() public {
    // create a payable to make payment to. use this test contract as the host.
    bytes32 payableId = chainbills.createPayable(new TokenAndAmount[](0));

    vm.startPrank(user);
    (uint256 prevUserChainCount,,,) = chainbills.users(user);
    (uint256 prevUsersCount,,,) = chainbills.chainStats();

    vm.expectEmit(true, false, false, true);
    emit InitializedUser(user, prevUsersCount + 1);

    deal(user, ethAmt);
    chainbills.pay{value: ethAmt}(payableId, address(chainbills), ethAmt);

    (uint256 newUserChainCount,,,) = chainbills.users(user);
    (uint256 newUsersCount,,,) = chainbills.chainStats();
    vm.stopPrank();

    assertEq(prevUserChainCount, 0);
    assertEq(newUserChainCount, newUsersCount);
    assertEq(prevUsersCount + 1, newUsersCount);
  }

  function testUserInitOnlyOnce() public {
    vm.startPrank(user);
    (uint256 prevUserChainCount,,,) = chainbills.users(user);
    (uint256 prevUsersCount,,,) = chainbills.chainStats();

    vm.expectEmit(true, false, false, true);
    emit InitializedUser(user, prevUsersCount + 1);
    chainbills.createPayable(new TokenAndAmount[](0));

    (uint256 newUserChainCount,,,) = chainbills.users(user);
    (uint256 newUsersCount,,,) = chainbills.chainStats();

    // creating multiple payables should not trigger
    // multiple user initializations
    chainbills.createPayable(new TokenAndAmount[](0));
    chainbills.createPayable(new TokenAndAmount[](0));

    (uint256 newerUserChainCount,,,) = chainbills.users(user);
    (uint256 newerUsersCount,,,) = chainbills.chainStats();
    vm.stopPrank();

    assertEq(prevUserChainCount, 0);
    assertEq(newUserChainCount, newUsersCount);
    assertEq(prevUsersCount + 1, newUsersCount);
    assertEq(newerUserChainCount, newUserChainCount);
    assertEq(newerUsersCount, newUsersCount);
  }

  function testUserPayableCreation() public {
    vm.startPrank(user);
    (, uint256 prevUserPayableCount,,) = chainbills.users(user);
    (, uint256 prevPayablesCount,,) = chainbills.chainStats();

    vm.expectEmit(false, true, false, true);
    emit CreatedPayable(
      bytes32(0), user, prevPayablesCount + 1, prevUserPayableCount + 1
    );
    bytes32 payableId1 = chainbills.createPayable(new TokenAndAmount[](0));
    (
      address p1Host,
      uint256 p1ChainCount,
      uint256 p1HostCount,
      uint256 p1CreatedAt,
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
    (
      address p2Host,
      uint256 p2ChainCount,
      uint256 p2HostCount,
      uint256 p2CreatedAt,
      ,
      ,
      ,
      ,
    ) = chainbills.payables(payableId2);

    (, uint256 newUserPayableCount,,) = chainbills.users(user);
    (, uint256 newPayablesCount,,) = chainbills.chainStats();
    vm.stopPrank();

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

  function testUserMakingPayment() public {
    // create a payable to make payment to. use this test contract as the host.
    bytes32 payableId = chainbills.createPayable(new TokenAndAmount[](0));

    vm.startPrank(user);
    (,, uint256 prevUserPaymentCount,) = chainbills.users(user);
    (,, uint256 prevPaymentsCount,) = chainbills.chainStats();
    (,,,, uint256 prevPayablePaymentsCount,,,,) = chainbills.payables(payableId);

    // payment should revert if given token is address zero, or if token is
    // not allowed (doesn't have its maxWithdrawalFee set).
    // NOTE: ETH and USDC are allowed in the top-level setUp function for this
    // test contract.
    vm.expectRevert(InvalidTokenAddress.selector);
    chainbills.pay(payableId, address(0), 0);
    vm.expectRevert(InvalidTokenAddress.selector);
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
      prevPaymentsCount + 1,
      prevUserPaymentCount + 1
    );
    bytes32 paymentId1 =
      chainbills.pay{value: ethAmt}(payableId, address(chainbills), ethAmt);

    uint256 newCbEthBal = address(chainbills).balance;
    uint256 newUserEthBal = user.balance;
    (
      bytes32 p1PayableId,
      address p1Payer,
      uint16 p1PayableChainId,
      uint256 p1ChainCount,
      uint256 p1PayerCount,
      uint256 p1PayableCount,
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
      prevPaymentsCount + 2,
      prevUserPaymentCount + 2
    );
    bytes32 paymentId2 = chainbills.pay(payableId, address(usdc), usdcAmt);

    uint256 newCbUsdcBal = usdc.balanceOf(address(chainbills));
    uint256 newUserUsdcBal = usdc.balanceOf(user);
    (
      bytes32 p2PayableId,
      address p2Payer,
      uint16 p2PayableChainId,
      uint256 p2ChainCount,
      uint256 p2PayerCount,
      uint256 p2PayableCount,
      uint256 p2Timestamp
    ) = chainbills.userPayments(paymentId2);

    (,, uint256 newUserPaymentCount,) = chainbills.users(user);
    (,, uint256 newPaymentsCount,) = chainbills.chainStats();
    vm.stopPrank();

    // check balances
    assertEq(prevUserEthBal - ethAmt, newUserEthBal);
    assertEq(prevUserUsdcBal - usdcAmt, newUserUsdcBal);
    assertEq(prevCbEthBal + ethAmt, newCbEthBal);
    assertEq(prevCbUsdcBal + usdcAmt, newCbUsdcBal);

    // check counts
    assertEq(prevUserPaymentCount, 0);
    assertEq(prevUserPaymentCount + 2, newUserPaymentCount);
    assertEq(prevPaymentsCount, 0);
    assertEq(prevPaymentsCount + 2, newPaymentsCount);

    // check payment 1's details
    assertEq(p1PayableId, payableId);
    assertEq(p1Payer, user);
    assertEq(p1PayableChainId, chainId);
    assertEq(p1ChainCount, prevPaymentsCount + 1);
    assertEq(p1PayerCount, prevUserPaymentCount + 1);
    assertEq(p1PayableCount, prevPayablePaymentsCount + 1);
    assertGt(p1Timestamp, 0);
    assertGe(p1Timestamp, block.timestamp);

    // check payment 2's details
    assertEq(p2PayableId, payableId);
    assertEq(p2Payer, user);
    assertEq(p2PayableChainId, chainId);
    assertEq(p2ChainCount, prevPaymentsCount + 2);
    assertEq(p2PayerCount, prevUserPaymentCount + 2);
    assertEq(p2PayableCount, prevPayablePaymentsCount + 2);
    assertGt(p2Timestamp, 0);
    assertGe(p2Timestamp, block.timestamp);
  }

  function testUserMakingWithdrawal() public {
    vm.startPrank(user);
    (,,, uint256 prevUserWithdrawalCount) = chainbills.users(user);
    (,,, uint256 prevWithdrawalsCount) = chainbills.chainStats();
    bytes32 payableId = chainbills.createPayable(new TokenAndAmount[](0));
    (,,,,, uint256 prevPayableWithdrawalCount,,,) =
      chainbills.payables(payableId);

    // withdrawal should revert if payable doesn't exist.
    vm.expectRevert(InvalidPayableId.selector);
    chainbills.withdraw(bytes32(0), address(chainbills), 1);

    // withdrawal should revert if payable hasn't received payments in
    // the requested token.
    vm.expectRevert(NoBalanceForWithdrawalToken.selector);
    chainbills.withdraw(payableId, address(chainbills), 1);
    vm.expectRevert(NoBalanceForWithdrawalToken.selector);
    chainbills.withdraw(payableId, address(usdc), 1);

    // stop user's prank to simulate a failed withdrawal with this contract's 
    // address as the caller and also to make payments to the payable
    // with this contract's address as the caller too.
    vm.stopPrank();

    // withdrawal should revert if caller is not the payable's host.
    vm.expectRevert(NotYourPayable.selector);
    chainbills.withdraw(payableId, address(chainbills), 1);

    // make payments as the test contract to the user's payable.
    deal(address(this), ethAmt);
    chainbills.pay{value: ethAmt}(payableId, address(chainbills), ethAmt);
    deal(address(usdc), address(this), usdcAmt * 2);
    usdc.approve(address(chainbills), usdcAmt * 2);
    chainbills.pay(payableId, address(usdc), usdcAmt); // paying USDC twice
    chainbills.pay(payableId, address(usdc), usdcAmt); // is intentional
    // to simulate more payments and check balances later.

    // resume prank to continue testing withdrawals as user
    vm.startPrank(user);

    // withdrawal should revert if zero amount was requested.
    vm.expectRevert(ZeroAmountSpecified.selector);
    chainbills.withdraw(payableId, address(chainbills), 0);

    // withdrawal should revert if payable doesn't have balance in given token.
    // well specifically for this case, if the token is not supported (doesn't 
    // have maxWithdrawalFee set). though this is redundant, it is worth having.
    vm.expectRevert(NoBalanceForWithdrawalToken.selector);
    chainbills.withdraw(payableId, address(this), 1);

    // withdrawal should revert if more than available amount was requested.
    vm.expectRevert(InsufficientWithdrawAmount.selector);
    chainbills.withdraw(payableId, address(chainbills), ethAmt * 2);

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

    (,,, uint256 newUserWithdrawalCount) = chainbills.users(user);
    (,,, uint256 newWithdrawalsCount) = chainbills.chainStats();
    (,,,,, uint256 newPayableWithdrawalCount,,,) =
      chainbills.payables(payableId);

    vm.stopPrank();

    // obtain fees and amount due
    uint256 ethPercent = (ethAmt * WITHDRAWAL_FEE_PERCENTAGE) / 100;
    uint256 ethFee = ethPercent > ethMaxFee ? ethMaxFee : ethPercent;
    uint256 ethAmtDue = ethAmt - ethFee;
    uint256 usdcPercent = (usdcAmt * WITHDRAWAL_FEE_PERCENTAGE) / 100;
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

    // check counts
    assertEq(prevUserWithdrawalCount, 0);
    assertEq(prevUserWithdrawalCount + 2, newUserWithdrawalCount);
    assertEq(prevWithdrawalsCount, 0);
    assertEq(prevWithdrawalsCount + 2, newWithdrawalsCount);
    assertEq(prevPayableWithdrawalCount, 0);
    assertEq(prevPayableWithdrawalCount + 2, newPayableWithdrawalCount);

    // check withdrawal 1's details
    assertEq(w1PayableId, payableId);
    assertEq(w1Host, user);
    assertEq(w1ChainCount, prevWithdrawalsCount + 1);
    assertEq(w1HostCount, prevUserWithdrawalCount + 1);
    assertEq(w1PayableCount, prevPayableWithdrawalCount + 1);
    assertGt(w1Timestamp, 0);
    assertGe(w1Timestamp, block.timestamp);

    // check withdrawal 2's details
    assertEq(w2PayableId, payableId);
    assertEq(w2Host, user);
    assertEq(w2ChainCount, prevWithdrawalsCount + 2);
    assertEq(w2HostCount, prevUserWithdrawalCount + 2);
    assertEq(w2PayableCount, prevPayableWithdrawalCount + 2);
    assertGt(w2Timestamp, 0);
    assertGe(w2Timestamp, block.timestamp);
  }
}
