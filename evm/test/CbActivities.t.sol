// SPDX-License-Identifier: Apache 2
pragma solidity ^0.8.20;

import '@openzeppelin/contracts/token/ERC20/ERC20.sol';
import '@openzeppelin/contracts-upgradeable/access/OwnableUpgradeable.sol';
import '@openzeppelin/contracts/proxy/ERC1967/ERC1967Proxy.sol';
import 'forge-std/Test.sol';
import 'src/Chainbills.sol';
import 'src/CbPayables.sol';
import 'src/CbTransactions.sol';

contract USDC is ERC20 {
  constructor() ERC20('USDC', 'USDC') {}

  function decimals() public view virtual override returns (uint8) {
    return 6;
  }
}

contract CbActivitiesTest is Test {
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

    deal(user, ethAmt * 2);
    deal(address(usdc), user, usdcAmt * 2);
    vm.startPrank(user);
    usdc.approve(address(chainbills), usdcAmt * 2);

    // Creating a payable so that initialized user activity is recorded
    chainbills.createPayable(new TokenAndAmount[](0), false);
    vm.stopPrank();
  }

  function testRecordInitializedUser() public {
    // Using multiple users to test multiple flows
    address userAAddr = makeAddr('userA');
    address userBAddr = makeAddr('userB');

    ChainStats memory chainStatsInitial = chainbills.getChainStats();

    // Create a Payable as userA for contract to record initialized user activity
    vm.prank(userAAddr);
    (bytes32 payableId,) = chainbills.createPayable(new TokenAndAmount[](0), false);

    ChainStats memory chainStatsAfterA = chainbills.getChainStats();

    // Make a payment to the payable as userB for contract to initialize user activity
    deal(userBAddr, ethAmt);
    vm.prank(userBAddr);
    chainbills.pay{value: ethAmt}(payableId, address(chainbills), ethAmt);

    ChainStats memory chainStatsAfterB = chainbills.getChainStats();
    User memory userA = chainbills.getUser(userAAddr);
    User memory userB = chainbills.getUser(userBAddr);

    // Make a payment to the payable as userA (for another activity)
    // but to test that contract won't record another initialized user activity
    deal(userAAddr, ethAmt);
    vm.prank(userAAddr);
    chainbills.pay{value: ethAmt}(payableId, address(chainbills), ethAmt);

    ChainStats memory chainStatsAfterA2 = chainbills.getChainStats();
    User memory userA2 = chainbills.getUser(userAAddr);

    // Create a new payable as userB (for another activity)
    // to test that the contract won't record another initialized user activity
    vm.prank(userBAddr);
    chainbills.createPayable(new TokenAndAmount[](0), false);

    ChainStats memory chainStatsAfterB2 = chainbills.getChainStats();
    User memory userB2 = chainbills.getUser(userBAddr);

    // Fetch initialized user activity IDs
    // subtracting to account for multiple recorded activities:
    //  - initialized user, and either
    //  - just created payable (after A), or
    //  - both user paid and payable received (after B).
    bytes32 chainActvIdA = chainbills.chainActivityIds(chainStatsAfterA.activitiesCount - 2);
    bytes32 chainActvIdB = chainbills.chainActivityIds(chainStatsAfterB.activitiesCount - 3);
    // payable received is not recorded for user activity so only 2 activities are recorded
    // that is initialized user and either created payable or user paid
    bytes32 userActvIdA = chainbills.userActivityIds(userAAddr, userA.activitiesCount - 2);
    bytes32 userActvIdB = chainbills.userActivityIds(userBAddr, userB.activitiesCount - 2);
    // substracting to account for just one involved activity
    bytes32 userActvIdA2 = chainbills.userActivityIds(userAAddr, userA2.activitiesCount - 1);
    bytes32 userActvIdB2 = chainbills.userActivityIds(userBAddr, userB2.activitiesCount - 1);

    // Fetch activity records
    ActivityRecord memory actvA = chainbills.getActivityRecord(chainActvIdA);
    ActivityRecord memory actvB = chainbills.getActivityRecord(chainActvIdB);
    ActivityRecord memory actvA2 = chainbills.getActivityRecord(userActvIdA2);
    ActivityRecord memory actvB2 = chainbills.getActivityRecord(userActvIdB2);

    // Check the counts of activities
    // 2 because of init user and created payable
    assertEq(chainStatsAfterA.activitiesCount, chainStatsInitial.activitiesCount + 2);
    // 3 because of init user, user paid, and payable received
    assertEq(chainStatsAfterB.activitiesCount, chainStatsAfterA.activitiesCount + 3);
    // 2 because of user paid and payable received only
    assertEq(chainStatsAfterA2.activitiesCount, chainStatsAfterB.activitiesCount + 2);
    // 1 because of created payable only
    assertEq(chainStatsAfterB2.activitiesCount, chainStatsAfterA2.activitiesCount + 1);

    // should be 2 because of init user and involved action
    assertEq(userA.activitiesCount, 2);
    assertEq(userB.activitiesCount, 2);
    // should be only 1 addition because of only involved action
    assertEq(userA2.activitiesCount, userA.activitiesCount + 1);
    assertEq(userB2.activitiesCount, userB.activitiesCount + 1);

    // Check that the chain and user activity IDs for user initialization are the same
    assertEq(chainActvIdA, userActvIdA);
    assertEq(chainActvIdB, userActvIdB);

    // Confirm that the activity types are initialized user
    assert(actvA.activityType == ActivityType.InitializedUser);
    assert(actvB.activityType == ActivityType.InitializedUser);

    // Confirm that the consequent user activities are not initialized user again
    assert(actvA2.activityType != ActivityType.InitializedUser);
    assert(actvB2.activityType != ActivityType.InitializedUser);

    // Confirm data contents of user A's initialized user activity
    assertEq(actvA.chainCount, chainStatsAfterA.activitiesCount - 1);
    assertEq(actvA.userCount, userA.activitiesCount - 1);
    assertEq(actvA.payableCount, 0); // No payable is involved in user initialization
    assertGt(actvA.timestamp, 0);
    assertGe(actvA.timestamp, block.timestamp);
    assertEq(actvA.entity, toWormholeFormat(userAAddr));

    // Confirm data contents of user B's initialized user activity
    // subtracting 2 instead of only 1 because PayableReceived was recorded during payment
    assertEq(actvB.chainCount, chainStatsAfterB.activitiesCount - 2);
    assertEq(actvB.userCount, userB.activitiesCount - 1);
    assertEq(actvB.payableCount, 0); // No payable is involved in user initialization
    assertGt(actvB.timestamp, 0);
    assertGe(actvB.timestamp, block.timestamp);
    assertEq(actvB.entity, toWormholeFormat(userBAddr));
  }

  function testRecordCreatedPayable() public {
    ChainStats memory chainStatsInitial = chainbills.getChainStats();
    User memory userInitial = chainbills.getUser(user);

    // Create a Payable to record CreatedPayable activity
    vm.prank(user);
    (bytes32 payableId,) = chainbills.createPayable(new TokenAndAmount[](0), false);

    ChainStats memory chainStatsAfter = chainbills.getChainStats();
    User memory userAfter = chainbills.getUser(user);
    Payable memory pyble = chainbills.getPayable(payableId);

    // Fetch CreatedPayable activity ID
    // subtracting 1 because of 0-based array indexing
    bytes32 chainActvId = chainbills.chainActivityIds(chainStatsAfter.activitiesCount - 1);
    bytes32 userActvId = chainbills.userActivityIds(user, userAfter.activitiesCount - 1);
    bytes32 payableActvId = chainbills.payableActivityIds(payableId, pyble.activitiesCount - 1);

    // Fetch activity record
    ActivityRecord memory activity = chainbills.getActivityRecord(chainActvId);

    // Check the counts of activities
    assertEq(chainStatsAfter.activitiesCount, chainStatsInitial.activitiesCount + 1);
    assertEq(userAfter.activitiesCount, userInitial.activitiesCount + 1);
    assertEq(pyble.activitiesCount, 1); // 1 because of created payable

    // Confirm that the activity type is CreatedPayable
    assert(activity.activityType == ActivityType.CreatedPayable);

    // Confirm that the activity IDs are the same
    assertEq(chainActvId, userActvId);
    assertEq(chainActvId, payableActvId);

    // Confirm data contents of CreatedPayable activity
    assertEq(activity.chainCount, chainStatsAfter.activitiesCount);
    assertEq(activity.userCount, userAfter.activitiesCount);
    assertEq(activity.payableCount, pyble.activitiesCount);
    assertGt(activity.timestamp, 0);
    assertGe(activity.timestamp, block.timestamp);
    assertEq(activity.entity, payableId);
  }

  function testRecordUserPaid() public {}

  function testRecordPayableReceived() public {}

  function testRecordWithdrew() public {}

  function testRecordClosedPayable() public {}

  function testRecordReopenedPayable() public {}

  function testRecordUpdatedPayableAllowedTokensAndAmounts() public {}

  function testRecordUpdatedPayableAutoWithdrawStatus() public {}
}
