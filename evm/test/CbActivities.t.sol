// SPDX-License-Identifier: Apache 2
pragma solidity ^0.8.20;

import '@openzeppelin/contracts/token/ERC20/ERC20.sol';
import '@openzeppelin/contracts-upgradeable/access/OwnableUpgradeable.sol';
import '@openzeppelin/contracts/proxy/ERC1967/ERC1967Proxy.sol';
import 'forge-std/Test.sol';
import 'src/Chainbills.sol';

contract CbActivitiesTest is CbStructs, Test {
  Chainbills chainbills;
  uint256 ethAmt = 1e16; // 0.01 ETH
  uint16 feePercent = 200; // 2% (with 2 decimals)
  uint256 maxWtdlFeeEth = 5e17; // 0.5 ETH
  address owner = makeAddr('owner');
  bytes32 payableId;
  address user = makeAddr('user');

  function setUp() public {
    vm.startPrank(owner);
    chainbills = Chainbills(payable(address(new ERC1967Proxy(address(new Chainbills()), ''))));
    chainbills.initialize(makeAddr('fee-collector'), feePercent);
    chainbills.setPayablesLogic(address(new CbPayables()));
    chainbills.setTransactionsLogic(address(new CbTransactions()));
    chainbills.allowPaymentsForToken(address(chainbills));
    chainbills.updateMaxWithdrawalFees(address(chainbills), maxWtdlFeeEth);
    vm.stopPrank();

    deal(user, ethAmt);
    vm.prank(user);
    (payableId,) = chainbills.createPayable(new TokenAndAmount[](0), false);
  }

  function testRecordInitializedUser() public {
    // Using multiple users to test multiple flows
    address userAAddr = makeAddr('userA');
    address userBAddr = makeAddr('userB');

    ChainStats memory chainStatsInitial = chainbills.getChainStats();

    // Create a Payable as userA for contract to record initialized user activity
    vm.prank(userAAddr);
    (bytes32 pybleId,) = chainbills.createPayable(new TokenAndAmount[](0), false);

    ChainStats memory chainStatsAfterA = chainbills.getChainStats();

    // Make a payment to the payable as userB for contract to initialize user activity
    deal(userBAddr, ethAmt);
    vm.prank(userBAddr);
    chainbills.pay{value: ethAmt}(pybleId, address(chainbills), ethAmt);

    ChainStats memory chainStatsAfterB = chainbills.getChainStats();
    User memory userA = chainbills.getUser(userAAddr);
    User memory userB = chainbills.getUser(userBAddr);

    // Make a payment to the payable as userA (for another activity)
    // but to test that contract won't record another initialized user activity
    deal(userAAddr, ethAmt);
    vm.prank(userAAddr);
    chainbills.pay{value: ethAmt}(pybleId, address(chainbills), ethAmt);

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
    (bytes32 pybleId,) = chainbills.createPayable(new TokenAndAmount[](0), false);

    ChainStats memory chainStatsAfter = chainbills.getChainStats();
    User memory userAfter = chainbills.getUser(user);
    Payable memory pyble = chainbills.getPayable(pybleId);

    // Fetch CreatedPayable activity ID
    // subtracting 1 because of 0-based array indexing
    bytes32 chainActvId = chainbills.chainActivityIds(chainStatsAfter.activitiesCount - 1);
    bytes32 userActvId = chainbills.userActivityIds(user, userAfter.activitiesCount - 1);
    bytes32 payableActvId = chainbills.payableActivityIds(pybleId, pyble.activitiesCount - 1);

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
    assertEq(activity.entity, pybleId);
  }

  function testRecordPayment() public {
    ChainStats memory chainStatsInitial = chainbills.getChainStats();
    User memory userInitial = chainbills.getUser(user);
    Payable memory pybleInitial = chainbills.getPayable(payableId);

    // Make a payment to the payable
    vm.prank(user);
    (bytes32 userPaymentId, bytes32 payablePaymentId) =
      chainbills.pay{value: ethAmt}(payableId, address(chainbills), ethAmt);

    ChainStats memory chainStatsAfter = chainbills.getChainStats();
    User memory userAfter = chainbills.getUser(user);
    Payable memory pybleAfter = chainbills.getPayable(payableId);

    // Fetch activity IDs
    bytes32 chainActvIdUser = chainbills.chainActivityIds(chainStatsAfter.activitiesCount - 2);
    bytes32 chainActvIdPayable = chainbills.chainActivityIds(chainStatsAfter.activitiesCount - 1);
    bytes32 userActvId = chainbills.userActivityIds(user, userAfter.activitiesCount - 1);
    bytes32 payableActvId = chainbills.payableActivityIds(payableId, pybleAfter.activitiesCount - 1);

    // Fetch activity records
    ActivityRecord memory activityUser = chainbills.getActivityRecord(chainActvIdUser);
    ActivityRecord memory activityPayable = chainbills.getActivityRecord(chainActvIdPayable);

    // Check the counts of activities
    // 2 for chain because of UserPaid and PayableReceived
    assertEq(chainStatsAfter.activitiesCount, chainStatsInitial.activitiesCount + 2);
    assertEq(userAfter.activitiesCount, userInitial.activitiesCount + 1);
    assertEq(pybleAfter.activitiesCount, pybleInitial.activitiesCount + 1);

    // Confirm that the activity types are UserPaid and PayableReceived
    assert(activityUser.activityType == ActivityType.UserPaid);
    assert(activityPayable.activityType == ActivityType.PayableReceived);

    // Confirm that the activity IDs are the same
    assertEq(chainActvIdUser, userActvId);
    assertEq(chainActvIdPayable, payableActvId);

    // Confirm data contents of UserPaid activity
    // subtracting 1 because UserPaid activity is recorded first
    assertEq(activityUser.chainCount, chainStatsAfter.activitiesCount - 1);
    assertEq(activityUser.userCount, userAfter.activitiesCount);
    // 0 because contract doesn't record payable count for UserPaid activity
    // That's because in cross-chain payments, contract doesn't need that info
    assertEq(activityUser.payableCount, 0);
    assertGt(activityUser.timestamp, 0);
    assertGe(activityUser.timestamp, block.timestamp);
    assertEq(activityUser.entity, userPaymentId);

    // Confirm data contents of PayableReceived activity
    assertEq(activityPayable.chainCount, chainStatsAfter.activitiesCount);
    // 0 because contract doesn't record user count for PayableReceived activity
    // That's because in cross-chain payments, contract doesn't need that info
    assertEq(activityPayable.userCount, 0);
    assertEq(activityPayable.payableCount, pybleAfter.activitiesCount);
    assertGt(activityPayable.timestamp, 0);
    assertGe(activityPayable.timestamp, block.timestamp);
    assertEq(activityPayable.entity, payablePaymentId);
  }

  function testRecordWithdrew() public {
    // Make payment to use for withdrawal
    vm.prank(user);
    chainbills.pay{value: ethAmt}(payableId, address(chainbills), ethAmt);

    ChainStats memory chainStatsInitial = chainbills.getChainStats();
    User memory userInitial = chainbills.getUser(user);
    Payable memory pybleInitial = chainbills.getPayable(payableId);

    // Withdraw
    vm.prank(user);
    (bytes32 withdrawalId) = chainbills.withdraw(payableId, address(chainbills), ethAmt);

    ChainStats memory chainStatsAfter = chainbills.getChainStats();
    User memory userAfter = chainbills.getUser(user);
    Payable memory pybleAfter = chainbills.getPayable(payableId);

    // Fetch activity IDs
    // subtracting 1 because of 0-based array indexing
    bytes32 chainActvId = chainbills.chainActivityIds(chainStatsAfter.activitiesCount - 1);
    bytes32 userActvId = chainbills.userActivityIds(user, userAfter.activitiesCount - 1);
    bytes32 payableActvId = chainbills.payableActivityIds(payableId, pybleAfter.activitiesCount - 1);

    // Fetch activity record
    ActivityRecord memory activity = chainbills.getActivityRecord(chainActvId);

    // Check the counts of activities
    assertEq(chainStatsAfter.activitiesCount, chainStatsInitial.activitiesCount + 1);
    assertEq(userAfter.activitiesCount, userInitial.activitiesCount + 1);
    assertEq(pybleAfter.activitiesCount, pybleInitial.activitiesCount + 1);

    // Confirm that the activity type is Withdrew
    assert(activity.activityType == ActivityType.Withdrew);

    // Confirm that the activity IDs are the same
    assertEq(chainActvId, userActvId);
    assertEq(chainActvId, payableActvId);

    // Confirm data contents of Withdrew activity
    assertEq(activity.chainCount, chainStatsAfter.activitiesCount);
    assertEq(activity.userCount, userAfter.activitiesCount);
    assertEq(activity.payableCount, pybleAfter.activitiesCount);
    assertGt(activity.timestamp, 0);
    assertGe(activity.timestamp, block.timestamp);
    assertEq(activity.entity, withdrawalId);
  }

  function testRecordClosedPayable() public {
    ChainStats memory chainStatsInitial = chainbills.getChainStats();
    User memory userInitial = chainbills.getUser(user);
    Payable memory pybleInitial = chainbills.getPayable(payableId);

    // Close the payable
    vm.prank(user);
    chainbills.closePayable(payableId);

    ChainStats memory chainStatsAfter = chainbills.getChainStats();
    User memory userAfter = chainbills.getUser(user);
    Payable memory pybleAfter = chainbills.getPayable(payableId);

    // Fetch activity IDs
    bytes32 chainActvId = chainbills.chainActivityIds(chainStatsAfter.activitiesCount - 1);
    bytes32 userActvId = chainbills.userActivityIds(user, userAfter.activitiesCount - 1);
    bytes32 payableActvId = chainbills.payableActivityIds(payableId, pybleAfter.activitiesCount - 1);

    // Fetch activity record
    ActivityRecord memory activity = chainbills.getActivityRecord(chainActvId);

    // Check the counts of activities
    assertEq(chainStatsAfter.activitiesCount, chainStatsInitial.activitiesCount + 1);
    assertEq(userAfter.activitiesCount, userInitial.activitiesCount + 1);
    assertEq(pybleAfter.activitiesCount, pybleInitial.activitiesCount + 1);

    // Confirm that the activity type is ClosedPayable
    assert(activity.activityType == ActivityType.ClosedPayable);

    // Confirm that the activity IDs are the same
    assertEq(chainActvId, userActvId);
    assertEq(chainActvId, payableActvId);

    // Confirm data contents of ClosedPayable activity
    assertEq(activity.chainCount, chainStatsAfter.activitiesCount);
    assertEq(activity.userCount, userAfter.activitiesCount);
    assertEq(activity.payableCount, pybleAfter.activitiesCount);
    assertGt(activity.timestamp, 0);
    assertGe(activity.timestamp, block.timestamp);
    assertEq(activity.entity, payableId);
  }

  function testRecordReopenedPayable() public { 
    // Close the payable to reopen it for activity testing
    vm.prank(user);
    chainbills.closePayable(payableId);

    ChainStats memory chainStatsInitial = chainbills.getChainStats();
    User memory userInitial = chainbills.getUser(user);
    Payable memory pybleInitial = chainbills.getPayable(payableId);

    // Reopen the payable
    vm.prank(user);
    chainbills.reopenPayable(payableId);

    ChainStats memory chainStatsAfter = chainbills.getChainStats();
    User memory userAfter = chainbills.getUser(user);
    Payable memory pybleAfter = chainbills.getPayable(payableId);

    // Fetch activity IDs
    bytes32 chainActvId = chainbills.chainActivityIds(chainStatsAfter.activitiesCount - 1);
    bytes32 userActvId = chainbills.userActivityIds(user, userAfter.activitiesCount - 1);
    bytes32 payableActvId = chainbills.payableActivityIds(payableId, pybleAfter.activitiesCount - 1);

    // Fetch activity record
    ActivityRecord memory activity = chainbills.getActivityRecord(chainActvId);

    // Check the counts of activities
    assertEq(chainStatsAfter.activitiesCount, chainStatsInitial.activitiesCount + 1);
    assertEq(userAfter.activitiesCount, userInitial.activitiesCount + 1);
    assertEq(pybleAfter.activitiesCount, pybleInitial.activitiesCount + 1);

    // Confirm that the activity type is ReopenedPayable
    assert(activity.activityType == ActivityType.ReopenedPayable);

    // Confirm that the activity IDs are the same
    assertEq(chainActvId, userActvId);
    assertEq(chainActvId, payableActvId);

    // Confirm data contents of ReopenedPayable activity
    assertEq(activity.chainCount, chainStatsAfter.activitiesCount);
    assertEq(activity.userCount, userAfter.activitiesCount);
    assertEq(activity.payableCount, pybleAfter.activitiesCount);
    assertGt(activity.timestamp, 0);
    assertGe(activity.timestamp, block.timestamp);
    assertEq(activity.entity, payableId);
  }

  function testRecordUpdatedPayableAllowedTokensAndAmounts() public {
    ChainStats memory chainStatsInitial = chainbills.getChainStats();
    User memory userInitial = chainbills.getUser(user);
    Payable memory pybleInitial = chainbills.getPayable(payableId);

    // Update the payable to test the activity
    vm.prank(user);
    chainbills.updatePayableAllowedTokensAndAmounts(payableId, new TokenAndAmount[](0));

    ChainStats memory chainStatsAfter = chainbills.getChainStats();
    User memory userAfter = chainbills.getUser(user);
    Payable memory pybleAfter = chainbills.getPayable(payableId);

    // Fetch activity IDs
    bytes32 chainActvId = chainbills.chainActivityIds(chainStatsAfter.activitiesCount - 1);
    bytes32 userActvId = chainbills.userActivityIds(user, userAfter.activitiesCount - 1);
    bytes32 payableActvId = chainbills.payableActivityIds(payableId, pybleAfter.activitiesCount - 1);

    // Fetch activity record
    ActivityRecord memory activity = chainbills.getActivityRecord(chainActvId);

    // Check the counts of activities
    assertEq(chainStatsAfter.activitiesCount, chainStatsInitial.activitiesCount + 1);
    assertEq(userAfter.activitiesCount, userInitial.activitiesCount + 1);
    assertEq(pybleAfter.activitiesCount, pybleInitial.activitiesCount + 1);

    // Confirm that the activity type is UpdatedPayableAllowedTokensAndAmounts
    assert(activity.activityType == ActivityType.UpdatedPayableAllowedTokensAndAmounts);

    // Confirm that the activity IDs are the same
    assertEq(chainActvId, userActvId);
    assertEq(chainActvId, payableActvId);

    // Confirm data contents of UpdatedPayableAllowedTokensAndAmounts activity
    assertEq(activity.chainCount, chainStatsAfter.activitiesCount);
    assertEq(activity.userCount, userAfter.activitiesCount);
    assertEq(activity.payableCount, pybleAfter.activitiesCount);
    assertGt(activity.timestamp, 0);
    assertGe(activity.timestamp, block.timestamp);
    assertEq(activity.entity, payableId);
  }

  function testRecordUpdatedPayableAutoWithdrawStatus() public {
    ChainStats memory chainStatsInitial = chainbills.getChainStats();
    User memory userInitial = chainbills.getUser(user);
    Payable memory pybleInitial = chainbills.getPayable(payableId);

    // Update the payable to test the activity
    vm.prank(user);
    chainbills.updatePayableAutoWithdraw(payableId, false);

    ChainStats memory chainStatsAfter = chainbills.getChainStats();
    User memory userAfter = chainbills.getUser(user);
    Payable memory pybleAfter = chainbills.getPayable(payableId);

    // Fetch activity IDs
    bytes32 chainActvId = chainbills.chainActivityIds(chainStatsAfter.activitiesCount - 1);
    bytes32 userActvId = chainbills.userActivityIds(user, userAfter.activitiesCount - 1);
    bytes32 payableActvId = chainbills.payableActivityIds(payableId, pybleAfter.activitiesCount - 1);

    // Fetch activity record
    ActivityRecord memory activity = chainbills.getActivityRecord(chainActvId);

    // Check the counts of activities
    assertEq(chainStatsAfter.activitiesCount, chainStatsInitial.activitiesCount + 1);
    assertEq(userAfter.activitiesCount, userInitial.activitiesCount + 1);
    assertEq(pybleAfter.activitiesCount, pybleInitial.activitiesCount + 1);

    // Confirm that the activity type is UpdatedPayableAutoWithdrawStatus
    assert(activity.activityType == ActivityType.UpdatedPayableAutoWithdrawStatus);

    // Confirm that the activity IDs are the same
    assertEq(chainActvId, userActvId);
    assertEq(chainActvId, payableActvId);

    // Confirm data contents of UpdatedPayableAutoWithdrawStatus activity
    assertEq(activity.chainCount, chainStatsAfter.activitiesCount);
    assertEq(activity.userCount, userAfter.activitiesCount);
    assertEq(activity.payableCount, pybleAfter.activitiesCount);
    assertGt(activity.timestamp, 0);
    assertGe(activity.timestamp, block.timestamp);
    assertEq(activity.entity, payableId);
  }
}
