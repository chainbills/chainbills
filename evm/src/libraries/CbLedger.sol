// SPDX-License-Identifier: Apache 2
pragma solidity ^0.8.30;

import {ICbErrors} from '../interfaces/ICbErrors.sol';
import {ICbEvents} from '../interfaces/ICbEvents.sol';
import {LibActivityStorage} from '../storage/LibActivityStorage.sol';
import {LibConfigStorage} from '../storage/LibConfigStorage.sol';
import {LibPayableStorage} from '../storage/LibPayableStorage.sol';
import {LibPaymentStorage} from '../storage/LibPaymentStorage.sol';
import {LibStatsStorage} from '../storage/LibStatsStorage.sol';
import {LibTokenRegistryStorage} from '../storage/LibTokenRegistryStorage.sol';
import {LibUserStorage} from '../storage/LibUserStorage.sol';
import {LibWithdrawalStorage} from '../storage/LibWithdrawalStorage.sol';
import {
  ActivityRecord,
  ActivityType,
  ChainStats,
  EntityType,
  Payable,
  PayablePayment,
  TokenStats,
  User,
  UserPayment,
  Withdrawal,
  WithdrawalQuote
} from '../types/CbTypes.sol';
import {LibAddressFormat} from './LibAddressFormat.sol';
import {LibCbIds} from './LibCbIds.sol';
import {LibFees} from './LibFees.sol';
import {LibTokenTransfer} from './LibTokenTransfer.sol';

