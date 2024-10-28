// SPDX-License-Identifier: Apache 2
pragma solidity ^0.8.20;

import '@openzeppelin/contracts/token/ERC20/IERC20.sol';
import 'wormhole/Utils.sol';

import './CbGovernance.sol';
import './CbPayload.sol';
import './CbState.sol';

error InvalidFeeCollector();
error InvalidWormholeAddress();
error InvalidWormholeFinality();
error EmitterNotRegistered();
error UnsupportedToken();
error NotYourPayable();
error PayableIsAlreadyClosed();
error PayableIsNotClosed();
error PayableIsClosed();
error MatchingTokenAndAmountNotFound();
error InsufficientPaymentValue();
error IncorrectPaymentValue();
error UnsuccessfulPayment();
error InsufficientWithdrawAmount();
error NoBalanceForWithdrawalToken();
error UnsuccessfulWithdrawal();
error UnsuccessfulFeesWithdrawal();

/// A Cross-Chain Payment Gateway.
contract Chainbills is CbGovernance, CbPayload {
  fallback() external payable {}

  receive() external payable {}

  /// Sets up this smart contract when it is deployed. Sets the feeCollector,
  /// wormhole, chainId, and wormholeFinality variables.
  constructor(
    address feeCollector_,
    address wormhole_,
    uint16 chainId_,
    uint8 wormholeFinality_
  ) {
    if (feeCollector_ == address(0)) revert InvalidFeeCollector();
    else if (wormhole_ == address(0)) revert InvalidWormholeAddress();
    else if (chainId_ == 0) revert InvalidWormholeChainId();
    else if (wormholeFinality_ == 0) revert InvalidWormholeFinality();

    feeCollector = feeCollector_;
    wormhole = wormhole_;
    chainId = chainId_;
    wormholeFinality = wormholeFinality_;
    chainStats = ChainStats(0, 0, 0, 0, 0, 0);
  }

  /// Initializes a User if need be.
  /// @param wallet The address of the user.
  function initializeUserIfNeedBe(address wallet) internal {
    // Check if the user has not yet been initialized, if yes, initialize.
    if (users[wallet].chainCount == 0) {
      // Increment chain count for users and activities.
      chainStats.usersCount++;
      chainStats.activitiesCount++;

      // Initialize the user.
      users[wallet].chainCount = chainStats.usersCount;
      users[wallet].activitiesCount = 1;

      // Record the Activity.
      bytes32 activityId =
        createId(toWormholeFormat(wallet), EntityType.Activity, 1);
      chainActivityIds.push(activityId);
      userActivityIds[wallet].push(activityId);
      activities[activityId] = ActivityRecord({
        chainCount: chainStats.activitiesCount,
        userCount: 1, // for initialization
        payableCount: 0, // no payable involved
        timestamp: block.timestamp,
        entity: toWormholeFormat(wallet),
        activityType: ActivityType.InitializedUser
      });

      // Emit Event.
      emit InitializedUser(wallet, chainStats.usersCount);
    }
  }

  /// Returns a hash that should be used for entity IDs.
  function createId(bytes32 entity, EntityType salt, uint256 count)
    internal
    view
    returns (bytes32)
  {
    return keccak256(
      abi.encodePacked(
        block.chainid, chainId, block.timestamp, entity, salt, count
      )
    );
  }

  /// Records an activity for updating a Payable.
  /// @param payableId The ID of the payable being updated.
  /// @param activityType The type of activity being recorded.
  function recordUpdatePayableActivity(
    bytes32 payableId,
    ActivityType activityType
  ) internal {
    // Increment the chainStats for activitiesCount.
    chainStats.activitiesCount++;

    // Increment activitiesCount on the user.
    users[msg.sender].activitiesCount++;

    // Increment activitiesCount on the involved payable.
    payables[payableId].activitiesCount++;

    // Record the Activity.
    bytes32 activityId = createId(
      toWormholeFormat(msg.sender),
      EntityType.Activity,
      users[msg.sender].activitiesCount
    );
    chainActivityIds.push(activityId);
    userActivityIds[msg.sender].push(activityId);
    payableActivityIds[payableId].push(activityId);
    activities[activityId] = ActivityRecord({
      chainCount: chainStats.activitiesCount,
      userCount: users[msg.sender].activitiesCount,
      payableCount: payables[payableId].activitiesCount,
      timestamp: block.timestamp,
      entity: payableId,
      activityType: activityType
    });
  }

  /// Create a Payable.
  /// @param allowedTokensAndAmounts The accepted tokens (and their amounts) on
  /// the payable. If empty, then the payable will accept payments in any token.
  /// @return payableId The ID of the newly created payable.
  function createPayable(TokenAndAmount[] calldata allowedTokensAndAmounts)
    public
    returns (bytes32 payableId)
  {
    /* CHECKS */
    for (uint8 i = 0; i < allowedTokensAndAmounts.length; i++) {
      // Ensure tokens are valid.
      address token = allowedTokensAndAmounts[i].token;
      if (token == address(0)) revert InvalidTokenAddress();

      // Ensure that the token is supported.
      if (!tokenDetails[token].isSupported) revert UnsupportedToken();

      // Ensure that the specified amount is greater than zero.
      if (allowedTokensAndAmounts[i].amount == 0) revert ZeroAmountSpecified();
    }

    /* STATE CHANGES */
    // Increment payables and activities counts on the host (address) creating
    // this payable.
    initializeUserIfNeedBe(msg.sender);
    users[msg.sender].payablesCount++;
    users[msg.sender].activitiesCount++;

    // Increment the chainStats for payablesCount and activitiesCount.
    chainStats.payablesCount++;
    chainStats.activitiesCount++;

    // Create the payable.
    payableId = createId(
      toWormholeFormat(msg.sender),
      EntityType.Payable,
      users[msg.sender].payablesCount
    );
    userPayableIds[msg.sender].push(payableId);
    payableAllowedTokensAndAmounts[payableId] = allowedTokensAndAmounts;
    Payable storage _payable = payables[payableId];
    _payable.chainCount = chainStats.payablesCount;
    _payable.host = msg.sender;
    _payable.hostCount = users[msg.sender].payablesCount;
    _payable.allowedTokensAndAmountsCount =
      uint8(allowedTokensAndAmounts.length);
    _payable.createdAt = block.timestamp;
    _payable.activitiesCount = 1; // for creation

    // Record the Activity.
    bytes32 activityId = createId(
      toWormholeFormat(msg.sender),
      EntityType.Activity,
      users[msg.sender].activitiesCount
    );
    chainActivityIds.push(activityId);
    userActivityIds[msg.sender].push(activityId);
    payableActivityIds[payableId].push(activityId);
    activities[activityId] = ActivityRecord({
      chainCount: chainStats.activitiesCount,
      userCount: users[msg.sender].activitiesCount,
      payableCount: 1, // for creation
      timestamp: block.timestamp,
      entity: payableId,
      activityType: ActivityType.CreatedPayable
    });

    // Emit Event.
    emit CreatedPayable(
      payableId, msg.sender, _payable.chainCount, _payable.hostCount
    );
  }

  /// Transfers the amount of tokens from a payer to a payable.
  /// @param payableId The ID of the payable to pay into.
  /// @param token The Wormhole-normalized address of the token been paid.
  /// @param amount The Wormhole-normalized (with 8 decimals) amount of the
  /// token.
  function pay(bytes32 payableId, address token, uint256 amount)
    public
    payable
    nonReentrant
    returns (bytes32 paymentId)
  {
    /* CHECKS */
    // Ensure that the token is valid.
    if (token == address(0)) revert InvalidTokenAddress();

    // Ensure that the token is supported.
    if (!tokenDetails[token].isSupported) revert UnsupportedToken();

    // Ensure that amount is greater than zero
    if (amount == 0) revert ZeroAmountSpecified();

    // Ensure that the payable exists and it is not closed
    Payable storage _payable = payables[payableId];
    if (_payable.host == address(0)) revert InvalidPayableId();
    if (_payable.isClosed) revert PayableIsClosed();

    // If this payable specified the tokens and amounts it can accept, ensure
    // that the token and amount are matching.
    uint8 aTAALength = _payable.allowedTokensAndAmountsCount;
    if (aTAALength > 0) {
      for (uint8 i = 0; i < aTAALength; i++) {
        if (
          payableAllowedTokensAndAmounts[payableId][i].token == token
            && payableAllowedTokensAndAmounts[payableId][i].amount == amount
        ) break;
        if (i == aTAALength - 1) revert MatchingTokenAndAmountNotFound();
      }
    }

    /* TRANSFER */
    if (token == address(this)) {
      if (msg.value < amount) revert InsufficientPaymentValue();
      if (msg.value > amount) revert IncorrectPaymentValue();
    } else {
      if (!IERC20(token).transferFrom(msg.sender, address(this), amount)) {
        revert UnsuccessfulPayment();
      }
    }

    /* STATE CHANGES */
    // Increment paymentsCount in the payer that just paid.
    initializeUserIfNeedBe(msg.sender);
    users[msg.sender].paymentsCount++;

    // Increment the chainStats for payments counts.
    chainStats.userPaymentsCount++;
    chainStats.payablePaymentsCount++;

    // Increment the chain stats for activitiesCount.
    //
    // Incrementing twice to account for recording two activities: one for the
    // user and one for the payable.
    chainStats.activitiesCount += 2;

    // Increment  global and local-chain paymentsCount, and activitiesCount on
    // involved payable.
    _payable.paymentsCount++;
    payableChainPaymentsCount[payableId][chainId]++;
    _payable.activitiesCount++;

    // Update payable's balances to add this token and its amount.
    bool wasMatchingBalanceUpdated = false;
    for (uint8 i = 0; i < _payable.balancesCount; i++) {
      if (payableBalances[payableId][i].token == token) {
        payableBalances[payableId][i].amount += amount;
        wasMatchingBalanceUpdated = true;
        break;
      }
    }
    if (!wasMatchingBalanceUpdated) {
      payableBalances[payableId].push(TokenAndAmount(token, amount));
      _payable.balancesCount++;
    }

    // Increase the supported token's totals from this payment.
    tokenDetails[token].totalUserPaid += amount;
    tokenDetails[token].totalPayableReceived += amount;

    // Record payment details of user.
    paymentId = createId(
      toWormholeFormat(msg.sender),
      EntityType.Payment,
      users[msg.sender].paymentsCount
    );
    userPaymentIds[msg.sender].push(paymentId);
    userPaymentDetails[paymentId] = TokenAndAmount(token, amount);
    userPayments[paymentId] = UserPayment({
      payableId: payableId,
      payer: msg.sender,
      payableChainId: chainId,
      chainCount: chainStats.userPaymentsCount,
      payerCount: users[msg.sender].paymentsCount,
      timestamp: block.timestamp
    });

    // Record payment details of payable.
    payablePaymentIds[payableId].push(paymentId);
    payableChainPaymentIds[payableId][chainId].push(paymentId);
    payablePaymentDetails[paymentId] = TokenAndAmount(token, amount);
    payablePayments[paymentId] = PayablePayment({
      payableId: payableId,
      payer: toWormholeFormat(msg.sender),
      chainCount: chainStats.payablePaymentsCount,
      payerChainId: chainId,
      localChainCount: payableChainPaymentsCount[payableId][chainId],
      payableCount: _payable.paymentsCount,
      timestamp: block.timestamp
    });

    // Record User Activity.
    bytes32 userActivityId = createId(
      toWormholeFormat(msg.sender),
      EntityType.Activity,
      users[msg.sender].activitiesCount
    );
    chainActivityIds.push(userActivityId);
    userActivityIds[msg.sender].push(userActivityId);
    activities[userActivityId] = ActivityRecord({
      // subtracting 1 because we incremented the activities_count twice.
      chainCount: chainStats.activitiesCount - 1,
      userCount: users[msg.sender].activitiesCount,
      payableCount: 0, // no payable involved
      timestamp: block.timestamp,
      entity: paymentId,
      activityType: ActivityType.UserPaid
    });

    // Record Payable Activity.
    bytes32 payableActivityId =
      createId(payableId, EntityType.Activity, _payable.activitiesCount);
    chainActivityIds.push(payableActivityId);
    payableActivityIds[payableId].push(payableActivityId);
    activities[payableActivityId] = ActivityRecord({
      chainCount: chainStats.activitiesCount,
      userCount: 0, // no user involved
      payableCount: _payable.activitiesCount,
      timestamp: block.timestamp,
      entity: paymentId,
      activityType: ActivityType.PayableReceived
    });

    // Emit Events.
    emit UserPaid(
      payableId,
      msg.sender,
      paymentId,
      chainId,
      chainStats.userPaymentsCount,
      users[msg.sender].paymentsCount
    );
    emit PayablePaid(
      payableId,
      toWormholeFormat(msg.sender),
      paymentId,
      chainId,
      chainStats.payablePaymentsCount,
      _payable.paymentsCount
    );
  }

  /// Transfers the amount of tokens from a payable to the owner host.
  /// @param payableId The ID of the Payable to withdraw from.
  /// @param token The Wormhole-normalized address of the token been withdrawn.
  /// @param amount The Wormhole-normalized (with 8 decimals) amount of the
  /// token.
  function withdraw(bytes32 payableId, address token, uint256 amount)
    public
    payable
    nonReentrant
    returns (bytes32 withdrawalId)
  {
    /* CHECKS */
    // Ensure that the payable exists and that the caller owns the payable.
    Payable storage _payable = payables[payableId];
    if (_payable.host == address(0)) revert InvalidPayableId();
    if (_payable.host != msg.sender) revert NotYourPayable();

    // Ensure that the amount to be withdrawn is not zero.
    if (amount == 0) revert ZeroAmountSpecified();

    // - Ensure that this payable has enough of the amount in its balance.
    // - Ensure that the specified token for withdrawal exists in the
    //   payable's balances.
    if (_payable.balancesCount == 0) revert NoBalanceForWithdrawalToken();
    for (uint8 i = 0; i < _payable.balancesCount; i++) {
      if (payableBalances[payableId][i].token == token) {
        if (payableBalances[payableId][i].amount < amount) {
          revert InsufficientWithdrawAmount();
        } else {
          break;
        }
      }
      if (i == _payable.balancesCount - 1) {
        revert NoBalanceForWithdrawalToken();
      }
    }

    /* TRANSFER */
    // Prepare withdraw amounts and fees
    uint256 percent = (amount * withdrawalFeePercentage) / 10000; // 10000 is 100%
    uint256 maxFees = tokenDetails[token].maxWithdrawalFees;
    uint256 fees = percent > maxFees ? maxFees : percent;
    uint256 amtDue = amount - fees;

    // Transfer the amount minus fees to the owner.
    bool isWtdlSuccess = false;
    if (token == address(this)) {
      (isWtdlSuccess,) = payable(msg.sender).call{value: amtDue}('');
    } else {
      isWtdlSuccess = IERC20(token).transfer(msg.sender, amtDue);
    }
    if (!isWtdlSuccess) revert UnsuccessfulWithdrawal();

    // Transfer the fees to the fees collector.
    bool isFeesSuccess = false;
    if (token == address(this)) {
      (isFeesSuccess,) = payable(feeCollector).call{value: fees}('');
    } else {
      isFeesSuccess = IERC20(token).transfer(feeCollector, fees);
    }
    if (!isFeesSuccess) revert UnsuccessfulFeesWithdrawal();

    /* STATE CHANGES */
    // Increment the chainStats for withdrawalsCount and activitiesCount.
    chainStats.withdrawalsCount++;
    chainStats.activitiesCount++;

    // Increment withdrawalsCount and activitiesCount in the host (address)
    // that just withdrew.
    users[msg.sender].withdrawalsCount++;
    users[msg.sender].activitiesCount++;

    // Increment withdrawalsCount and activitiesCount on involved payable.
    _payable.withdrawalsCount++;
    _payable.activitiesCount++;

    // Deduct the balances on the involved payable.
    for (uint8 i = 0; i < _payable.balancesCount; i++) {
      if (payableBalances[payableId][i].token == token) {
        payableBalances[payableId][i].amount -= amount;
        break;
      }
    }

    // Increase the supported token's totals from this withdrawal.
    tokenDetails[token].totalWithdrawn += amount;
    tokenDetails[token].totalWithdrawalFeesCollected += fees;

    // Initialize the withdrawal.
    withdrawalId = createId(
      toWormholeFormat(msg.sender),
      EntityType.Withdrawal,
      users[msg.sender].withdrawalsCount
    );
    userWithdrawalIds[msg.sender].push(withdrawalId);
    payableWithdrawalIds[payableId].push(withdrawalId);
    withdrawalDetails[withdrawalId] = TokenAndAmount(token, amount);
    withdrawals[withdrawalId] = Withdrawal({
      payableId: payableId,
      host: msg.sender,
      chainCount: chainStats.withdrawalsCount,
      hostCount: users[msg.sender].withdrawalsCount,
      payableCount: _payable.withdrawalsCount,
      timestamp: block.timestamp
    });

    // Record the Activity.
    bytes32 activityId = createId(
      toWormholeFormat(msg.sender),
      EntityType.Activity,
      users[msg.sender].activitiesCount
    );
    chainActivityIds.push(activityId);
    userActivityIds[msg.sender].push(activityId);
    payableActivityIds[payableId].push(activityId);
    activities[activityId] = ActivityRecord({
      chainCount: chainStats.activitiesCount,
      userCount: users[msg.sender].activitiesCount,
      payableCount: _payable.activitiesCount,
      timestamp: block.timestamp,
      entity: withdrawalId,
      activityType: ActivityType.Withdrew
    });

    // Emit Event.
    emit Withdrew(
      payableId,
      msg.sender,
      withdrawalId,
      chainStats.withdrawalsCount,
      users[msg.sender].withdrawalsCount,
      _payable.withdrawalsCount
    );
  }

  /// Stop a payable from accepting payments. Should be called only by the host
  /// (address) that owns the payable.
  /// @param payableId The ID of the payable to close.
  function closePayable(bytes32 payableId) public {
    Payable storage _payable = payables[payableId];
    if (_payable.host != msg.sender) revert NotYourPayable();
    if (_payable.isClosed) revert PayableIsAlreadyClosed();
    _payable.isClosed = true;
    recordUpdatePayableActivity(payableId, ActivityType.ClosedPayable);
    emit ClosedPayable(payableId, msg.sender);
  }

  /// Allow a closed payable to continue accepting payments. Should be called
  /// only by the host (address) that owns the payable.
  /// @param payableId The ID of the payable to re-open.
  function reopenPayable(bytes32 payableId) public {
    Payable storage _payable = payables[payableId];
    if (_payable.host != msg.sender) revert NotYourPayable();
    if (!_payable.isClosed) revert PayableIsNotClosed();
    _payable.isClosed = false;
    recordUpdatePayableActivity(payableId, ActivityType.ReopenedPayable);
    emit ReopenedPayable(payableId, msg.sender);
  }

  /// Allows a payable's host to update the payable's allowedTokensAndAmounts.
  /// @param payableId The ID of the payable to update.
  /// @param allowedTokensAndAmounts The new tokens and amounts array.
  function updatePayableAllowedTokensAndAmounts(
    bytes32 payableId,
    TokenAndAmount[] calldata allowedTokensAndAmounts
  ) public {
    /* CHECKS */
    // Ensure that the caller owns the payable.
    Payable storage _payable = payables[payableId];
    if (_payable.host != msg.sender) revert NotYourPayable();

    for (uint8 i = 0; i < allowedTokensAndAmounts.length; i++) {
      // Ensure tokens are valid.
      address token = allowedTokensAndAmounts[i].token;
      if (token == address(0)) revert InvalidTokenAddress();

      // Ensure that the token is supported.
      if (!tokenDetails[token].isSupported) revert UnsupportedToken();

      // Ensure that the specified amount is greater than zero.
      if (allowedTokensAndAmounts[i].amount == 0) revert ZeroAmountSpecified();
    }

    /* STATE CHANGES */
    // Update the payable's allowedTokensAndAmounts
    payableAllowedTokensAndAmounts[payableId] = allowedTokensAndAmounts;
    _payable.allowedTokensAndAmountsCount =
      uint8(allowedTokensAndAmounts.length);

    // Record the Activity.
    recordUpdatePayableActivity(
      payableId, ActivityType.UpdatedPayableAllowedTokensAndAmounts
    );

    // Emit Event.
    emit UpdatedPayableAllowedTokensAndAmounts(payableId, msg.sender);
  }
}
