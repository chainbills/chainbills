// SPDX-License-Identifier: Apache 2
pragma solidity ^0.8.20;

import '@openzeppelin/contracts/token/ERC20/ERC20.sol';
import '@openzeppelin/contracts/proxy/ERC1967/ERC1967Proxy.sol';
import 'wormhole/interfaces/IWormhole.sol';
import 'src/CbState.sol';
import 'src/Chainbills.sol';
import 'src/circle/ICircleBridge.sol';
import 'src/circle/IMessageTransmitter.sol';
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

  address circleBridge = makeAddr('circle-bridge');
  address circleTransmitter = makeAddr('transmitter');
  address feeCollector = makeAddr('fee-collector');
  address wormhole = makeAddr('wormhole');
  address user = makeAddr('user');

  uint16 chainId = 10002;
  uint16 feePercent = 200; // 2%, the extra zeros are for decimals.
  uint256 ethAmt = 1e16;
  uint256 ethMaxFee = 5e15;
  uint256 usdcAmt = 1e8;
  uint256 usdcMaxFee = 50e6;
  uint8 wormholeFinality = 200;

  function setUp() public {
    chainbills = Chainbills(payable(address(new ERC1967Proxy(address(new Chainbills()), ''))));

    vm.mockCall(
      circleBridge,
      abi.encodeWithSelector(ICircleBridge.localMessageTransmitter.selector),
      abi.encode(circleTransmitter)
    );
    vm.mockCall(circleTransmitter, abi.encodeWithSelector(IMessageTransmitter.localDomain.selector), abi.encode(1));
    vm.mockCall(
      circleBridge, abi.encodeWithSelector(ICircleBridge.localMinter.selector), abi.encode(makeAddr('token-minter'))
    );

    chainbills.initialize(feeCollector, feePercent);
    chainbills.setupWormholeAndCircle(wormhole, circleBridge, chainId, wormholeFinality);
    usdc = new USDC();

    vm.mockCall(wormhole, abi.encodeWithSelector(IWormhole.messageFee.selector), abi.encode(0));
    vm.mockCall(wormhole, abi.encodeWithSelector(IWormhole.publishMessage.selector), abi.encode(0));

    chainbills.allowPaymentsForToken(address(chainbills));
    chainbills.updateMaxWithdrawalFees(address(chainbills), ethMaxFee);

    chainbills.allowPaymentsForToken(address(usdc));
    chainbills.updateMaxWithdrawalFees(address(usdc), usdcMaxFee);

    chainbills.setPayablesLogic(address(new CbPayables()));
    chainbills.setTransactionsLogic(address(new CbTransactions()));
  }

  function testUserInitOnCreatePayable() public {
    vm.startPrank(user);
    ChainStats memory prevChainStats = chainbills.getChainStats();

    vm.expectEmit(true, false, false, true);
    emit InitializedUser(user, prevChainStats.usersCount + 1);

    chainbills.createPayable(new TokenAndAmount[](0), false);

    ChainStats memory newChainStats = chainbills.getChainStats();
    User memory newUser = chainbills.getUser(user);
    vm.stopPrank();

    assertEq(prevChainStats.usersCount + 1, newChainStats.usersCount);
    assertEq(newChainStats.usersCount, newUser.chainCount);
  }

  function testUserInitOnMakePayment() public {
    // create a payable to make payment to. use this test contract as the host.
    (bytes32 payableId,) = chainbills.createPayable(new TokenAndAmount[](0), false);

    vm.startPrank(user);
    ChainStats memory prevChainStats = chainbills.getChainStats();

    vm.expectEmit(true, false, false, true);
    emit InitializedUser(user, prevChainStats.usersCount + 1);

    deal(user, ethAmt);
    chainbills.pay{value: ethAmt}(payableId, address(chainbills), ethAmt);

    ChainStats memory newChainStats = chainbills.getChainStats();
    User memory newUser = chainbills.getUser(user);
    vm.stopPrank();

    assertEq(newUser.chainCount, newChainStats.usersCount);
    assertEq(prevChainStats.usersCount + 1, newChainStats.usersCount);
  }

  function testUserInitOnlyOnce() public {
    vm.startPrank(user);
    ChainStats memory prevChainStats = chainbills.getChainStats();

    vm.expectEmit(true, false, false, true);
    emit InitializedUser(user, prevChainStats.usersCount + 1);
    chainbills.createPayable(new TokenAndAmount[](0), false);

    ChainStats memory newChainStats = chainbills.getChainStats();
    User memory newUser = chainbills.getUser(user);

    // creating multiple payables should not trigger
    // multiple user initializations
    chainbills.createPayable(new TokenAndAmount[](0), false);
    chainbills.createPayable(new TokenAndAmount[](0), false);

    ChainStats memory newerChainStats = chainbills.getChainStats();
    User memory newerUser = chainbills.getUser(user);
    vm.stopPrank();

    assertEq(prevChainStats.usersCount + 1, newChainStats.usersCount);
    assertEq(newUser.chainCount, newChainStats.usersCount);
    assertEq(newerUser.chainCount, newUser.chainCount);
    assertEq(newerChainStats.usersCount, newChainStats.usersCount);
  }

  function testUserPayableCreation() public {
    vm.startPrank(user);
    ChainStats memory prevChainStats = chainbills.getChainStats();

    vm.expectEmit(false, true, false, true);
    emit CreatedPayable(bytes32(0), user, prevChainStats.payablesCount + 1, 1);
    (bytes32 payableId1,) = chainbills.createPayable(new TokenAndAmount[](0), false);
    bytes32 fetchedP1Id = chainbills.userPayableIds(user, 0);
    Payable memory p1 = chainbills.getPayable(payableId1);

    ChainStats memory newChainStats = chainbills.getChainStats();

    // testing twice to further confirm expected behavior
    vm.expectEmit(false, true, false, true);
    emit CreatedPayable(bytes32(0), user, prevChainStats.payablesCount + 2, 2);
    (bytes32 payableId2,) = chainbills.createPayable(new TokenAndAmount[](0), false);
    bytes32 fetchedP2Id = chainbills.userPayableIds(user, 1);
    Payable memory p2 = chainbills.getPayable(payableId2);

    ChainStats memory newerChainStats = chainbills.getChainStats();
    User memory userDetails = chainbills.getUser(user);
    vm.stopPrank();

    // check stored IDs
    assertEq(payableId1, fetchedP1Id);
    assertEq(payableId2, fetchedP2Id);

    // check counts
    assertEq(prevChainStats.payablesCount, 0);
    assertEq(newChainStats.payablesCount, 1);
    assertEq(newerChainStats.payablesCount, 2);
    assertEq(userDetails.payablesCount, 2);

    // check payable 1's user details
    assertEq(p1.host, user);
    assertEq(p1.chainCount, newChainStats.payablesCount);
    assertEq(p1.hostCount, 1);
    assertGt(p1.createdAt, 0);
    assertGe(p1.createdAt, block.timestamp);

    // check payable 2's user details
    assertEq(p2.host, user);
    assertEq(p2.chainCount, newerChainStats.payablesCount);
    assertEq(p2.hostCount, userDetails.payablesCount);
    assertGt(p2.createdAt, 0);
    assertGe(p2.createdAt, block.timestamp);
  }

  function testUserMakingFailedPayments() public {
    // create a payable to make payment to. use this test contract as the host.
    (bytes32 payableId,) = chainbills.createPayable(new TokenAndAmount[](0), false);

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
    (bytes32 payableId,) = chainbills.createPayable(new TokenAndAmount[](0), false);

    vm.startPrank(user);
    ChainStats memory prevChainStats = chainbills.getChainStats();
    TokenDetails memory prevEthDetails = chainbills.getTokenDetails(address(chainbills));
    TokenDetails memory prevUsdcDetails = chainbills.getTokenDetails(address(usdc));

    // testing successful first payment with native token (ETH)
    deal(user, ethAmt);
    uint256 prevCbEthBal = address(chainbills).balance;
    uint256 prevUserEthBal = user.balance;

    vm.expectEmit(true, true, false, true);
    emit UserPaid(payableId, user, bytes32(0), 0, prevChainStats.userPaymentsCount + 1, 1);
    (bytes32 paymentId1,) = chainbills.pay{value: ethAmt}(payableId, address(chainbills), ethAmt);

    uint256 newCbEthBal = address(chainbills).balance;
    uint256 newUserEthBal = user.balance;
    bytes32 fetchedP1Id = chainbills.userPaymentIds(user, 0);
    UserPayment memory p1 = chainbills.getUserPayment(paymentId1);
    ChainStats memory newChainStats = chainbills.getChainStats();

    // testing successful second payment with ERC20 token (USDC)
    deal(address(usdc), user, usdcAmt);
    usdc.approve(address(chainbills), usdcAmt);
    uint256 prevCbUsdcBal = usdc.balanceOf(address(chainbills));
    uint256 prevUserUsdcBal = usdc.balanceOf(user);

    vm.expectEmit(true, true, false, true);
    emit UserPaid(payableId, user, bytes32(0), 0, newChainStats.userPaymentsCount + 1, 2);
    (bytes32 paymentId2,) = chainbills.pay(payableId, address(usdc), usdcAmt);

    uint256 newCbUsdcBal = usdc.balanceOf(address(chainbills));
    uint256 newUserUsdcBal = usdc.balanceOf(user);
    bytes32 fetchedP2Id = chainbills.userPaymentIds(user, 1);
    UserPayment memory p2 = chainbills.getUserPayment(paymentId2);

    ChainStats memory newerChainStats = chainbills.getChainStats();
    User memory userDetails = chainbills.getUser(user);
    TokenDetails memory newEthDetails = chainbills.getTokenDetails(address(chainbills));
    TokenDetails memory newUsdcDetails = chainbills.getTokenDetails(address(usdc));
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
    assertEq(prevChainStats.userPaymentsCount, 0);
    assertEq(newChainStats.userPaymentsCount, 1);
    assertEq(newerChainStats.userPaymentsCount, 2);
    assertEq(userDetails.paymentsCount, 2);
    assertEq(newerChainStats.userPaymentsCount, userDetails.paymentsCount);

    // check token totals
    assertEq(prevEthDetails.totalUserPaid + ethAmt, newEthDetails.totalUserPaid);
    assertEq(prevEthDetails.totalPayableReceived + ethAmt, newEthDetails.totalPayableReceived);
    assertEq(prevUsdcDetails.totalUserPaid + usdcAmt, newUsdcDetails.totalUserPaid);
    assertEq(prevUsdcDetails.totalPayableReceived + usdcAmt, newUsdcDetails.totalPayableReceived);

    // check payment 1's details
    assertEq(p1.payableId, payableId);
    assertEq(p1.payer, user);
    assertEq(p1.token, address(chainbills));
    assertEq(p1.chainCount, newChainStats.userPaymentsCount);
    assertEq(p1.payerCount, 1);
    assertGt(p1.timestamp, 0);
    assertGe(p1.timestamp, block.timestamp);
    assertEq(p1.amount, ethAmt);

    // check payment 2's details
    assertEq(p2.payableId, payableId);
    assertEq(p2.payer, user);
    assertEq(p2.token, address(usdc));
    assertEq(p2.chainCount, newerChainStats.userPaymentsCount);
    assertEq(p2.payerCount, userDetails.paymentsCount);
    assertGt(p2.timestamp, 0);
    assertGe(p2.timestamp, block.timestamp);
    assertEq(p2.amount, usdcAmt);
  }

  function testUserMakingFailedWithdrawals() public {
    // withdrawal should revert if payable doesn't exist.
    vm.expectRevert(InvalidPayableId.selector);
    chainbills.withdraw(bytes32(0), address(chainbills), 1);

    // create payable to be used for testing failed withdrawals
    (bytes32 payableId,) = chainbills.createPayable(new TokenAndAmount[](0), false);

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
    (bytes32 payableId,) = chainbills.createPayable(new TokenAndAmount[](0), false);

    ChainStats memory prevChainStats = chainbills.getChainStats();
    User memory prevUser = chainbills.getUser(user);
    Payable memory prevPayable = chainbills.getPayable(payableId);
    TokenDetails memory prevEthDetails = chainbills.getTokenDetails(address(chainbills));
    TokenDetails memory prevUsdcDetails = chainbills.getTokenDetails(address(usdc));

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
      prevChainStats.withdrawalsCount + 1,
      prevUser.withdrawalsCount + 1,
      prevPayable.withdrawalsCount + 1
    );
    bytes32 wId1 = chainbills.withdraw(payableId, address(chainbills), ethAmt);
    bytes32 fetchedW1Id = chainbills.userWithdrawalIds(user, 0);
    Withdrawal memory w1 = chainbills.getWithdrawal(wId1);
    ChainStats memory newChainStats = chainbills.getChainStats();
    User memory newUser = chainbills.getUser(user);
    Payable memory newPayable = chainbills.getPayable(payableId);

    // testing successful second withdrawal with ERC20 token (USDC)
    vm.expectEmit(true, true, false, true);
    emit Withdrew(
      payableId,
      user,
      bytes32(0),
      newChainStats.withdrawalsCount + 1,
      newUser.withdrawalsCount + 1,
      newPayable.withdrawalsCount + 1
    );
    bytes32 wId2 = chainbills.withdraw(payableId, address(usdc), usdcAmt);
    bytes32 fetchedW2Id = chainbills.userWithdrawalIds(user, 1);
    Withdrawal memory w2 = chainbills.getWithdrawal(wId2);

    uint256 newCbEthBal = address(chainbills).balance;
    uint256 newFeeCollectorEthBal = feeCollector.balance;
    uint256 newUserEthBal = user.balance;
    uint256 newCbUsdcBal = usdc.balanceOf(address(chainbills));
    uint256 newFeeCollectorUsdcBal = usdc.balanceOf(feeCollector);
    uint256 newUserUsdcBal = usdc.balanceOf(user);

    ChainStats memory newerChainStats = chainbills.getChainStats();
    User memory newerUser = chainbills.getUser(user);
    Payable memory newerPayable = chainbills.getPayable(payableId);
    TokenDetails memory newEthDetails = chainbills.getTokenDetails(address(chainbills));
    TokenDetails memory newUsdcDetails = chainbills.getTokenDetails(address(usdc));

    vm.stopPrank();

    // obtain fees and amount due
    Config memory config = chainbills.getConfig();
    uint256 ethPercent = (ethAmt * config.withdrawalFeePercentage) / 10000;
    uint256 ethFee = ethPercent > ethMaxFee ? ethMaxFee : ethPercent;
    uint256 ethAmtDue = ethAmt - ethFee;
    uint256 usdcPercent = (usdcAmt * config.withdrawalFeePercentage) / 10000;
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
    assertEq(prevChainStats.withdrawalsCount, 0);
    assertEq(newChainStats.withdrawalsCount, 1);
    assertEq(newerChainStats.withdrawalsCount, 2);
    assertEq(prevUser.withdrawalsCount, 0);
    assertEq(newUser.withdrawalsCount, 1);
    assertEq(newerUser.withdrawalsCount, 2);
    assertEq(prevPayable.withdrawalsCount, 0);
    assertEq(newPayable.withdrawalsCount, 1);
    assertEq(newerPayable.withdrawalsCount, 2);
    assert(
      prevChainStats.withdrawalsCount == prevUser.withdrawalsCount
        && prevUser.withdrawalsCount == prevPayable.withdrawalsCount
    );
    assert(
      newChainStats.withdrawalsCount == newUser.withdrawalsCount
        && newUser.withdrawalsCount == newPayable.withdrawalsCount
    );
    assert(
      newerChainStats.withdrawalsCount == newerUser.withdrawalsCount
        && newerUser.withdrawalsCount == newerPayable.withdrawalsCount
    );

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
    assertEq(w1.hostCount, newUser.withdrawalsCount);
    assertEq(w1.payableCount, newPayable.withdrawalsCount);
    assertGt(w1.timestamp, 0);
    assertGe(w1.timestamp, block.timestamp);
    assertEq(w1.amount, ethAmt);

    // check withdrawal 2's details
    assertEq(w2.payableId, payableId);
    assertEq(w2.host, user);
    assertEq(w2.token, address(usdc));
    assertEq(w2.chainCount, newerChainStats.withdrawalsCount);
    assertEq(w2.hostCount, newerUser.withdrawalsCount);
    assertEq(w2.payableCount, newerPayable.withdrawalsCount);
    assertGt(w2.timestamp, 0);
    assertGe(w2.timestamp, block.timestamp);
    assertEq(w2.amount, usdcAmt);
  }
}
