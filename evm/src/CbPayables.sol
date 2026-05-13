// SPDX-License-Identifier: Apache 2
pragma solidity ^0.8.20;

import 'wormhole/interfaces/IWormhole.sol';
import 'wormhole/Utils.sol';
import './CbPayloadMessages.sol';
import './CbUtils.sol';

contract CbPayables is CbUtils {
  using CbDecodePayload for bytes;
  using CbEncodePayablePayload for PayablePayload;

  /// Create a Payable.
  /// @param allowedTokensAndAmounts The accepted tokens (and their amounts) on
  /// the payable. If empty, then the payable will accept payments in any token.
  /// @param isAutoWithdraw Whether payments to this payable get auto-withdrawn
  /// to the host.
  /// @return payableId The ID of the newly created payable.
  /// @return wormholeMessageSequence The sequence of the published Wormhole
  /// message.
  function createPayable(TokenAndAmount[] calldata allowedTokensAndAmounts, bool isAutoWithdraw)
    public
    payable
    returns (bytes32 payableId, uint64 wormholeMessageSequence)
  {
    /* CHECKS */
    // Ensure that the allowedTokensAndAmounts are valid.
    uint8 ataaLength = uint8(allowedTokensAndAmounts.length);
    for (uint8 i = 0; i < ataaLength; i++) {
      // Ensure tokens are valid.
      address token = allowedTokensAndAmounts[i].token;
      if (token == address(0)) revert InvalidTokenAddress();

      // Ensure that the token is supported.
      if (!tokenDetails[token].isSupported) revert UnsupportedToken();

      // Ensure that the specified amount is greater than zero.
      if (allowedTokensAndAmounts[i].amount == 0) revert ZeroAmountSpecified();
    }

    // Ensure that the required Wormhole Fees were paid.
    if (hasWormhole()) _ensureWormholeFees();

    /* STATE CHANGES */
    // Increment payables and activities counts on the host (address) creating
    // this payable.
    _initializeUserIfNeedBe(msg.sender);
    users[msg.sender].payablesCount++;
    users[msg.sender].activitiesCount++;

    // Increment the chainStats for payablesCount and activitiesCount.
    chainStats.payablesCount++;
    chainStats.activitiesCount++;

    // Create the payable.
    payableId = _createId(toWormholeFormat(msg.sender), EntityType.Payable, users[msg.sender].payablesCount);
    chainPayableIds.push(payableId);
    userPayableIds[msg.sender].push(payableId);
    Payable storage _payable = payables[payableId];
    _payable.chainCount = chainStats.payablesCount;
    _payable.host = msg.sender;
    _payable.hostCount = users[msg.sender].payablesCount;
    _payable.allowedTokensAndAmountsCount = ataaLength;
    _payable.createdAt = block.timestamp;
    _payable.activitiesCount = 1; // for creation
    _payable.isAutoWithdraw = isAutoWithdraw;

    // Store ATAA locally and prepare the foreign equivalents in the same loop.
    TokenAndAmountForeign[] memory foreignAtaa = new TokenAndAmountForeign[](ataaLength);
    for (uint8 i = 0; i < ataaLength; i++) {
      address token = allowedTokensAndAmounts[i].token;
      uint256 amount = allowedTokensAndAmounts[i].amount;

      // Set the local allowedTokenAndAmount directly
      payableAllowedTokensAndAmounts[payableId].push(TokenAndAmount(token, amount));

      // Set the foreign allowedTokensAndAmounts.
      foreignAtaa[i] = TokenAndAmountForeign({token: toWormholeFormat(token), amount: uint64(amount)});
    }

    // Record the Activity.
    bytes32 activityId = _createId(toWormholeFormat(msg.sender), EntityType.Activity, users[msg.sender].activitiesCount);
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
    emit CreatedPayable(payableId, msg.sender, _payable.chainCount, _payable.hostCount);

    // Broadcast payable creation to all registered foreign chains via available
    // protocols (Wormhole one-shot + CCTP per CCTP-capable chain).
    wormholeMessageSequence = _broadcastPayableUpdate(
      PayablePayload({
        version: 1,
        actionType: 1,
        payableId: payableId,
        nonce: 0, // set inside _broadcastPayableUpdate
        isClosed: false,
        allowedTokensAndAmounts: foreignAtaa
      })
    );
  }

  /// Records an activity for updating a Payable.
  /// @param payableId The ID of the payable being updated.
  /// @param activityType The type of activity being recorded.
  function _recordUpdatePayableActivity(bytes32 payableId, ActivityType activityType) internal {
    // Increment the chainStats for activitiesCount.
    chainStats.activitiesCount++;

    // Increment activitiesCount on the user.
    users[msg.sender].activitiesCount++;

    // Increment activitiesCount on the involved payable.
    payables[payableId].activitiesCount++;

    // Record the Activity.
    bytes32 activityId = _createId(toWormholeFormat(msg.sender), EntityType.Activity, users[msg.sender].activitiesCount);
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

  /// Stop a payable from accepting payments. Should be called only by the host
  /// (address) that owns the payable.
  /// @param payableId The ID of the payable to close.
  /// @return wormholeMessageSequence The sequence of the published Wormhole
  /// message.
  function closePayable(bytes32 payableId) public payable returns (uint64 wormholeMessageSequence) {
    /* CHECKS */
    // Ensure that the caller owns the payable.
    Payable storage _payable = payables[payableId];
    if (_payable.host != msg.sender) revert NotYourPayable();

    // Ensure that the payable is not already closed.
    if (_payable.isClosed) revert PayableIsAlreadyClosed();

    // Ensure that the required Wormhole Fees were paid.
    if (hasWormhole()) _ensureWormholeFees();

    /* STATE CHANGES */
    // Close the payable.
    _payable.isClosed = true;

    // Record the Activity.
    _recordUpdatePayableActivity(payableId, ActivityType.ClosedPayable);

    // Emit Event.
    emit ClosedPayable(payableId, msg.sender);

    // Broadcast payable close to all registered foreign chains.
    wormholeMessageSequence = _broadcastPayableUpdate(
      PayablePayload({
        version: 1,
        actionType: 2,
        payableId: payableId,
        nonce: 0,
        isClosed: true,
        allowedTokensAndAmounts: new TokenAndAmountForeign[](0)
      })
    );
  }

  /// Allow a closed payable to continue accepting payments. Should be called
  /// only by the host (address) that owns the payable.
  /// @param payableId The ID of the payable to re-open.
  /// @return wormholeMessageSequence The sequence of the published Wormhole
  /// message.
  function reopenPayable(bytes32 payableId) public payable returns (uint64 wormholeMessageSequence) {
    /* CHECKS */
    // Ensure that the caller owns the payable.
    Payable storage _payable = payables[payableId];
    if (_payable.host != msg.sender) revert NotYourPayable();

    // Ensure that the payable is closed.
    if (!_payable.isClosed) revert PayableIsNotClosed();

    // Ensure that the required Wormhole Fees were paid.
    if (hasWormhole()) _ensureWormholeFees();

    /* STATE CHANGES */
    // Close the payable.
    _payable.isClosed = false;

    // Record the Activity.
    _recordUpdatePayableActivity(payableId, ActivityType.ReopenedPayable);

    // Emit Event.
    emit ReopenedPayable(payableId, msg.sender);

    // Broadcast payable reopen to all registered foreign chains.
    wormholeMessageSequence = _broadcastPayableUpdate(
      PayablePayload({
        version: 1,
        actionType: 3,
        payableId: payableId,
        nonce: 0,
        isClosed: false,
        allowedTokensAndAmounts: new TokenAndAmountForeign[](0)
      })
    );
  }

  /// Allows a payable's host to update the payable's allowedTokensAndAmounts.
  /// @param payableId The ID of the payable to update.
  /// @param allowedTokensAndAmounts The new tokens and amounts array.
  /// @return wormholeMessageSequence The sequence of the published Wormhole
  /// message.
  function updatePayableAllowedTokensAndAmounts(bytes32 payableId, TokenAndAmount[] calldata allowedTokensAndAmounts)
    public
    payable
    returns (uint64 wormholeMessageSequence)
  {
    /* CHECKS */
    // Ensure that the caller owns the payable.
    Payable storage _payable = payables[payableId];
    if (_payable.host != msg.sender) revert NotYourPayable();

    // Clear the currently stored allowedTokensAndAmounts for the payable
    for (uint8 i = _payable.allowedTokensAndAmountsCount; i > 0; i--) {
      // Remove all previously set ATAAs in storage by popping
      payableAllowedTokensAndAmounts[payableId].pop();
    }

    // Ensure that the allowedTokensAndAmounts are valid.
    uint8 ataaLength = uint8(allowedTokensAndAmounts.length);
    for (uint8 i = 0; i < ataaLength; i++) {
      // Ensure tokens are valid.
      address token = allowedTokensAndAmounts[i].token;
      if (token == address(0)) revert InvalidTokenAddress();

      // Ensure that the token is supported.
      if (!tokenDetails[token].isSupported) revert UnsupportedToken();

      // Ensure that the specified amount is greater than zero.
      if (allowedTokensAndAmounts[i].amount == 0) revert ZeroAmountSpecified();
    }

    // Ensure that the required Wormhole Fees were paid.
    if (hasWormhole()) _ensureWormholeFees();

    /* STATE CHANGES */
    // Update the payable's allowedTokensAndAmounts count
    _payable.allowedTokensAndAmountsCount = ataaLength;

    // Store ATAA locally and prepare the foreign equivalents in the same loop.
    TokenAndAmountForeign[] memory foreignAtaa = new TokenAndAmountForeign[](ataaLength);
    for (uint8 i = 0; i < ataaLength; i++) {
      address token = allowedTokensAndAmounts[i].token;
      uint256 amount = allowedTokensAndAmounts[i].amount;

      // Set the local allowedTokenAndAmount directly
      payableAllowedTokensAndAmounts[payableId].push(TokenAndAmount(token, amount));

      // Set the foreign allowedTokensAndAmounts.
      foreignAtaa[i] = TokenAndAmountForeign({token: toWormholeFormat(token), amount: uint64(amount)});
    }

    // Record the Activity.
    _recordUpdatePayableActivity(payableId, ActivityType.UpdatedPayableAllowedTokensAndAmounts);

    // Emit Event.
    emit UpdatedPayableAllowedTokensAndAmounts(payableId, msg.sender);

    // Broadcast ATAA update to all registered foreign chains.
    wormholeMessageSequence = _broadcastPayableUpdate(
      PayablePayload({
        version: 1,
        actionType: 4,
        payableId: payableId,
        nonce: 0,
        isClosed: false,
        allowedTokensAndAmounts: foreignAtaa
      })
    );
  }

  /// Allows a payable's host to update the payable's autoWithdraw setting.
  /// @param payableId The ID of the payable to update.
  /// @param isAutoWithdraw Whether payments to this payable get auto-withdrawn
  /// to the host.
  function updatePayableAutoWithdraw(bytes32 payableId, bool isAutoWithdraw) public {
    /* CHECKS */
    // Ensure that the caller owns the payable.
    Payable storage _payable = payables[payableId];
    if (_payable.host != msg.sender) revert NotYourPayable();

    /* STATE CHANGES */
    // Set the autoWithdraw status
    _payable.isAutoWithdraw = isAutoWithdraw;

    // Record the Activity.
    _recordUpdatePayableActivity(payableId, ActivityType.UpdatedPayableAutoWithdrawStatus);

    // Emit Event.
    emit UpdatedPayableAutoWithdrawStatus(payableId, msg.sender, isAutoWithdraw);

    // Not Publishing to Wormhole because this setting is not relevant to
    // foreign chain payments.
  }

  /// Publishes a payable's details to Wormhole. Useful when Wormhole is setup
  /// in this chain after the payable was created and wasn't published through
  /// Wormhole.
  /// @param payableId The ID of the payable to publish.
  /// @return wormholeMessageSequence The sequence of the published Wormhole
  /// message.
  function publishPayableDetails(bytes32 payableId) public payable returns (uint64 wormholeMessageSequence) {
    /* CHECKS */
    // Ensure that the caller owns the payable.
    Payable storage _payable = payables[payableId];
    if (_payable.host != msg.sender) revert NotYourPayable();

    // Prepare the foreign allowedTokensAndAmounts.
    uint8 ataaLength = _payable.allowedTokensAndAmountsCount;
    TokenAndAmountForeign[] memory foreignAtaa = new TokenAndAmountForeign[](ataaLength);
    for (uint8 i = 0; i < ataaLength; i++) {
      // Set the foreign allowedTokensAndAmounts.
      foreignAtaa[i] = TokenAndAmountForeign({
        token: toWormholeFormat(payableAllowedTokensAndAmounts[payableId][i].token),
        amount: uint64(payableAllowedTokensAndAmounts[payableId][i].amount)
      });
    }

    // Ensure that the required Wormhole Fees were paid.
    if (hasWormhole()) _ensureWormholeFees();

    /* STATE CHANGES */
    // Broadcast current payable state to all registered foreign chains.
    wormholeMessageSequence = _broadcastPayableUpdate(
      PayablePayload({
        version: 1,
        actionType: 1,
        payableId: payableId,
        nonce: 0,
        isClosed: _payable.isClosed,
        allowedTokensAndAmounts: foreignAtaa
      })
    );
  }

  /// Records Payable Changes (Creation/Updates) from another chain via Wormhole.
  /// Applies nonce-based ordering so out-of-order Wormhole deliveries are rejected.
  /// @param wormholeEncoded The encoded VAA from Wormhole.
  function receivePayableUpdateViaWormhole(bytes memory wormholeEncoded) public {
    // Verify VAA signature, emitter registration, and replay protection.
    IWormhole.VM memory wormholeMessage = _parseAndCheckWormholeMessage(wormholeEncoded);

    // Source chain is authoritative from the VAA header — Wormhole already
    // verified the emitter chain. Resolve to CAIP-2 cbChainId.
    bytes32 srcCbChainId = wormholeChainIdToCbChainId[wormholeMessage.emitterChainId];

    // Decode payload (version 2 required).
    PayablePayload memory payload = wormholeMessage.payload.decodePayablePayload();

    // Nonce ordering: reject if this update is not strictly newer than what we
    // have already applied (whether via Wormhole or CCTP).
    uint64 lastNonce = payableUpdateNonces[payload.payableId][srcCbChainId];
    if (payload.nonce <= lastNonce) revert StalePayableUpdateNonce();
    payableUpdateNonces[payload.payableId][srcCbChainId] = payload.nonce;

    // Apply state changes.
    _applyPayablePayloadUpdate(payload, srcCbChainId);

    // Mark VAA as consumed (replay protection).
    consumeWormholeMessage(wormholeMessage);

    // Emit Events.
    emit ConsumedWormholePayableMessage(payload.payableId, srcCbChainId, wormholeMessage.hash);
    emit ReceivedPayableUpdateViaWormhole(payload.payableId, srcCbChainId, payload.nonce);
  }

  /// Manually submits a CCTP attestation for a payable-update message.
  /// Anyone can call this — Circle's MessageTransmitter verifies the attestation
  /// and then calls handleReceiveMessage() on this contract.
  /// Mirrors the pattern of receiveForeignPaymentWithCircle for payment messages.
  /// @param message The Circle message bytes.
  /// @param attestation Circle's attestation bytes.
  function receivePayableUpdateViaCircle(bytes calldata message, bytes calldata attestation) public {
    bool success = circleTransmitter().receiveMessage(message, attestation);
    if (!success) revert CircleMintingFailed();
  }

  /// Called by Circle's MessageTransmitter when a CCTP payable-update message
  /// is relayed to this chain. The MessageTransmitter verifies the attestation
  /// before calling this function, so we only need to verify the sender and
  /// apply nonce-based ordering.
  ///
  /// This is the IMessageHandler callback — the recipient set in sendMessage()
  /// on the source chain must be this contract's address.
  ///
  /// @param sourceDomain Circle domain of the source chain.
  /// @param sender Wormhole-formatted address of the sending contract.
  /// @param messageBody Encoded PayablePayload (version 2).
  /// @return true on success (required by IMessageHandler interface).
  function handleReceiveMessage(uint32 sourceDomain, bytes32 sender, bytes calldata messageBody)
    public
    returns (bool)
  {
    // Only Circle's MessageTransmitter may call this function.
    if (msg.sender != config.circleTransmitter) revert CircleTransmitterOnly();

    // Resolve Circle domain to CAIP-2 cbChainId.
    bytes32 srcCbChainId = circleDomainToCbChainId[sourceDomain];
    if (srcCbChainId == bytes32(0)) revert InvalidCircleDomain();

    // Verify sender is the registered Chainbills contract on the source chain.
    if (sender != registeredForeignContracts[srcCbChainId]) revert CircleSenderMismatch();

    // Decode payload (version 2 required).
    PayablePayload memory payload = messageBody.decodePayablePayload();

    // Source chain is authoritative from CCTP sourceDomain — MessageTransmitter
    // verified the sender so no need to duplicate chain ID in the payload body.

    // Nonce ordering: reject if this update is not strictly newer than what we
    // have already applied (whether via Wormhole or CCTP).
    uint64 lastNonce = payableUpdateNonces[payload.payableId][srcCbChainId];
    if (payload.nonce <= lastNonce) revert StalePayableUpdateNonce();
    payableUpdateNonces[payload.payableId][srcCbChainId] = payload.nonce;

    // Apply state changes.
    _applyPayablePayloadUpdate(payload, srcCbChainId);

    emit ReceivedPayableUpdateViaCircle(payload.payableId, srcCbChainId, payload.nonce);
    return true;
  }

  /// Admin escape hatch for syncing foreign payable state on chains that share
  /// no common protocol with the source chain (e.g. Wormhole-only chain needs
  /// to record a payable from a CCTP-only chain). Nonce ordering still applies
  /// — admin cannot regress state. Use a multisig/timelock for the owner.
  /// @param payableId The payable ID on the source chain.
  /// @param cbChainId CAIP-2 cbChainId of the source chain.
  /// @param nonce Must be strictly greater than the last recorded nonce.
  /// @param actionType 1=Create/snapshot, 2=Close, 3=Reopen, 4=UpdateATAA.
  /// @param isClosed Current closed status (for actionType 2 or 3).
  /// @param ataa Allowed tokens and amounts (for actionType 1 or 4).
  function adminSyncForeignPayable(
    bytes32 payableId,
    bytes32 cbChainId,
    uint64 nonce,
    uint8 actionType,
    bool isClosed,
    TokenAndAmountForeign[] calldata ataa
  ) public {
    if (payableId == bytes32(0)) revert InvalidPayableId();
    if (cbChainId == bytes32(0)) revert InvalidChainId();

    uint64 lastNonce = payableUpdateNonces[payableId][cbChainId];
    if (nonce <= lastNonce) revert StalePayableUpdateNonce();
    payableUpdateNonces[payableId][cbChainId] = nonce;

    TokenAndAmountForeign[] memory ataaMem = new TokenAndAmountForeign[](ataa.length);
    for (uint256 i = 0; i < ataa.length; i++) {
      ataaMem[i] = ataa[i];
    }

    PayablePayload memory payload = PayablePayload({
      version: 2,
      actionType: actionType,
      payableId: payableId,
      nonce: nonce,
      isClosed: isClosed,
      allowedTokensAndAmounts: ataaMem
    });

    _applyPayablePayloadUpdate(payload, cbChainId);
    emit ReceivedPayableUpdateViaAdminSync(payableId, cbChainId, nonce);
  }

  /// Applies a decoded PayablePayload to the foreignPayables state.
  /// Handles all four action types. Extracted to be shared by Wormhole,
  /// CCTP, and admin-sync receivers.
  /// @param payload Decoded PayablePayload (already nonce-checked by caller).
  /// @param srcCbChainId CAIP-2 cbChainId of the chain that originated this update.
  function _applyPayablePayloadUpdate(PayablePayload memory payload, bytes32 srcCbChainId) internal {
    bytes32 payableId = payload.payableId;

    // Initialize the foreign payable record on first encounter.
    if (foreignPayables[payableId].chainId == bytes32(0)) {
      chainStats.foreignPayablesCount++;
      chainForeignPayableIds.push(payableId);
      foreignPayables[payableId].chainId = srcCbChainId;
    }

    PayableForeign storage foreignPayable = foreignPayables[payableId];

    if (payload.actionType == 1 || payload.actionType == 4) {
      // Create (1) or update ATAA (4): replace the stored ATAA array.
      for (uint8 i = foreignPayable.allowedTokensAndAmountsCount; i > 0; i--) {
        foreignPayableAllowedTokensAndAmounts[payableId].pop();
      }

      uint8 ataaLength = uint8(payload.allowedTokensAndAmounts.length);
      for (uint8 i = 0; i < ataaLength; i++) {
        foreignPayableAllowedTokensAndAmounts[payableId].push(
          TokenAndAmountForeign(payload.allowedTokensAndAmounts[i].token, payload.allowedTokensAndAmounts[i].amount)
        );
      }
      foreignPayable.allowedTokensAndAmountsCount = ataaLength;
    } else if (payload.actionType == 2 || payload.actionType == 3) {
      // Close (2) or Reopen (3): update isClosed.
      foreignPayable.isClosed = payload.isClosed;
    } else {
      revert InvalidPayablePayloadActionType();
    }
  }

  /// Broadcasts a payable update to all registered foreign chains using all
  /// available messaging protocols on this chain.
  ///
  /// Protocol behaviour:
  ///   - Wormhole (if configured): single publishMessage() covers all chains
  ///     reachable by Wormhole relayers.
  ///   - CCTP (if configured): one sendMessage() per chain configured as CCTP.
  ///     WORMHOLE chains are skipped here since the Wormhole broadcast already
  ///     covers them.
  ///
  /// Sets payload.version=2 and payload.nonce before encoding, so callers
  /// pass zero for those fields.
  ///
  /// @param payload PayablePayload with version/nonce left as 0.
  /// @return sequence Wormhole message sequence (0 when Wormhole not configured).
  function _broadcastPayableUpdate(PayablePayload memory payload) internal returns (uint64 sequence) {
    // Assign a monotonically increasing nonce for cross-protocol deduplication.
    _payableUpdateCounter++;
    payload.version = 1;
    payload.nonce = _payableUpdateCounter;

    bytes memory encoded = payload.encode();

    // Wormhole: single call, relayers deliver the VAA to all Wormhole chains.
    if (hasWormhole()) {
      sequence = _publishPayloadMessage(encoded);
    }

    // CCTP: iterate registered chains and send one message per CCTP chain.
    // WORMHOLE chains are already covered by the single Wormhole broadcast above.
    if (hasCCTP()) {
      uint256 len = registeredCbChainIds.length;
      for (uint256 i = 0; i < len; i++) {
        bytes32 chainId = registeredCbChainIds[i];
        if (supportsCCTP(chainId)) {
          uint32 domain = cbChainIdToCircleDomain[chainId];
          bytes32 recipient = registeredForeignContracts[chainId];
          // Skip if admin hasn't configured the Circle domain or registered
          // the foreign contract address yet.
          if (domain != 0 && recipient != bytes32(0)) {
            circleTransmitter().sendMessage(domain, recipient, encoded);
          }
        }
      }
    }

    emit PayableUpdateBroadcasted(payload.payableId, payload.nonce, payload.actionType);
  }
}
