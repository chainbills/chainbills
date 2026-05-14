// SPDX-License-Identifier: Apache 2
pragma solidity ^0.8.30;

import {ERC1967Proxy} from '@openzeppelin/contracts/proxy/ERC1967/ERC1967Proxy.sol';
import {Test} from 'forge-std/Test.sol';
import {Chainbills} from 'src/Chainbills.sol';
import {CbGetters} from 'src/CbGetters.sol';
import {CbStructs} from 'src/CbStructs.sol';
import {CbPayables} from 'src/CbPayables.sol';
import {CbTransactions} from 'src/CbTransactions.sol';
import {toWormholeFormat} from 'wormhole/Utils.sol';

contract CbActivitiesTest is CbStructs, Test {
  Chainbills chainbills;
  CbGetters cbGetters;
  uint256 ethAmt = 1e16; // 0.01 ETH
  uint16 feePercent = 200; // 2% (with 2 decimals)
  uint256 maxWtdlFeeEth = 5e17; // 0.5 ETH
  address owner = makeAddr('owner');
  bytes32 payableId;
  address user = makeAddr('user');

  // Blank Test Function to exclude this Test contract itself from test coverage reports.
  function test() public {}

  function setUp() public {
    vm.startPrank(owner);
    chainbills = Chainbills(payable(address(new ERC1967Proxy(address(new Chainbills()), ''))));
    chainbills.initialize(makeAddr('fee-collector'), feePercent);
    chainbills.setPayablesLogic(address(new CbPayables()));
    chainbills.setTransactionsLogic(address(new CbTransactions()));
    chainbills.allowPaymentsForToken(address(chainbills));
    chainbills.updateMaxWithdrawalFees(address(chainbills), maxWtdlFeeEth);
    cbGetters = new CbGetters(address(chainbills));
    vm.stopPrank();

    deal(user, ethAmt);
    vm.prank(user);
    (payableId,) = chainbills.createPayable(new TokenAndAmount[](0), false);
  }

  // Tests that the first user interaction records an InitializedUser activity.
  function testInitializedUserOnFirstInteraction() public {
    address userA = makeAddr('userA');
    address userB = makeAddr('userB');

    uint256 chainInit = cbGetters.getChainStats().activitiesCount;

    // User A creates payable — first interaction.
    vm.prank(userA);
    (bytes32 pybleId,) = chainbills.createPayable(new TokenAndAmount[](0), false);

    uint256 chainA = cbGetters.getChainStats().activitiesCount;
    uint256 uCountA = cbGetters.getUser(userA).activitiesCount;
    // 2: InitializedUser + CreatedPayable
    assertEq(chainA, chainInit + 2);
    assertEq(uCountA, 2);

    // User B pays — first interaction.
    deal(userB, ethAmt);
    vm.prank(userB);
    chainbills.pay{value: ethAmt}(pybleId, address(chainbills), ethAmt);

    uint256 chainB = cbGetters.getChainStats().activitiesCount;
    uint256 uCountB = cbGetters.getUser(userB).activitiesCount;
    // 3: InitializedUser + UserPaid + PayableReceived
    assertEq(chainB, chainA + 3);
    assertEq(uCountB, 2);

    bytes32 chainActvIdA = cbGetters.chainActivityIdsPaginated(chainA - 2, 1)[0];
    bytes32 chainActvIdB = cbGetters.chainActivityIdsPaginated(chainB - 3, 1)[0];

    // Chain ID must match user ID for the InitializedUser activity.
    assertEq(chainActvIdA, cbGetters.userActivityIdsPaginated(userA, uCountA - 2, 1)[0]);
    assertEq(chainActvIdB, cbGetters.userActivityIdsPaginated(userB, uCountB - 2, 1)[0]);

    // Check user A's InitializedUser activity record.
    ActivityRecord memory r = cbGetters.getActivityRecord(chainActvIdA);
    assert(r.activityType == ActivityType.InitializedUser);
    assertEq(r.chainCount, chainA - 1);
    assertEq(r.userCount, uCountA - 1);
    assertEq(r.payableCount, 0);
    assertGt(r.timestamp, 0);
    assertGe(r.timestamp, block.timestamp);
    assertEq(r.entity, toWormholeFormat(userA));

    // Check user B's InitializedUser activity record.
    r = cbGetters.getActivityRecord(chainActvIdB);
    assert(r.activityType == ActivityType.InitializedUser);
    // subtract 2 because PayableReceived was recorded during payment
    assertEq(r.chainCount, chainB - 2);
    assertEq(r.userCount, uCountB - 1);
    assertEq(r.payableCount, 0);
    assertGt(r.timestamp, 0);
    assertGe(r.timestamp, block.timestamp);
    assertEq(r.entity, toWormholeFormat(userB));
  }

  // Tests that subsequent interactions do NOT record another InitializedUser activity.
  function testInitializedUserNotRepeatedOnSubsequentInteractions() public {
    address userA = makeAddr('userA');
    address userB = makeAddr('userB');

    // Initial interactions to initialize both users.
    vm.prank(userA);
    (bytes32 pybleId,) = chainbills.createPayable(new TokenAndAmount[](0), false);
    deal(userB, ethAmt);
    vm.prank(userB);
    chainbills.pay{value: ethAmt}(pybleId, address(chainbills), ethAmt);

    uint256 uCountA = cbGetters.getUser(userA).activitiesCount;
    uint256 uCountB = cbGetters.getUser(userB).activitiesCount;
    uint256 chainCount = cbGetters.getChainStats().activitiesCount;

    // User A pays again (second interaction).
    deal(userA, ethAmt);
    vm.prank(userA);
    chainbills.pay{value: ethAmt}(pybleId, address(chainbills), ethAmt);

    uint256 uCountA2 = cbGetters.getUser(userA).activitiesCount;
    // Only 1 new activity (UserPaid), not an additional InitializedUser.
    assertEq(uCountA2, uCountA + 1);
    // 2 chain activities: UserPaid + PayableReceived.
    assertEq(cbGetters.getChainStats().activitiesCount, chainCount + 2);

    // Check that the new activity for A is NOT InitializedUser.
    bytes32 actIdA2 = cbGetters.userActivityIdsPaginated(userA, uCountA2 - 1, 1)[0];
    assert(cbGetters.getActivityRecord(actIdA2).activityType != ActivityType.InitializedUser);

    uint256 chainCount2 = cbGetters.getChainStats().activitiesCount;

    // User B creates a payable (second interaction).
    vm.prank(userB);
    chainbills.createPayable(new TokenAndAmount[](0), false);

    uint256 uCountB2 = cbGetters.getUser(userB).activitiesCount;
    // Only 1 new activity (CreatedPayable), not an additional InitializedUser.
    assertEq(uCountB2, uCountB + 1);
    assertEq(cbGetters.getChainStats().activitiesCount, chainCount2 + 1);

    // Check that the new activity for B is NOT InitializedUser.
    bytes32 actIdB2 = cbGetters.userActivityIdsPaginated(userB, uCountB2 - 1, 1)[0];
    assert(cbGetters.getActivityRecord(actIdB2).activityType != ActivityType.InitializedUser);
  }

  function testRecordCreatedPayable() public {
    uint256 initChain = cbGetters.getChainStats().activitiesCount;
    uint256 initUser = cbGetters.getUser(user).activitiesCount;

    vm.prank(user);
    (bytes32 pybleId,) = chainbills.createPayable(new TokenAndAmount[](0), false);

    uint256 chainCount = cbGetters.getChainStats().activitiesCount;
    uint256 userCount = cbGetters.getUser(user).activitiesCount;
    uint256 pybleCount = cbGetters.getPayable(pybleId).activitiesCount;

    assertEq(chainCount, initChain + 1);
    assertEq(userCount, initUser + 1);
    assertEq(pybleCount, 1);

    bytes32 chainActvId = cbGetters.chainActivityIdsPaginated(chainCount - 1, 1)[0];
    assertEq(chainActvId, cbGetters.userActivityIdsPaginated(user, userCount - 1, 1)[0]);
    assertEq(chainActvId, cbGetters.payableActivityIdsPaginated(pybleId, pybleCount - 1, 1)[0]);

    ActivityRecord memory r = cbGetters.getActivityRecord(chainActvId);
    assert(r.activityType == ActivityType.CreatedPayable);
    assertEq(r.chainCount, chainCount);
    assertEq(r.userCount, userCount);
    assertEq(r.payableCount, pybleCount);
    assertGt(r.timestamp, 0);
    assertGe(r.timestamp, block.timestamp);
    assertEq(r.entity, pybleId);
  }

  function testRecordPayment() public {
    uint256 initChain = cbGetters.getChainStats().activitiesCount;
    uint256 initUser = cbGetters.getUser(user).activitiesCount;
    uint256 initPyble = cbGetters.getPayable(payableId).activitiesCount;

    vm.prank(user);
    (bytes32 userPaymentId, bytes32 payablePaymentId) =
      chainbills.pay{value: ethAmt}(payableId, address(chainbills), ethAmt);

    uint256 chainCount = cbGetters.getChainStats().activitiesCount;
    uint256 userCount = cbGetters.getUser(user).activitiesCount;
    uint256 pybleCount = cbGetters.getPayable(payableId).activitiesCount;

    // 2 for chain: UserPaid + PayableReceived
    assertEq(chainCount, initChain + 2);
    assertEq(userCount, initUser + 1);
    assertEq(pybleCount, initPyble + 1);

    bytes32 chainActvIdUser = cbGetters.chainActivityIdsPaginated(chainCount - 2, 1)[0];
    bytes32 chainActvIdPayable = cbGetters.chainActivityIdsPaginated(chainCount - 1, 1)[0];
    assertEq(chainActvIdUser, cbGetters.userActivityIdsPaginated(user, userCount - 1, 1)[0]);
    assertEq(chainActvIdPayable, cbGetters.payableActivityIdsPaginated(payableId, pybleCount - 1, 1)[0]);

    ActivityRecord memory r = cbGetters.getActivityRecord(chainActvIdUser);
    assert(r.activityType == ActivityType.UserPaid);
    // UserPaid is recorded first, so chainCount - 1
    assertEq(r.chainCount, chainCount - 1);
    assertEq(r.userCount, userCount);
    // 0: contract doesn't record payable count for UserPaid (cross-chain compat)
    assertEq(r.payableCount, 0);
    assertGt(r.timestamp, 0);
    assertGe(r.timestamp, block.timestamp);
    assertEq(r.entity, userPaymentId);

    r = cbGetters.getActivityRecord(chainActvIdPayable);
    assert(r.activityType == ActivityType.PayableReceived);
    assertEq(r.chainCount, chainCount);
    // 0: contract doesn't record user count for PayableReceived (cross-chain compat)
    assertEq(r.userCount, 0);
    assertEq(r.payableCount, pybleCount);
    assertGt(r.timestamp, 0);
    assertGe(r.timestamp, block.timestamp);
    assertEq(r.entity, payablePaymentId);
  }

  function testRecordWithdrew() public {
    // Make payment to use for withdrawal.
    vm.prank(user);
    chainbills.pay{value: ethAmt}(payableId, address(chainbills), ethAmt);

    uint256 initChain = cbGetters.getChainStats().activitiesCount;
    uint256 initUser = cbGetters.getUser(user).activitiesCount;
    uint256 initPyble = cbGetters.getPayable(payableId).activitiesCount;

    vm.prank(user);
    bytes32 withdrawalId = chainbills.withdraw(payableId, address(chainbills), ethAmt);

    uint256 chainCount = cbGetters.getChainStats().activitiesCount;
    uint256 userCount = cbGetters.getUser(user).activitiesCount;
    uint256 pybleCount = cbGetters.getPayable(payableId).activitiesCount;

    assertEq(chainCount, initChain + 1);
    assertEq(userCount, initUser + 1);
    assertEq(pybleCount, initPyble + 1);

    bytes32 chainActvId = cbGetters.chainActivityIdsPaginated(chainCount - 1, 1)[0];
    assertEq(chainActvId, cbGetters.userActivityIdsPaginated(user, userCount - 1, 1)[0]);
    assertEq(chainActvId, cbGetters.payableActivityIdsPaginated(payableId, pybleCount - 1, 1)[0]);

    ActivityRecord memory r = cbGetters.getActivityRecord(chainActvId);
    assert(r.activityType == ActivityType.Withdrew);
    assertEq(r.chainCount, chainCount);
    assertEq(r.userCount, userCount);
    assertEq(r.payableCount, pybleCount);
    assertGt(r.timestamp, 0);
    assertGe(r.timestamp, block.timestamp);
    assertEq(r.entity, withdrawalId);
  }

  function testRecordClosedPayable() public {
    uint256 initChain = cbGetters.getChainStats().activitiesCount;
    uint256 initUser = cbGetters.getUser(user).activitiesCount;
    uint256 initPyble = cbGetters.getPayable(payableId).activitiesCount;

    vm.prank(user);
    chainbills.closePayable(payableId);

    uint256 chainCount = cbGetters.getChainStats().activitiesCount;
    uint256 userCount = cbGetters.getUser(user).activitiesCount;
    uint256 pybleCount = cbGetters.getPayable(payableId).activitiesCount;

    assertEq(chainCount, initChain + 1);
    assertEq(userCount, initUser + 1);
    assertEq(pybleCount, initPyble + 1);

    bytes32 chainActvId = cbGetters.chainActivityIdsPaginated(chainCount - 1, 1)[0];
    assertEq(chainActvId, cbGetters.userActivityIdsPaginated(user, userCount - 1, 1)[0]);
    assertEq(chainActvId, cbGetters.payableActivityIdsPaginated(payableId, pybleCount - 1, 1)[0]);

    ActivityRecord memory r = cbGetters.getActivityRecord(chainActvId);
    assert(r.activityType == ActivityType.ClosedPayable);
    assertEq(r.chainCount, chainCount);
    assertEq(r.userCount, userCount);
    assertEq(r.payableCount, pybleCount);
    assertGt(r.timestamp, 0);
    assertGe(r.timestamp, block.timestamp);
    assertEq(r.entity, payableId);
  }

  function testRecordReopenedPayable() public {
    vm.prank(user);
    chainbills.closePayable(payableId);

    uint256 initChain = cbGetters.getChainStats().activitiesCount;
    uint256 initUser = cbGetters.getUser(user).activitiesCount;
    uint256 initPyble = cbGetters.getPayable(payableId).activitiesCount;

    vm.prank(user);
    chainbills.reopenPayable(payableId);

    uint256 chainCount = cbGetters.getChainStats().activitiesCount;
    uint256 userCount = cbGetters.getUser(user).activitiesCount;
    uint256 pybleCount = cbGetters.getPayable(payableId).activitiesCount;

    assertEq(chainCount, initChain + 1);
    assertEq(userCount, initUser + 1);
    assertEq(pybleCount, initPyble + 1);

    bytes32 chainActvId = cbGetters.chainActivityIdsPaginated(chainCount - 1, 1)[0];
    assertEq(chainActvId, cbGetters.userActivityIdsPaginated(user, userCount - 1, 1)[0]);
    assertEq(chainActvId, cbGetters.payableActivityIdsPaginated(payableId, pybleCount - 1, 1)[0]);

    ActivityRecord memory r = cbGetters.getActivityRecord(chainActvId);
    assert(r.activityType == ActivityType.ReopenedPayable);
    assertEq(r.chainCount, chainCount);
    assertEq(r.userCount, userCount);
    assertEq(r.payableCount, pybleCount);
    assertGt(r.timestamp, 0);
    assertGe(r.timestamp, block.timestamp);
    assertEq(r.entity, payableId);
  }

  function testRecordUpdatedPayableAllowedTokensAndAmounts() public {
    uint256 initChain = cbGetters.getChainStats().activitiesCount;
    uint256 initUser = cbGetters.getUser(user).activitiesCount;
    uint256 initPyble = cbGetters.getPayable(payableId).activitiesCount;

    vm.prank(user);
    chainbills.updatePayableAllowedTokensAndAmounts(payableId, new TokenAndAmount[](0));

    uint256 chainCount = cbGetters.getChainStats().activitiesCount;
    uint256 userCount = cbGetters.getUser(user).activitiesCount;
    uint256 pybleCount = cbGetters.getPayable(payableId).activitiesCount;

    assertEq(chainCount, initChain + 1);
    assertEq(userCount, initUser + 1);
    assertEq(pybleCount, initPyble + 1);

    bytes32 chainActvId = cbGetters.chainActivityIdsPaginated(chainCount - 1, 1)[0];
    assertEq(chainActvId, cbGetters.userActivityIdsPaginated(user, userCount - 1, 1)[0]);
    assertEq(chainActvId, cbGetters.payableActivityIdsPaginated(payableId, pybleCount - 1, 1)[0]);

    ActivityRecord memory r = cbGetters.getActivityRecord(chainActvId);
    assert(r.activityType == ActivityType.UpdatedPayableAllowedTokensAndAmounts);
    assertEq(r.chainCount, chainCount);
    assertEq(r.userCount, userCount);
    assertEq(r.payableCount, pybleCount);
    assertGt(r.timestamp, 0);
    assertGe(r.timestamp, block.timestamp);
    assertEq(r.entity, payableId);
  }

  function testRecordUpdatedPayableAutoWithdrawStatus() public {
    uint256 initChain = cbGetters.getChainStats().activitiesCount;
    uint256 initUser = cbGetters.getUser(user).activitiesCount;
    uint256 initPyble = cbGetters.getPayable(payableId).activitiesCount;

    vm.prank(user);
    chainbills.updatePayableAutoWithdraw(payableId, false);

    uint256 chainCount = cbGetters.getChainStats().activitiesCount;
    uint256 userCount = cbGetters.getUser(user).activitiesCount;
    uint256 pybleCount = cbGetters.getPayable(payableId).activitiesCount;

    assertEq(chainCount, initChain + 1);
    assertEq(userCount, initUser + 1);
    assertEq(pybleCount, initPyble + 1);

    bytes32 chainActvId = cbGetters.chainActivityIdsPaginated(chainCount - 1, 1)[0];
    assertEq(chainActvId, cbGetters.userActivityIdsPaginated(user, userCount - 1, 1)[0]);
    assertEq(chainActvId, cbGetters.payableActivityIdsPaginated(payableId, pybleCount - 1, 1)[0]);

    ActivityRecord memory r = cbGetters.getActivityRecord(chainActvId);
    assert(r.activityType == ActivityType.UpdatedPayableAutoWithdrawStatus);
    assertEq(r.chainCount, chainCount);
    assertEq(r.userCount, userCount);
    assertEq(r.payableCount, pybleCount);
    assertGt(r.timestamp, 0);
    assertGe(r.timestamp, block.timestamp);
    assertEq(r.entity, payableId);
  }
}
