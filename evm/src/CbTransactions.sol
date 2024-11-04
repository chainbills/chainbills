// SPDX-License-Identifier: Apache 2
pragma solidity ^0.8.20;

import '@openzeppelin/contracts/token/ERC20/IERC20.sol';
import '@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol';
import 'wormhole/libraries/BytesParsing.sol';
import 'wormhole/interfaces/IWormhole.sol';
import 'wormhole/Utils.sol';
import './CbErrors.sol';
import './CbEvents.sol';
import './CbGovernance.sol';
import './CbPayloadMessages.sol';
import './CbStructs.sol';

contract CbTransactions is CbGovernance {
  using BytesParsing for bytes;
  using CbDecodePayload for bytes;
  using CbEncodePaymentPayload for PaymentPayload;

  /// Carries out necessary checks on the token and amount to be paid.
  /// @param token The address of the token to be paid.
  /// @param amount The amount of the token to be paid.
  function ensurePaymentChecks(address token, uint256 amount) internal view {
    // Ensure that the token is valid.
    if (token == address(0)) revert InvalidTokenAddress();

    // Ensure that the token is supported.
    if (!tokenDetails[token].isSupported) revert UnsupportedToken();

    // Ensure that the amount is greater than zero.
    if (amount == 0) revert ZeroAmountSpecified();
  }

  /// Records successful payments and activity from a payer.
  /// @param payableId The ID of the payable that was paid into.
  /// @param payableChainId The Chain ID of the payable.
  /// @param token The address of the token that was paid.
  /// @param amount The amount paid.
  /// @return userPaymentId The ID of the recorded payment from the user.
  function recordUserPayment(
    bytes32 payableId,
    uint16 payableChainId,
    address token,
    uint256 amount
  ) internal returns (bytes32 userPaymentId) {
    // Increment paymentsCount in the payer that just paid.
    initializeUserIfNeedBe(msg.sender);
    users[msg.sender].paymentsCount++;
    users[msg.sender].activitiesCount++;

    // Increment the chainStats for payments and activities counts.
    chainStats.userPaymentsCount++;
    chainStats.activitiesCount++;

    // Increase the supported token's total from this payment.
    tokenDetails[token].totalUserPaid += amount;

    // Record payment details of user.
    userPaymentId = createId(
      toWormholeFormat(msg.sender),
      EntityType.Payment,
      users[msg.sender].paymentsCount
    );
    chainUserPaymentIds.push(userPaymentId);
    userPaymentIds[msg.sender].push(userPaymentId);
    userPaymentDetails[userPaymentId] = TokenAndAmount(token, amount);
    userPayments[userPaymentId] = UserPayment({
      payableId: payableId,
      payer: msg.sender,
      payableChainId: payableChainId,
      chainCount: chainStats.userPaymentsCount,
      payerCount: users[msg.sender].paymentsCount,
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
      chainCount: chainStats.activitiesCount,
      userCount: users[msg.sender].activitiesCount,
      payableCount: 0, // no payable involved
      timestamp: block.timestamp,
      entity: userPaymentId,
      activityType: ActivityType.UserPaid
    });

    // Emit Events
    emit UserPaid(
      payableId,
      msg.sender,
      userPaymentId,
      payableChainId,
      chainStats.userPaymentsCount,
      users[msg.sender].paymentsCount
    );
  }

  /// Records successful payments and activity to a payable.
  /// @param payableId The ID of the payable that was paid into.
  /// @param payer Payer address in Wormhole format.
  /// @param payerChainId The Chain ID of the payable.
  /// @param token The address of the token that was paid.
  /// @param amount The amount paid.
  /// @return payablePaymentId The ID of the recorded payment from the user.
  function recordPayablePayment(
    bytes32 payableId,
    bytes32 payer,
    uint16 payerChainId,
    address token,
    uint256 amount
  ) internal returns (bytes32 payablePaymentId) {
    // Increment the chainStats for payments and activities counts.
    chainStats.payablePaymentsCount++;
    chainStats.activitiesCount++;

    // Increment global and local-chain paymentsCount, and activitiesCount on
    // involved payable.
    Payable storage _payable = payables[payableId];
    _payable.paymentsCount++;
    payableChainPaymentsCount[payableId][payerChainId]++;
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
    tokenDetails[token].totalPayableReceived += amount;

    // Record payment details of payable.
    payablePaymentId =
      createId(payableId, EntityType.Payment, _payable.paymentsCount);
    chainPayablePaymentIds.push(payablePaymentId);
    payablePaymentIds[payableId].push(payablePaymentId);
    payableChainPaymentIds[payableId][payerChainId].push(payablePaymentId);
    payablePaymentDetails[payablePaymentId] = TokenAndAmount(token, amount);
    payablePayments[payablePaymentId] = PayablePayment({
      payableId: payableId,
      payer: payer,
      chainCount: chainStats.payablePaymentsCount,
      payerChainId: payerChainId,
      localChainCount: payableChainPaymentsCount[payableId][payerChainId],
      payableCount: _payable.paymentsCount,
      timestamp: block.timestamp
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
      entity: payablePaymentId,
      activityType: ActivityType.PayableReceived
    });

    // Emit Event.
    emit PayablePaid(
      payableId,
      payer,
      payablePaymentId,
      payerChainId,
      chainStats.payablePaymentsCount,
      _payable.paymentsCount
    );
  }

  /// Transfers the amount of tokens from a payer to a payable.
  /// @param payableId The ID of the payable to pay into.
  /// @param token The address of the token been paid.
  /// @param amount The amount of the token.
  /// @return userPaymentId The ID of the recorded payment from the user.
  /// @return payablePaymentId The ID of the recorded payment from the payable.
  function pay(bytes32 payableId, address token, uint256 amount)
    public
    payable
    nonReentrant
    returns (bytes32 userPaymentId, bytes32 payablePaymentId)
  {
    /* CHECKS */
    // Basic Payment Checks
    ensurePaymentChecks(token, amount);

    // Ensure that the payable exists and it is not closed
    Payable storage _payable = payables[payableId];
    if (_payable.host == address(0)) revert InvalidPayableId();
    if (_payable.isClosed) revert PayableIsClosed();

    // If this payable specified the tokens and amounts it can accept, ensure
    // that the token and amount are matching.
    uint8 aTAALength = _payable.allowedTokensAndAmountsCount;
    if (aTAALength > 0) {
      for (uint8 i = 0; i < aTAALength; i++) {
        TokenAndAmount storage ataa =
          payableAllowedTokensAndAmounts[payableId][i];
        if (ataa.token == token && ataa.amount == amount) break;
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
    // Record successful payment and activity from the payer.
    userPaymentId = recordUserPayment(payableId, config.chainId, token, amount);

    // Record successful payment and activity to the payable.
    payablePaymentId = recordPayablePayment(
      payableId, toWormholeFormat(msg.sender), config.chainId, token, amount
    );
  }

  /// Transfers the amount of tokens from a payer to a foreign payable.
  /// @param payableId The ID of the payable to pay into.
  /// @param token The address of the token been paid.
  /// @param amount The amount of the token.
  /// @return userPaymentId The ID of the recorded payment from the user.
  /// @return wormholeMessageSequence The sequence number of the Wormhole
  /// message.
  function payForeignWithCircle(
    bytes32 payableId,
    address token,
    uint256 amount
  )
    public
    payable
    nonReentrant
    returns (bytes32 userPaymentId, uint64 wormholeMessageSequence)
  {
    /* CHECKS */
    // Basic Payment Checks
    ensurePaymentChecks(token, amount);

    // Ensure that the required Wormhole Fees were paid.
    ensureWormholeFees();

    // Ensure that the foreign payable exists and it is not closed
    PayableForeign storage _payable = foreignPayables[payableId];
    if (_payable.chainId == 0) revert InvalidPayableId();
    if (_payable.isClosed) revert PayableIsClosed();

    // If this payable specified the tokens and amounts it can accept, ensure
    // that the token and amount are matching.
    uint8 aTAALength = _payable.allowedTokensAndAmountsCount;
    if (aTAALength > 0) {
      for (uint8 i = 0; i < aTAALength; i++) {
        TokenAndAmountForeign storage ataa =
          foreignPayableAllowedTokensAndAmounts[payableId][i];
        address matchingToken =
          forForeignChainMatchingTokenAddresses[_payable.chainId][ataa.token];
        if (matchingToken == token && ataa.amount == uint64(amount)) break;
        if (i == aTAALength - 1) revert MatchingTokenAndAmountNotFound();
      }
    }

    /* TRANSFER */
    // Transfer the tokens from the sender into this contract first.
    if (!IERC20(token).transferFrom(msg.sender, address(this), amount)) {
      revert UnsuccessfulPayment();
    }

    // Approve the Circle Bridge to spend tokens
    SafeERC20.safeIncreaseAllowance(IERC20(token), config.circleBridge, amount);

    // Burn tokens with CircleBridge
    uint64 circleNonce = circleBridge().depositForBurn(
      amount,
      chainIdToCircleDomain[_payable.chainId],
      registeredForeignContracts[_payable.chainId],
      token
    );

    /* STATE CHANGES */
    // Record successful payment and activity from the payer.
    userPaymentId =
      recordUserPayment(payableId, _payable.chainId, token, amount);

    // Publish Message through Wormhole.
    bytes32 foreignTokenAddr =
      forTokenAddressMatchingForeignChainTokens[token][_payable.chainId];
    wormholeMessageSequence = publishPayloadMessage(
      PaymentPayload({
        version: 1,
        payableId: payableId,
        payableChainToken: toWormholeFormat(token),
        payableChainId: _payable.chainId,
        payer: toWormholeFormat(msg.sender),
        payerChainToken: foreignTokenAddr,
        payerChainId: config.chainId,
        amount: uint64(amount),
        circleNonce: circleNonce
      }).encode()
    );
  }

  /// Receives a payment to a payable from another chain.
  /// @param params The parameters for redeeming a payment from another chain.
  /// Specifically:
  /// - wormholeEncoded The encoded message from Wormhole.
  /// - circleBridgeMessage The encoded message from Circle Bridge.
  /// - circleAttestation The encoded attestation from Circle.
  /// @return payablePaymentId The ID of the recorded payment from the payable.
  function receiveForeignPaymentWithCircle(
    RedeemCirclePaymentParameters memory params
  ) public nonReentrant returns (bytes32 payablePaymentId) {
    /* CHECKS */
    // Carry out necessary verifications on the encoded Wormhole and parse it.
    IWormhole.VM memory wormholeMessage =
      parseAndCheckWormholeMessage(params.wormholeEncoded);

    // Decode the Payload from the Wormhole message.
    PaymentPayload memory payload =
      wormholeMessage.payload.decodePaymentPayload();

    // Ensure that the payable exists.
    if (payables[payload.payableId].host == address(0)) {
      revert InvalidPayableId();
    }

    // Verify Circle Message for Matching Domains, Nonce, and our Contract
    /// Addresses.
    uint256 index = 4;
    uint32 circleParsedSourceDomain;
    uint32 circleParsedTargetDomain;
    uint64 circleNonce;
    bytes32 circleSender;
    bytes32 circleRecipient;
    uint32 payloadSourceDomain = chainIdToCircleDomain[payload.payerChainId];
    uint32 payloadTargetDomain = chainIdToCircleDomain[payload.payableChainId];
    (circleParsedSourceDomain, index) =
      params.circleBridgeMessage.asUint32(index);
    (circleParsedTargetDomain, index) =
      params.circleBridgeMessage.asUint32(index);
    (circleNonce, index) = params.circleBridgeMessage.asUint64(index);
    (circleSender, index) = params.circleBridgeMessage.asBytes32(index);
    (circleRecipient, index) = params.circleBridgeMessage.asBytes32(index);

    if (payloadSourceDomain != circleParsedSourceDomain) {
      revert CircleSourceDomainMismatch();
    }
    if (payloadTargetDomain != circleParsedTargetDomain) {
      revert CircleTargetDomainMismatch();
    }
    if (circleNonce != payload.circleNonce) revert CircleNonceMismatch();
    if (circleSender != registeredForeignContracts[payload.payerChainId]) {
      revert CircleSenderMismatch();
    }
    if (circleRecipient != toWormholeFormat(address(this))) {
      revert CircleRecipientMismatch();
    }

    // Obtain the token that Circle will mint from Circle.
    bytes32 localCircleToken = toWormholeFormat(
      circleTokenMinter().remoteTokensToLocalTokens(
        keccak256(
          abi.encodePacked(
            chainIdToCircleDomain[payload.payerChainId], payload.payerChainToken
          )
        )
      )
    );

    // Ensure that the to-be-minted token is what is expected.
    if (localCircleToken != payload.payableChainToken) {
      revert CircleTokenMismatch();
    }

    /* TRANSFER */
    // Redeem the Circle Message. Minting takes place in this call.
    bool isSuccess = circleTransmitter().receiveMessage(
      params.circleBridgeMessage, params.circleAttestation
    );
    if (!isSuccess) revert CircleMintingFailed();

    /* STATE CHANGES */
    // Record successful payment and activity to the payable.
    payablePaymentId = recordPayablePayment(
      payload.payableId,
      payload.payer,
      payload.payerChainId,
      fromWormholeFormat(payload.payableChainToken),
      payload.amount
    );

    /// Store and consume the Wormhole message.
    consumeWormholeMessage(wormholeMessage);

    // Emit Event.
    emit ConsumedWormholePaymentMessage(
      payload.payableId, payload.payerChainId, wormholeMessage.hash
    );
  }

  /// Transfers the amount of tokens from a payable to the owner host.
  /// @param payableId The ID of the Payable to withdraw from.
  /// @param token The Wormhole-normalized address of the token been withdrawn.
  /// @param amount The Wormhole-normalized (with 8 decimals) amount of the
  /// token.
  /// @return withdrawalId The ID of the withdrawal.
  function withdraw(bytes32 payableId, address token, uint256 amount)
    public
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
    uint256 percent = (amount * config.withdrawalFeePercentage) / 10000; // 10000 is 100%
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
      (isFeesSuccess,) = payable(config.feeCollector).call{value: fees}('');
    } else {
      isFeesSuccess = IERC20(token).transfer(config.feeCollector, fees);
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
    chainWithdrawalIds.push(withdrawalId);
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
}