/// Records users, payables, payments, withdrawals, and activities, and keeps every counter, balance, and token total
/// consistent. Linked library.
/// @dev Callers validate inputs and permissions; the ledger only records. `withdraw` is the single path that moves
/// funds out of a payable, used by host withdrawals and automatic withdrawals alike.
library CbLedger {
  using LibAddressFormat for address;

  // ---------------------------------------------------------------------------
  // Users
  // ---------------------------------------------------------------------------

  /// Initializes `wallet` as a user on first interaction.
  /// @param wallet User wallet.
  function initializeUserIfNeeded(address wallet) public {
    _initializeUserIfNeeded(wallet);
  }

  // ---------------------------------------------------------------------------
  // Payables
  // ---------------------------------------------------------------------------

  /// Creates the payable record of a new payable hosted by `host`, with no allowed tokens and amounts yet.
  /// @param host Payable host.
  /// @param isAutoWithdraw Automatic withdrawal setting.
  /// @return payableId ID of the new payable.
  function recordPayableCreation(address host, bool isAutoWithdraw) public returns (bytes32 payableId) {
    ChainStats storage stats = LibStatsStorage.layout().chainStats;
    LibUserStorage.Layout storage users = LibUserStorage.layout();
    LibPayableStorage.Layout storage payables = LibPayableStorage.layout();

    // Count the payable and its creation activity on the host and the chain.
    _initializeUserIfNeeded(host);
    User storage user = users.users[host];
    user.payablesCount++;
    user.activitiesCount++;
    stats.payablesCount++;
    stats.activitiesCount++;

    // Store the payable and index it on the chain and the host.
    payableId = LibCbIds.createId(host.toBytes32(), EntityType.Payable, user.payablesCount);
    payables.payableIds.push(payableId);
    users.userPayableIds[host].push(payableId);
    Payable storage payable_ = payables.payables[payableId];
    payable_.host = host;
    payable_.chainCount = stats.payablesCount;
    payable_.hostCount = user.payablesCount;
    payable_.createdAt = block.timestamp;
    payable_.activitiesCount = 1;
    payable_.isAutoWithdraw = isAutoWithdraw;

    // Record the creation activity on the chain, the host, and the payable.
    bytes32 activityId = LibCbIds.createId(host.toBytes32(), EntityType.Activity, user.activitiesCount);
    _storeActivity(
      activityId,
      ActivityRecord({
        chainCount: stats.activitiesCount,
        userCount: user.activitiesCount,
        payableCount: 1,
        timestamp: block.timestamp,
        entity: payableId,
        activityType: ActivityType.CreatedPayable
      })
    );
    users.userActivityIds[host].push(activityId);
    payables.payableActivityIds[payableId].push(activityId);

    emit ICbEvents.CreatedPayable(payableId, host, payable_.chainCount, payable_.hostCount);
  }

  /// Records a host-driven update activity on a payable.
  /// @param payableId Payable ID.
  /// @param activityType Kind of update.
  function recordPayableUpdate(bytes32 payableId, ActivityType activityType) public {
    ChainStats storage stats = LibStatsStorage.layout().chainStats;
    LibUserStorage.Layout storage users = LibUserStorage.layout();
    LibPayableStorage.Layout storage payables = LibPayableStorage.layout();
    Payable storage payable_ = payables.payables[payableId];
    address host = payable_.host;

    // Count the activity on the chain, the host, and the payable.
    stats.activitiesCount++;
    User storage user = users.users[host];
    user.activitiesCount++;
    payable_.activitiesCount++;

    // Record the activity on the chain, the host, and the payable.
    bytes32 activityId = LibCbIds.createId(host.toBytes32(), EntityType.Activity, user.activitiesCount);
    _storeActivity(
      activityId,
      ActivityRecord({
        chainCount: stats.activitiesCount,
        userCount: user.activitiesCount,
        payableCount: payable_.activitiesCount,
        timestamp: block.timestamp,
        entity: payableId,
        activityType: activityType
      })
    );
    users.userActivityIds[host].push(activityId);
    payables.payableActivityIds[payableId].push(activityId);
  }

  // ---------------------------------------------------------------------------
  // Payments
  // ---------------------------------------------------------------------------

  /// Records the payer's receipt of a payment made on this chain.
  /// @param payer Paying wallet.
  /// @param payableId Paid payable (local or foreign).
  /// @param payableChainId CAIP-2 chain identifier of the chain hosting the payable.
  /// @param token Token debited from the payer.
  /// @param requestedAmount Price of the payment.
  /// @param amount Total debited from the payer.
  /// @return userPaymentId ID of the receipt.
  function recordUserPayment(
    address payer,
    bytes32 payableId,
    bytes32 payableChainId,
    address token,
    uint256 requestedAmount,
    uint256 amount
  ) public returns (bytes32 userPaymentId) {
    ChainStats storage stats = LibStatsStorage.layout().chainStats;
    LibUserStorage.Layout storage users = LibUserStorage.layout();
    LibPaymentStorage.Layout storage payments = LibPaymentStorage.layout();

    // Count the payment and its activity on the payer and the chain.
    _initializeUserIfNeeded(payer);
    User storage user = users.users[payer];
    user.paymentsCount++;
    user.activitiesCount++;
    stats.userPaymentsCount++;
    stats.activitiesCount++;
    LibTokenRegistryStorage.layout().stats[token].totalUserPaid += amount;

    // Store the receipt and index it on the chain and the payer.
    userPaymentId = LibCbIds.createId(payer.toBytes32(), EntityType.Payment, user.paymentsCount);
    payments.userPaymentIds.push(userPaymentId);
    users.userPaymentIds[payer].push(userPaymentId);
    payments.userPayments[userPaymentId] = UserPayment({
      payableId: payableId,
      payer: payer,
      token: token,
      payableChainId: payableChainId,
      chainCount: stats.userPaymentsCount,
      payerCount: user.paymentsCount,
      timestamp: block.timestamp,
      requestedAmount: requestedAmount,
      amount: amount
    });

    // Record the payment activity on the chain and the payer.
    bytes32 activityId = LibCbIds.createId(payer.toBytes32(), EntityType.Activity, user.activitiesCount);
    _storeActivity(
      activityId,
      ActivityRecord({
        chainCount: stats.activitiesCount,
        userCount: user.activitiesCount,
        payableCount: 0,
        timestamp: block.timestamp,
        entity: userPaymentId,
        activityType: ActivityType.UserPaid
      })
    );
    users.userActivityIds[payer].push(activityId);

    emit ICbEvents.UserPaid(
      payableId,
      payer,
      userPaymentId,
      payableChainId,
      token,
      requestedAmount,
      amount,
      stats.userPaymentsCount,
      user.paymentsCount
    );
  }

  /// Records the payable's receipt of a payment and credits `amount` of `token` to its balance.
  /// @param payableId Local payable ID.
  /// @param payer Payer in 32-byte format.
  /// @param payerChainId CAIP-2 chain identifier of the payer's chain.
  /// @param token Token credited.
  /// @param requestedAmount Price of the payment.
  /// @param amount Amount credited.
  /// @param payerPaymentId ID of the payer's receipt on the payer's chain.
  /// @return payablePaymentId ID of the receipt.
  function recordPayablePayment(
    bytes32 payableId,
    bytes32 payer,
    bytes32 payerChainId,
    address token,
    uint256 requestedAmount,
    uint256 amount,
    bytes32 payerPaymentId
  ) public returns (bytes32 payablePaymentId) {
    ChainStats storage stats = LibStatsStorage.layout().chainStats;
    LibPayableStorage.Layout storage payables = LibPayableStorage.layout();
    Payable storage payable_ = payables.payables[payableId];

    // Count the payment and its activity on the payable and the chain.
    stats.payablePaymentsCount++;
    stats.activitiesCount++;
    payable_.paymentsCount++;
    payable_.activitiesCount++;

    // Credit the payable balance and the token totals.
    _credit(payableId, token, amount);

    // Store the receipt and index it on the chain, the payable, and the payer's chain.
    payablePaymentId = LibCbIds.createId(payableId, EntityType.Payment, payable_.paymentsCount);
    LibPaymentStorage.Layout storage payments = LibPaymentStorage.layout();
    payments.payablePaymentIds.push(payablePaymentId);
    payables.payablePaymentIds[payableId].push(payablePaymentId);
    bytes32[] storage chainPaymentIds = payables.payableChainPaymentIds[payableId][payerChainId];
    chainPaymentIds.push(payablePaymentId);
    payments.payablePayments[payablePaymentId] = PayablePayment({
      payableId: payableId,
      payer: payer,
      token: token,
      chainCount: stats.payablePaymentsCount,
      payerChainId: payerChainId,
      localChainCount: chainPaymentIds.length,
      payableCount: payable_.paymentsCount,
      timestamp: block.timestamp,
      requestedAmount: requestedAmount,
      amount: amount,
      payerPaymentId: payerPaymentId
    });

    // Record the receipt activity on the chain and the payable.
    bytes32 activityId = LibCbIds.createId(payableId, EntityType.Activity, payable_.activitiesCount);
    _storeActivity(
      activityId,
      ActivityRecord({
        chainCount: stats.activitiesCount,
        userCount: 0,
        payableCount: payable_.activitiesCount,
        timestamp: block.timestamp,
        entity: payablePaymentId,
        activityType: ActivityType.PayableReceived
      })
    );
    payables.payableActivityIds[payableId].push(activityId);

    emit ICbEvents.PayableReceived(
      payableId,
      payer,
      payablePaymentId,
      payerChainId,
      token,
      requestedAmount,
      amount,
      stats.payablePaymentsCount,
      payable_.paymentsCount
    );
  }

  // ---------------------------------------------------------------------------
  // Withdrawals
  // ---------------------------------------------------------------------------

  /// Deducts `amount` of `token` from a payable, records the withdrawal, and sends the net amount to the host and the
  /// fee to the fee collector.
  /// @param payableId Local payable ID.
  /// @param token Token address, or the diamond address for the native token.
  /// @param amount Amount deducted from the payable balance.
  /// @return withdrawalId ID of the withdrawal.
  /// @dev Callers check the caller's permission. External calls happen last.
  function withdraw(bytes32 payableId, address token, uint256 amount) public returns (bytes32 withdrawalId) {
    LibPayableStorage.Layout storage payables = LibPayableStorage.layout();
    Payable storage payable_ = payables.payables[payableId];
    address host = payable_.host;

    /* CHECKS */
    // Require a positive amount covered by the payable balance of a token it has received.
    if (amount == 0) revert ICbErrors.ZeroAmountSpecified();
    if (!payables.isBalanceToken[payableId][token]) revert ICbErrors.NoBalanceForWithdrawalToken();
    uint256 balance = payables.balances[payableId][token];
    if (balance < amount) revert ICbErrors.InsufficientWithdrawAmount(balance, amount);
    WithdrawalQuote memory quote = LibFees.quote(token, amount);

    /* STATE CHANGES */
    // Count the withdrawal and its activity on the host, the payable, and the chain.
    ChainStats storage stats = LibStatsStorage.layout().chainStats;
    LibUserStorage.Layout storage users = LibUserStorage.layout();
    User storage user = users.users[host];
    stats.withdrawalsCount++;
    stats.activitiesCount++;
    user.withdrawalsCount++;
    user.activitiesCount++;
    payable_.withdrawalsCount++;
    payable_.activitiesCount++;

    // Deduct the payable balance and update the token totals.
    payables.balances[payableId][token] = balance - amount;
    TokenStats storage tokenStats = LibTokenRegistryStorage.layout().stats[token];
    tokenStats.totalWithdrawn += amount;
    tokenStats.totalWithdrawalFeesCollected += quote.fee;
    tokenStats.totalPayableBalance -= amount;

    // Store the withdrawal and index it on the chain, the host, and the payable.
    withdrawalId = LibCbIds.createId(host.toBytes32(), EntityType.Withdrawal, user.withdrawalsCount);
    LibWithdrawalStorage.Layout storage withdrawals = LibWithdrawalStorage.layout();
    withdrawals.withdrawalIds.push(withdrawalId);
    users.userWithdrawalIds[host].push(withdrawalId);
    payables.payableWithdrawalIds[payableId].push(withdrawalId);
    withdrawals.withdrawals[withdrawalId] = Withdrawal({
      payableId: payableId,
      host: host,
      token: token,
      chainCount: stats.withdrawalsCount,
      hostCount: user.withdrawalsCount,
      payableCount: payable_.withdrawalsCount,
      timestamp: block.timestamp,
      amount: amount,
      fee: quote.fee
    });

    // Record the withdrawal activity on the chain, the host, and the payable.
    bytes32 activityId = LibCbIds.createId(host.toBytes32(), EntityType.Activity, user.activitiesCount);
    _storeActivity(
      activityId,
      ActivityRecord({
        chainCount: stats.activitiesCount,
        userCount: user.activitiesCount,
        payableCount: payable_.activitiesCount,
        timestamp: block.timestamp,
        entity: withdrawalId,
        activityType: ActivityType.Withdrew
      })
    );
    users.userActivityIds[host].push(activityId);
    payables.payableActivityIds[payableId].push(activityId);

    emit ICbEvents.Withdrew(
      payableId,
      host,
      withdrawalId,
      token,
      amount,
      quote.fee,
      stats.withdrawalsCount,
      user.withdrawalsCount,
      payable_.withdrawalsCount
    );

    /* TRANSFER */
    // Send the net amount to the host and the fee to the fee collector; zero amounts are skipped.
    LibTokenTransfer.push(token, host, quote.net);
    LibTokenTransfer.push(token, LibConfigStorage.layout().feeCollector, quote.fee);
  }

  // ---------------------------------------------------------------------------
  // Internal helpers
  // ---------------------------------------------------------------------------

  /// Initializes `wallet` as a user when it has no record yet.
  function _initializeUserIfNeeded(address wallet) private {
    LibUserStorage.Layout storage users = LibUserStorage.layout();
    User storage user = users.users[wallet];
    if (user.chainCount != 0) return;

    // Count the user and its initialization activity.
    ChainStats storage stats = LibStatsStorage.layout().chainStats;
    stats.usersCount++;
    stats.activitiesCount++;
    users.userAddresses.push(wallet);
    user.chainCount = stats.usersCount;
    user.activitiesCount = 1;

    // Record the initialization activity on the chain and the user.
    bytes32 activityId = LibCbIds.createId(wallet.toBytes32(), EntityType.Activity, 1);
    _storeActivity(
      activityId,
      ActivityRecord({
        chainCount: stats.activitiesCount,
        userCount: 1,
        payableCount: 0,
        timestamp: block.timestamp,
        entity: wallet.toBytes32(),
        activityType: ActivityType.InitializedUser
      })
    );
    users.userActivityIds[wallet].push(activityId);

    emit ICbEvents.InitializedUser(wallet, stats.usersCount);
  }

  /// Credits `amount` of `token` to a payable and to the token totals, adding the token to the balance list on its
  /// first credit.
  function _credit(bytes32 payableId, address token, uint256 amount) private {
    LibPayableStorage.Layout storage payables = LibPayableStorage.layout();
    if (!payables.isBalanceToken[payableId][token]) {
      address[] storage tokens = payables.balanceTokens[payableId];
      if (tokens.length == type(uint8).max) revert ICbErrors.TooManyBalanceTokens();
      tokens.push(token);
      payables.isBalanceToken[payableId][token] = true;
      payables.payables[payableId].balancesCount = uint8(tokens.length);
    }
    payables.balances[payableId][token] += amount;
    TokenStats storage tokenStats = LibTokenRegistryStorage.layout().stats[token];
    tokenStats.totalPayableReceived += amount;
    tokenStats.totalPayableBalance += amount;
  }

  /// Stores an activity record and appends it to the chain activity list.
  function _storeActivity(bytes32 activityId, ActivityRecord memory record) private {
    LibActivityStorage.Layout storage activities = LibActivityStorage.layout();
    activities.activityIds.push(activityId);
    activities.activities[activityId] = record;
  }
}
