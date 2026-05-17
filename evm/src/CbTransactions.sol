// SPDX-License-Identifier: Apache 2
pragma solidity ^0.8.30;

import {IERC20} from '@openzeppelin/contracts/token/ERC20/IERC20.sol';
import {SafeERC20} from '@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol';
import {SafeCast} from '@openzeppelin/contracts/utils/math/SafeCast.sol';
import {BytesParsing} from 'wormhole/libraries/BytesParsing.sol';
import {IWormhole} from 'wormhole/interfaces/IWormhole.sol';
import {toWormholeFormat, fromWormholeFormat} from 'wormhole/Utils.sol';
import {CbUtils} from './CbUtils.sol';
import {CbDecodePayload, CbEncodePaymentPayload} from './CbPayloadMessages.sol';

contract CbTransactions is CbUtils {
  using SafeERC20 for IERC20;
  using BytesParsing for bytes;
  using CbDecodePayload for bytes;
  using CbEncodePaymentPayload for PaymentPayload;

  /// Carries out necessary checks on the token and amount to be paid.
  /// @param token The address of the token to be paid.
  /// @param amount The amount of the token to be paid.
  function _ensurePaymentChecks(address token, uint256 amount) internal view {
    // Ensure that the token is valid.
    if (token == address(0)) revert InvalidTokenAddress();

    // Ensure that the token is supported.
    if (!tokenDetails[token].isSupported) revert UnsupportedToken();

    // Ensure that the amount is greater than zero.
    if (amount == 0) revert ZeroAmountSpecified();
  }

  /// Updates an existing payable balance entry for `token` by adding `amount`.
  /// Returns true if a matching entry was found and updated, false otherwise.
  function _updateBalance(bytes32 payableId, address token, uint256 amount) internal returns (bool) {
    uint8 count = payables[payableId].balancesCount;
    for (uint8 i = 0; i < count; i++) {
      if (payableBalances[payableId][i].token == token) {
        payableBalances[payableId][i].amount += amount;
        return true;
      }
    }
    return false;
  }

  /// Decrements an existing payable balance entry for `token` by `amount`.
  function _deductBalance(bytes32 payableId, address token, uint256 amount) internal {
    uint8 count = payables[payableId].balancesCount;
    for (uint8 i = 0; i < count; i++) {
      if (payableBalances[payableId][i].token == token) {
        payableBalances[payableId][i].amount -= amount;
        return;
      }
    }
    revert NoBalanceForWithdrawalToken();
  }

  /// Parses and validates Circle v2 burn message fields.
  ///
  /// CCTP v2 header layout (148 bytes total):
  ///   version(4) | srcDomain(4) | destDomain(4) | nonce(32) | sender(32) | recipient(32)
  ///   | destinationCaller(32) | minFinalityThreshold(4) | maxFee(4)
  ///
  /// In CCTP v2, header `sender` and `recipient` are both the Circle TokenMessenger
  /// address (an intermediary), not the application contracts. The actual Chainbills
  /// proxy (depositor) is encoded in the message body, and `destinationCaller` names
  /// which contract is authorised to call receiveMessage on the destination chain.
  ///
  /// CCTP v2 body layout (starts at byte 148):
  ///   version(4) | burnToken(32) | mintRecipient(32) | amount(32) | depositor(32) | ...
  function _checkCircleMessage(
    bytes memory circleBridgeMessage,
    bytes32 payerChainId,
    bytes32 payableChainId,
    uint256 expectedAmount
  ) internal view {
    uint256 index = 4;
    uint32 parsedSourceDomain;
    uint32 parsedTargetDomain;
    bytes32 destinationCaller;
    (parsedSourceDomain, index) = circleBridgeMessage.asUint32(index);
    (parsedTargetDomain, index) = circleBridgeMessage.asUint32(index);
    index += 32; // skip nonce (v2: 32 bytes at offset 12)
    index += 32; // skip sender (Circle TokenMessenger on source — not the depositor)
    index += 32; // skip recipient (Circle TokenMessenger on dest — not this contract)
    (destinationCaller, index) = circleBridgeMessage.asBytes32(index); // bytes 108-139
    if (cbChainIdToCircleDomain[payerChainId] != parsedSourceDomain) revert CircleSourceDomainMismatch();
    if (cbChainIdToCircleDomain[payableChainId] != parsedTargetDomain) revert CircleTargetDomainMismatch();
    // destinationCaller must be this contract — Circle enforces only it can call receiveMessage.
    if (destinationCaller != toWormholeFormat(address(this))) revert CircleRecipientMismatch();

    // Body: depositor at 148 + 4 + 32 + 32 + 32 = 248 — the Chainbills proxy that called depositForBurn.
    bytes32 depositor;
    (depositor,) = circleBridgeMessage.asBytes32(248);
    if (depositor != registeredForeignContracts[payerChainId]) revert CircleSenderMismatch();

    // Body: amount at 148 + 4 + 32 + 32 = 216.
    uint256 burnAmount;
    (burnAmount,) = circleBridgeMessage.asUint256(216);
    if (burnAmount != expectedAmount) revert CircleAmountMismatch();
  }

  /// Looks up the local Circle token for the given foreign chain token and
  /// reverts with CircleTokenMismatch if it does not match `payableChainToken`.
  function _checkCircleToken(bytes32 payerChainId, bytes32 payerChainToken, bytes32 payableChainToken) internal view {
    bytes32 localToken = toWormholeFormat(
      circleTokenMinter()
        .remoteTokensToLocalTokens(keccak256(abi.encodePacked(cbChainIdToCircleDomain[payerChainId], payerChainToken)))
    );
    if (localToken != payableChainToken) revert CircleTokenMismatch();
  }

  /// Records successful payments and activity from a payer.
  /// @param payableId The ID of the payable that was paid into.
  /// @param payableChainId CAIP-2 cbChainId of the payable's chain.
  /// @param token The address of the token that was paid.
  /// @param amount The amount paid.
  /// @return userPaymentId The ID of the recorded payment from the user.
  function _recordUserPayment(bytes32 payableId, bytes32 payableChainId, address token, uint256 amount)
    internal
    returns (bytes32 userPaymentId)
  {
    // Increment paymentsCount in the payer that just paid.
    _initializeUserIfNeedBe(msg.sender);
    users[msg.sender].paymentsCount++;
    users[msg.sender].activitiesCount++;

    // Increment the chainStats for payments and activities counts.
    chainStats.userPaymentsCount++;
    chainStats.activitiesCount++;

    // Increase the supported token's total from this payment.
    tokenDetails[token].totalUserPaid += amount;

    // Record payment details of user.
    userPaymentId = _createId(toWormholeFormat(msg.sender), EntityType.Payment, users[msg.sender].paymentsCount);
    chainUserPaymentIds.push(userPaymentId);
    userPaymentIds[msg.sender].push(userPaymentId);
    userPayments[userPaymentId] = UserPayment({
      payableId: payableId,
      payer: msg.sender,
      token: token,
      payableChainId: payableChainId,
      chainCount: chainStats.userPaymentsCount,
      payerCount: users[msg.sender].paymentsCount,
      timestamp: block.timestamp,
      amount: amount
    });

    // Record User Activity.
    bytes32 userActivityId =
      _createId(toWormholeFormat(msg.sender), EntityType.Activity, users[msg.sender].activitiesCount);
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
  /// @param payerChainId CAIP-2 cbChainId of the payer's chain.
  /// @param token The address of the token that was paid.
  /// @param amount The amount paid.
  /// @return payablePaymentId The ID of the recorded payment from the user.
  function _recordPayablePayment(bytes32 payableId, bytes32 payer, bytes32 payerChainId, address token, uint256 amount)
    internal
    returns (bytes32 payablePaymentId)
  {
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
    if (!_updateBalance(payableId, token, amount)) {
      payableBalances[payableId].push(TokenAndAmount({token: token, amount: amount}));
      _payable.balancesCount++;
    }

    // Increase the supported token's totals from this payment.
    tokenDetails[token].totalPayableReceived += amount;

    // Record payment details of payable.
    payablePaymentId = _createId(payableId, EntityType.Payment, _payable.paymentsCount);
    chainPayablePaymentIds.push(payablePaymentId);
    payablePaymentIds[payableId].push(payablePaymentId);
    payableChainPaymentIds[payableId][payerChainId].push(payablePaymentId);
    payablePayments[payablePaymentId] = PayablePayment({
      payableId: payableId,
      payer: payer,
      token: token,
      chainCount: chainStats.payablePaymentsCount,
      payerChainId: payerChainId,
      localChainCount: payableChainPaymentsCount[payableId][payerChainId],
      payableCount: _payable.paymentsCount,
      timestamp: block.timestamp,
      amount: amount
    });

    // Record Payable Activity.
    bytes32 payableActivityId = _createId(payableId, EntityType.Activity, _payable.activitiesCount);
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
    emit PayableReceived(
      payableId, payer, payablePaymentId, payerChainId, chainStats.payablePaymentsCount, _payable.paymentsCount
    );
  }

  /// Transfers out and records a withdrawal to a payable's owner.
  /// @param payableId The ID of the Payable to withdraw from.
  /// @param token The address of the token been withdrawn.
  /// @param amount The amount of the token.
  /// @return withdrawalId The ID of the withdrawal.
  function _actualizeWithdrawal(bytes32 payableId, address token, uint256 amount)
    internal
    returns (bytes32 withdrawalId)
  {
    // Prepare withdraw amounts and fees.
    // 10000 is 100%, that is accounting for 2 decimal places.
    uint256 percent = (amount * config.withdrawalFeePercentage) / 10000;
    uint256 maxFees = tokenDetails[token].maxWithdrawalFees;
    uint256 fees = percent > maxFees ? maxFees : percent;
    uint256 amtDue = amount - fees;

    /* STATE CHANGES */
    Payable storage _payable = payables[payableId];
    // Increment the chainStats for withdrawalsCount and activitiesCount.
    chainStats.withdrawalsCount++;
    chainStats.activitiesCount++;

    // Increment withdrawalsCount and activitiesCount in the host (address)
    // that just withdrew.
    users[_payable.host].withdrawalsCount++;
    users[_payable.host].activitiesCount++;

    // Increment withdrawalsCount and activitiesCount on involved payable.
    _payable.withdrawalsCount++;
    _payable.activitiesCount++;

    // Deduct the balances on the involved payable.
    _deductBalance(payableId, token, amount);

    // Increase the supported token's totals from this withdrawal.
    tokenDetails[token].totalWithdrawn += amount;
    tokenDetails[token].totalWithdrawalFeesCollected += fees;

    // Initialize the withdrawal.
    withdrawalId =
      _createId(toWormholeFormat(_payable.host), EntityType.Withdrawal, users[_payable.host].withdrawalsCount);
    chainWithdrawalIds.push(withdrawalId);
    userWithdrawalIds[_payable.host].push(withdrawalId);
    payableWithdrawalIds[payableId].push(withdrawalId);
    withdrawals[withdrawalId] = Withdrawal({
      payableId: payableId,
      host: _payable.host,
      token: token,
      chainCount: chainStats.withdrawalsCount,
      hostCount: users[_payable.host].withdrawalsCount,
      payableCount: _payable.withdrawalsCount,
      timestamp: block.timestamp,
      amount: amount
    });

    // Record the Activity.
    bytes32 activityId =
      _createId(toWormholeFormat(_payable.host), EntityType.Activity, users[_payable.host].activitiesCount);
    chainActivityIds.push(activityId);
    userActivityIds[_payable.host].push(activityId);
    payableActivityIds[payableId].push(activityId);
    activities[activityId] = ActivityRecord({
      chainCount: chainStats.activitiesCount,
      userCount: users[_payable.host].activitiesCount,
      payableCount: _payable.activitiesCount,
      timestamp: block.timestamp,
      entity: withdrawalId,
      activityType: ActivityType.Withdrew
    });

    // Emit Event.
    emit Withdrew(
      payableId,
      _payable.host,
      withdrawalId,
      chainStats.withdrawalsCount,
      users[_payable.host].withdrawalsCount,
      _payable.withdrawalsCount
    );

    /* TRANSFER */
    // External calls come last (CEI). The native `.call` transfers funds
    // directly from the proxy's balance since this runs via delegatecall.
    if (token == address(this)) {
      (bool s1,) = payable(_payable.host).call{value: amtDue}('');
      if (!s1) revert UnsuccessfulWithdrawal();
      (bool s2,) = payable(config.feeCollector).call{value: fees}('');
      if (!s2) revert UnsuccessfulFeesWithdrawal();
    } else {
      IERC20(token).safeTransfer(_payable.host, amtDue);
      IERC20(token).safeTransfer(config.feeCollector, fees);
    }
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
    returns (bytes32 userPaymentId, bytes32 payablePaymentId)
  {
    /* CHECKS */
    // Basic Payment Checks
    _ensurePaymentChecks(token, amount);

    // Ensure that the payable exists and it is not closed
    Payable storage _payable = payables[payableId];
    if (_payable.host == address(0)) revert InvalidPayableId();
    if (_payable.isClosed) revert PayableIsClosed();

    // If this payable specified the tokens and amounts it can accept, ensure
    // that the token and amount are matching.
    uint8 aTaaLength = _payable.allowedTokensAndAmountsCount;
    if (aTaaLength > 0) {
      bool found = false;
      for (uint8 i = 0; i < aTaaLength; i++) {
        TokenAndAmount storage ataa = payableAllowedTokensAndAmounts[payableId][i];
        if (ataa.token == token && ataa.amount == amount) {
          found = true;
          break;
        }
      }
      if (!found) revert MatchingTokenAndAmountNotFound();
    }

    /* TRANSFER */
    // If paid amount is native token, confirm that the balance matches.
    // Otherwise, use ERC20 and ensure it went through.
    if (token == address(this)) {
      if (msg.value < amount) revert InsufficientPaymentValue();
      if (msg.value > amount) revert IncorrectPaymentValue();
    } else {
      IERC20(token).safeTransferFrom(msg.sender, address(this), amount);
    }

    /* STATE CHANGES */
    // Record successful payment and activity from the payer.
    // Use config.cbChainId as the payable chain ID (this chain).
    userPaymentId = _recordUserPayment(payableId, config.cbChainId, token, amount);

    // Record successful payment and activity to the payable.
    // Use config.cbChainId as the payer chain ID (this chain).
    payablePaymentId = _recordPayablePayment(payableId, toWormholeFormat(msg.sender), config.cbChainId, token, amount);

    if (_payable.isAutoWithdraw) _actualizeWithdrawal(payableId, token, amount);
  }

  /// Transfers the amount of tokens from a payer to a foreign payable.
  /// @param payableId The ID of the payable to pay into.
  /// @param token The address of the token been paid.
  /// @param amount The amount of the token.
  /// @return userPaymentId The ID of the recorded payment from the user.
  /// @return wormholeMessageSequence The sequence number of the Wormhole
  /// message.
  function payForeignWithCircle(bytes32 payableId, address token, uint256 amount)
    public
    payable
    returns (bytes32 userPaymentId, uint64 wormholeMessageSequence)
  {
    /* CHECKS */
    // Basic Payment Checks
    _ensurePaymentChecks(token, amount);

    // Only require Wormhole fees on chains that have Wormhole configured.
    if (hasWormhole()) _ensureWormholeFees();

    // Ensure that the foreign payable exists
    PayableForeign storage _payable = foreignPayables[payableId];
    if (_payable.chainId == bytes32(0)) revert InvalidPayableId();
    if (_payable.isClosed) revert PayableIsClosed();

    // Verify the destination chain's Circle domain is properly configured.
    // Roundtrip check: domain→cbChainId must equal _payable.chainId, confirming
    // registerChainCircleDomain was called. Prevents sending a burn to domain 0
    // (Ethereum) just because the mapping was never set for the target chain.
    uint32 destDomain = cbChainIdToCircleDomain[_payable.chainId];
    if (circleDomainToCbChainId[destDomain] != _payable.chainId) revert InvalidCircleDomain();

    // If this payable specified the tokens and amounts it can accept, ensure
    // that the token and amount are matching.
    uint8 aTaaLength = _payable.allowedTokensAndAmountsCount;
    if (aTaaLength > 0) {
      bool found = false;
      for (uint8 i = 0; i < aTaaLength; i++) {
        TokenAndAmountForeign storage ataa = foreignPayableAllowedTokensAndAmounts[payableId][i];
        address matchingToken = forForeignChainMatchingTokenAddresses[_payable.chainId][ataa.token];
        if (matchingToken == token && ataa.amount == SafeCast.toUint64(amount)) {
          found = true;
          break;
        }
      }
      if (!found) revert MatchingTokenAndAmountNotFound();
    }

    /* STATE CHANGES */
    // Record successful payment and activity from the payer.
    // All inputs are known before any external calls.
    userPaymentId = _recordUserPayment(payableId, _payable.chainId, token, amount);

    // Build and encode PaymentPayload for cross-chain delivery.
    bytes32 foreignTokenAddr = forTokenAddressMatchingForeignChainTokens[token][_payable.chainId];
    bytes memory encodedPayload = PaymentPayload({
        payloadType: 2,
        version: 1,
        actionType: 5,
        payableId: payableId,
        circleNonce: 0,
        amount: SafeCast.toUint64(amount),
        payableChainToken: foreignTokenAddr,
        payableChainId: _payable.chainId,
        payer: toWormholeFormat(msg.sender),
        payerChainToken: toWormholeFormat(token),
        payerChainId: config.cbChainId
      }).encode();

    /* INTERACTIONS */
    // Pull tokens from payer into this contract.
    IERC20(token).safeTransferFrom(msg.sender, address(this), amount);

    // Approve the Circle Bridge to spend tokens.
    SafeERC20.safeIncreaseAllowance(IERC20(token), config.circleBridge, amount);

    // destinationCaller is set to the registered Chainbills contract on the destination chain.
    // This restricts the burn and data messages to only be submittable by our own contract,
    // ensures that consume the messaging and receiving the funds are always in one call.
    bytes32 destContract = registeredForeignContracts[_payable.chainId];

    // Burn tokens via Circle CCTP.
    circleBridge().depositForBurn(amount, destDomain, destContract, token, destContract, 0, 2000);

    if (hasWormhole()) {
      wormholeMessageSequence = _publishPayloadMessage(encodedPayload);
    } else {
      // CCTP-only: send PaymentPayload as a Circle data message.
      // destinationCaller is set so only Chainbills on dest can process it.
      circleTransmitter().sendMessage(destDomain, destContract, destContract, 2000, encodedPayload);
      wormholeMessageSequence = 0;
    }
  }

  /// Receives a payment to a payable from another chain.
  /// @param params The parameters for redeeming a payment from another chain.
  /// Specifically:
  /// - wormholeEncoded The encoded message from Wormhole.
  /// - circleBridgeMessage The encoded message from Circle Bridge.
  /// - circleAttestation The encoded attestation from Circle.
  /// @return payablePaymentId The ID of the recorded payment from the payable.
  function receiveForeignPaymentWithCircle(RedeemCirclePaymentParameters memory params)
    public
    returns (bytes32 payablePaymentId)
  {
    if (params.wormholeEncoded.length > 0) {
      // ── Wormhole path ────────────────────────────────────────────────────────
      IWormhole.VM memory wormholeMessage = _parseAndCheckWormholeMessage(params.wormholeEncoded);
      PaymentPayload memory payload = wormholeMessage.payload.decodePaymentPayload();

      bytes32 payableId = payload.payableId;
      Payable storage _payable = payables[payableId];
      if (_payable.host == address(0)) revert InvalidPayableId();

      _checkCircleMessage(
        params.circleBridgeMessage, payload.payerChainId, payload.payableChainId, uint256(payload.amount)
      );
      _checkCircleToken(payload.payerChainId, payload.payerChainToken, payload.payableChainToken);

      bool isSuccess = circleTransmitter().receiveMessage(params.circleBridgeMessage, params.circleAttestation);
      if (!isSuccess) revert CircleMintingFailed();

      address token = fromWormholeFormat(payload.payableChainToken);
      uint256 amount = uint256(payload.amount);
      payablePaymentId = _recordPayablePayment(payableId, payload.payer, payload.payerChainId, token, amount);

      consumeWormholeMessage(wormholeMessage);
      bytes32 srcCbChainId = wormholeChainIdToCbChainId[wormholeMessage.emitterChainId];
      emit ConsumedWormholePaymentMessage(payableId, srcCbChainId, wormholeMessage.hash);

      if (_payable.isAutoWithdraw) _actualizeWithdrawal(payableId, token, amount);
    } else if (params.circlePayloadMessage.length > 0) {
      // ── CCTP-only path ───────────────────────────────────────────────────────
      // Step 1: Minimal header validation before Circle attestation check.
      // Read only the fields needed to verify the message came from a registered
      // source. Full payload decode happens after Circle confirms authenticity.
      uint256 hIdx = 4; // skip 4-byte message version
      uint32 payloadSrcDomain;
      bytes32 payloadSender;
      bytes32 payloadRecipient;
      (payloadSrcDomain, hIdx) = params.circlePayloadMessage.asUint32(hIdx);
      hIdx += 4; // skip destDomain
      hIdx += 32; // skip bytes32 nonce (v2)
      (payloadSender, hIdx) = params.circlePayloadMessage.asBytes32(hIdx);
      (payloadRecipient, hIdx) = params.circlePayloadMessage.asBytes32(hIdx);

      // Validate data message source domain → registered cbChainId.
      bytes32 dataMsgSrcChainId = circleDomainToCbChainId[payloadSrcDomain];
      if (dataMsgSrcChainId == bytes32(0)) revert InvalidCircleDomain();

      // Validate sender is the registered Chainbills on source chain.
      if (payloadSender != registeredForeignContracts[dataMsgSrcChainId]) revert CircleSenderMismatch();

      // Validate recipient is this contract.
      if (payloadRecipient != toWormholeFormat(address(this))) revert CircleRecipientMismatch();

      // Step 2: Submit data message to Circle FIRST.
      // Circle verifies the attestation signature and nonce (preventing replay),
      // then calls handleReceiveFinalizedMessage on this contract (type 0x02 → no-op).
      // Only after this verification do we trust the message body bytes.
      bool dataSuccess =
        circleTransmitter().receiveMessage(params.circlePayloadMessage, params.circlePayloadAttestation);
      if (!dataSuccess) revert CircleMessageReceivingFailed();

      // Step 3: Decode PaymentPayload from Circle-verified message body.
      // Body starts at byte 148 (after the CCTP v2 148-byte header).
      // payloadType is the first byte of the body (now embedded in the struct).
      PaymentPayload memory payload = params.circlePayloadMessage.decodePaymentPayload(148);

      // Validate no trailing bytes in the message (148-byte header + 211-byte payload).
      if (params.circlePayloadMessage.length != 359) revert InvalidPayload();

      // Step 4: Validate the payable exists locally.
      bytes32 payableId = payload.payableId;
      Payable storage _payable = payables[payableId];
      if (_payable.host == address(0)) revert InvalidPayableId();

      // Step 5: Validate burn message header (domain, sender, recipient) AND amount.
      _checkCircleMessage(
        params.circleBridgeMessage, payload.payerChainId, payload.payableChainId, uint256(payload.amount)
      );

      // Step 6: Validate the token type via Circle's TokenMinter mapping.
      _checkCircleToken(payload.payerChainId, payload.payerChainToken, payload.payableChainToken);

      // Step 7: Replay protection for the burn message
      bytes32 burnNonce;
      (burnNonce,) = params.circleBridgeMessage.asBytes32(12);
      if (consumedCctpBurnNonces[payloadSrcDomain][burnNonce]) revert CctpBurnNonceAlreadyConsumed();
      consumedCctpBurnNonces[payloadSrcDomain][burnNonce] = true;

      // Step 8: Submit burn message to Circle — mints USDC to this contract.
      bool isSuccess = circleTransmitter().receiveMessage(params.circleBridgeMessage, params.circleAttestation);
      if (!isSuccess) revert CircleMintingFailed();

      address token = fromWormholeFormat(payload.payableChainToken);
      uint256 amount = uint256(payload.amount);

      // Step 9: Record the payment.
      payablePaymentId = _recordPayablePayment(payableId, payload.payer, payload.payerChainId, token, amount);

      emit ReceivedForeignPaymentViaCircle(payableId, payload.payerChainId, payablePaymentId);

      if (_payable.isAutoWithdraw) _actualizeWithdrawal(payableId, token, amount);
    } else {
      revert InvalidPayload();
    }
  }

  /// Transfers the amount of tokens from a payable to the owner host.
  /// @param payableId The ID of the Payable to withdraw from.
  /// @param token The address of the token been withdrawn.
  /// @param amount The amount of the token.
  /// @return withdrawalId The ID of the withdrawal.
  function withdraw(bytes32 payableId, address token, uint256 amount) public returns (bytes32 withdrawalId) {
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

    /* ACTION */
    // Make transfer and update state by calling helper function.
    withdrawalId = _actualizeWithdrawal(payableId, token, amount);
  }
}
