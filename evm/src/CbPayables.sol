// SPDX-License-Identifier: Apache 2
pragma solidity ^0.8.20;

import 'wormhole/interfaces/IWormhole.sol';
import 'wormhole/Utils.sol';
import './CbErrors.sol';
import './CbEvents.sol';
import './CbUtils.sol';
import './CbPayloadMessages.sol';
import './CbStructs.sol';

contract CbPayables is CbUtils {
  using CbDecodePayload for bytes;
  using CbEncodePayablePayload for PayablePayload;

  /// Create a Payable.
  /// @param allowedTokensAndAmounts The accepted tokens (and their amounts) on
  /// the payable. If empty, then the payable will accept payments in any token.
  /// @return payableId The ID of the newly created payable.
  /// @return wormholeMessageSequence The sequence of the published Wormhole
  /// message.
  function createPayable(TokenAndAmount[] calldata allowedTokensAndAmounts)
    public
    payable
    returns (bytes32 payableId, uint64 wormholeMessageSequence)
  {
    /* CHECKS */
    // Ensure that the allowedTokensAndAmounts are valid.
    // Also prepare the foreign allowedTokensAndAmounts in the same loop.
    TokenAndAmountForeign[] memory foreignAtaa =
      new TokenAndAmountForeign[](allowedTokensAndAmounts.length);
    for (uint8 i = 0; i < allowedTokensAndAmounts.length; i++) {
      // Ensure tokens are valid.
      address token = allowedTokensAndAmounts[i].token;
      if (token == address(0)) revert InvalidTokenAddress();

      // Ensure that the token is supported.
      if (!tokenDetails[token].isSupported) revert UnsupportedToken();

      // Ensure that the specified amount is greater than zero.
      if (allowedTokensAndAmounts[i].amount == 0) revert ZeroAmountSpecified();

      // Set the foreign allowedTokensAndAmounts.
      foreignAtaa[i] = TokenAndAmountForeign({
        token: toWormholeFormat(token),
        amount: uint64(allowedTokensAndAmounts[i].amount)
      });
    }

    // Ensure that the required Wormhole Fees were paid.
    ensureWormholeFees();

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
    chainPayableIds.push(payableId);
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

    // Publish Message through Wormhole.
    wormholeMessageSequence = publishPayloadMessage(
      PayablePayload({
        version: 1,
        actionType: 1,
        payableId: payableId,
        isClosed: false,
        allowedTokensAndAmounts: foreignAtaa
      }) /* actionType 1 for Create */ .encode()
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

  /// Stop a payable from accepting payments. Should be called only by the host
  /// (address) that owns the payable.
  /// @param payableId The ID of the payable to close.
  /// @return wormholeMessageSequence The sequence of the published Wormhole
  /// message.
  function closePayable(bytes32 payableId)
    public
    payable
    returns (uint64 wormholeMessageSequence)
  {
    /* CHECKS */
    // Ensure that the caller owns the payable.
    Payable storage _payable = payables[payableId];
    if (_payable.host != msg.sender) revert NotYourPayable();

    // Ensure that the payable is not already closed.
    if (_payable.isClosed) revert PayableIsAlreadyClosed();

    // Ensure that the required Wormhole Fees were paid.
    ensureWormholeFees();

    /* STATE CHANGES */
    // Close the payable.
    _payable.isClosed = true;

    // Record the Activity.
    recordUpdatePayableActivity(payableId, ActivityType.ClosedPayable);

    // Emit Event.
    emit ClosedPayable(payableId, msg.sender);

    // Publish Message through Wormhole.
    wormholeMessageSequence = publishPayloadMessage(
      PayablePayload({
        version: 1,
        actionType: 2,
        payableId: payableId,
        isClosed: true,
        allowedTokensAndAmounts: new TokenAndAmountForeign[](0)
      }) /* actionType 2 for Close */ .encode()
    );
  }

  /// Allow a closed payable to continue accepting payments. Should be called
  /// only by the host (address) that owns the payable.
  /// @param payableId The ID of the payable to re-open.
  /// @return wormholeMessageSequence The sequence of the published Wormhole
  /// message.
  function reopenPayable(bytes32 payableId)
    public
    payable
    returns (uint64 wormholeMessageSequence)
  {
    /* CHECKS */
    // Ensure that the caller owns the payable.
    Payable storage _payable = payables[payableId];
    if (_payable.host != msg.sender) revert NotYourPayable();

    // Ensure that the payable is closed.
    if (!_payable.isClosed) revert PayableIsNotClosed();

    // Ensure that the required Wormhole Fees were paid.
    ensureWormholeFees();

    /* STATE CHANGES */
    // Close the payable.
    _payable.isClosed = false;

    // Record the Activity.
    recordUpdatePayableActivity(payableId, ActivityType.ReopenedPayable);

    // Emit Event.
    emit ReopenedPayable(payableId, msg.sender);

    // Publish Message through Wormhole.
    wormholeMessageSequence = publishPayloadMessage(
      PayablePayload({
        version: 1,
        actionType: 3,
        payableId: payableId,
        isClosed: false,
        allowedTokensAndAmounts: new TokenAndAmountForeign[](0)
      }) /* actionType 3 for Reopen */ .encode()
    );
  }

  /// Allows a payable's host to update the payable's allowedTokensAndAmounts.
  /// @param payableId The ID of the payable to update.
  /// @param allowedTokensAndAmounts The new tokens and amounts array.
  /// @return wormholeMessageSequence The sequence of the published Wormhole
  /// message.
  function updatePayableAllowedTokensAndAmounts(
    bytes32 payableId,
    TokenAndAmount[] calldata allowedTokensAndAmounts
  ) public payable returns (uint64 wormholeMessageSequence) {
    /* CHECKS */
    // Ensure that the caller owns the payable.
    Payable storage _payable = payables[payableId];
    if (_payable.host != msg.sender) revert NotYourPayable();

    // Ensure that the allowedTokensAndAmounts are valid.
    // Also prepare the foreign allowedTokensAndAmounts in the same loop.
    TokenAndAmountForeign[] memory foreignAtaa =
      new TokenAndAmountForeign[](allowedTokensAndAmounts.length);
    for (uint8 i = 0; i < allowedTokensAndAmounts.length; i++) {
      // Ensure tokens are valid.
      address token = allowedTokensAndAmounts[i].token;
      if (token == address(0)) revert InvalidTokenAddress();

      // Ensure that the token is supported.
      if (!tokenDetails[token].isSupported) revert UnsupportedToken();

      // Ensure that the specified amount is greater than zero.
      if (allowedTokensAndAmounts[i].amount == 0) revert ZeroAmountSpecified();

      // Set the foreign allowedTokensAndAmounts.
      foreignAtaa[i] = TokenAndAmountForeign({
        token: toWormholeFormat(token),
        amount: uint64(allowedTokensAndAmounts[i].amount)
      });
    }

    // Ensure that the required Wormhole Fees were paid.
    ensureWormholeFees();

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

    // Publish Message through Wormhole.
    wormholeMessageSequence = publishPayloadMessage(
      PayablePayload({
        version: 1,
        actionType: 4,
        payableId: payableId,
        isClosed: false,
        allowedTokensAndAmounts: foreignAtaa
      }) /* actionType 4 for UpdataATAA */ .encode()
    );
  }

  /// Records Payable Changes (Creation/Updates) from another chain.
  /// @param wormholeEncoded The encoded message from Wormhole.
  function recordForeignPayableUpdate(bytes memory wormholeEncoded) public {
    // Carry out necessary verifications on the encoded Wormhole and parse it.
    IWormhole.VM memory wormholeMessage =
      parseAndCheckWormholeMessage(wormholeEncoded);

    // Decode the payload
    PayablePayload memory payload =
      wormholeMessage.payload.decodePayablePayload();

    // Record the foreign payable.
    bytes32 payableId = payload.payableId;
    uint16 chainId = wormholeMessage.emitterChainId;
    if (foreignPayables[payableId].chainId == 0) {
      chainStats.foreignPayablesCount++;
      chainForeignPayableIds.push(payableId);
      foreignPayables[payableId].chainId = chainId;
    }
    if (payload.actionType == 1 || payload.actionType == 4) {
      foreignPayables[payableId].allowedTokensAndAmountsCount =
        uint8(payload.allowedTokensAndAmounts.length);
      foreignPayableAllowedTokensAndAmounts[payableId] =
        payload.allowedTokensAndAmounts;
    } else if (payload.actionType == 2 || payload.actionType == 3) {
      foreignPayables[payableId].isClosed = payload.isClosed;
    } else {
      revert InvalidPayablePayloadActionType();
    }

    // Store this message and mark it as consumed.
    consumeWormholeMessage(wormholeMessage);

    // Emit Event.
    emit ConsumedWormholePayableMessage(
      payableId, chainId, wormholeMessage.hash
    );
  }
}
