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

    // Publish Message through Wormhole.
    if (hasWormhole()) {
      wormholeMessageSequence = _publishPayloadMessage(
        PayablePayload({
          version: 1,
          actionType: 1,
          payableId: payableId,
          isClosed: false,
          allowedTokensAndAmounts: foreignAtaa
        }) /* actionType 1 for Create */ .encode()
      );
    }
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

    // Publish Message through Wormhole.
    if (hasWormhole()) {
      wormholeMessageSequence = _publishPayloadMessage(
        PayablePayload({
          version: 1,
          actionType: 2,
          payableId: payableId,
          isClosed: true,
          allowedTokensAndAmounts: new TokenAndAmountForeign[](0)
        }) /* actionType 2 for Close */ .encode()
      );
    }
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

    // Publish Message through Wormhole.
    if (hasWormhole()) {
      wormholeMessageSequence = _publishPayloadMessage(
        PayablePayload({
          version: 1,
          actionType: 3,
          payableId: payableId,
          isClosed: false,
          allowedTokensAndAmounts: new TokenAndAmountForeign[](0)
        }) /* actionType 3 for Reopen */ .encode()
      );
    }
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

    // Publish Message through Wormhole.
    if (hasWormhole()) {
      wormholeMessageSequence = _publishPayloadMessage(
        PayablePayload({
          version: 1,
          actionType: 4,
          payableId: payableId,
          isClosed: false,
          allowedTokensAndAmounts: foreignAtaa
        }) /* actionType 4 for UpdataATAA */ .encode()
      );
    }
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
    // Publish Message through Wormhole.
    if (hasWormhole()) {
      wormholeMessageSequence = _publishPayloadMessage(
        PayablePayload({
          version: 1,
          actionType: 1,
          payableId: payableId,
          isClosed: _payable.isClosed,
          allowedTokensAndAmounts: foreignAtaa
        }) /* actionType 1 for Create, just re-using it */ .encode()
      );
    }
  }

  /// Records Payable Changes (Creation/Updates) from another chain.
  /// @param wormholeEncoded The encoded message from Wormhole.
  function recordForeignPayableUpdate(bytes memory wormholeEncoded) public {
    // Carry out necessary verifications on the encoded Wormhole and parse it.
    IWormhole.VM memory wormholeMessage = _parseAndCheckWormholeMessage(wormholeEncoded);

    // Decode the payload
    PayablePayload memory payload = wormholeMessage.payload.decodePayablePayload();

    // Record the foreign payable.
    bytes32 payableId = payload.payableId;
    uint16 chainId = wormholeMessage.emitterChainId;

    // Record an increment in count if this is the first time this foreign
    // payable is being recorded.
    if (foreignPayables[payableId].chainId == 0) {
      chainStats.foreignPayablesCount++;
      chainForeignPayableIds.push(payableId);
      foreignPayables[payableId].chainId = chainId;
    }

    // Update parts of the payable depending on the incoming action type
    PayableForeign storage foreignPayable = foreignPayables[payableId];
    if (payload.actionType == 1 || payload.actionType == 4) {
      // If payable was created or its ATAA updated, we should set ATAA.

      if (payload.actionType == 4) {
        // This is a modification and not a newly created payable, so
        // first clear the current contents of the foreign ATAA.
        for (uint8 i = foreignPayable.allowedTokensAndAmountsCount; i > 0; i--) {
          // Remove all previously set ATAAs in storage by popping
          foreignPayableAllowedTokensAndAmounts[payableId].pop();
        }
      }

      // Loop through and set the foreign payable ATAA in storage as
      // Solidity can't copy arrays from memory into storage
      uint8 ataaLength = uint8(payload.allowedTokensAndAmounts.length);
      for (uint8 i = 0; i < ataaLength; i++) {
        foreignPayableAllowedTokensAndAmounts[payableId].push(
          TokenAndAmountForeign(payload.allowedTokensAndAmounts[i].token, payload.allowedTokensAndAmounts[i].amount)
        );
      }

      // Set the count/length of the foreign ATAA
      foreignPayable.allowedTokensAndAmountsCount = ataaLength;
    } else if (payload.actionType == 2 || payload.actionType == 3) {
      // Set the isClosed status
      foreignPayables[payableId].isClosed = payload.isClosed;
    } else {
      // We don't know how to handle the provided action.
      revert InvalidPayablePayloadActionType();
    }

    // Store this message and mark it as consumed.
    consumeWormholeMessage(wormholeMessage);

    // Emit Event.
    emit ConsumedWormholePayableMessage(payableId, chainId, wormholeMessage.hash);
  }
}
