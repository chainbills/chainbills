// SPDX-License-Identifier: Apache 2
pragma solidity ^0.8.20;

import 'wormhole/interfaces/IWormhole.sol';
import 'wormhole/Utils.sol';
import './CbEvents.sol';
import './CbState.sol';
import './CbStructs.sol';

contract CbUtils is CbState {
  /// Stores a Wormhole Message and mark it as consumed.
  function consumeWormholeMessage(IWormhole.VM memory wormholeMessage) internal {
    chainStats.consumedWormholeMessagesCount++;
    consumedWormholeMessages.push(wormholeMessage.hash);
    uint16 chainId = wormholeMessage.emitterChainId;
    perChainConsumedWormholeMessages[chainId].push(wormholeMessage.hash);
    perChainConsumedWormholeMessagesCount[chainId]++;
    hasConsumedWormholeMessage[wormholeMessage.hash] = true;
  }

  /// Returns a hash that should be used for entity IDs.
  function createId(bytes32 entity, EntityType salt, uint256 count)
    internal
    view
    returns (bytes32)
  {
    return keccak256(
      abi.encodePacked(
        block.chainid, config.chainId, block.timestamp, entity, salt, count
      )
    );
  }

  /// Ensures that the enough Wormhole fees was provided for the call.
  function ensureWormholeFees() internal {
    uint256 wormholeFees = getWormholeMessageFee();
    if (msg.value < wormholeFees) revert InsufficientWormholeFees();
    if (msg.value > wormholeFees) revert IncorrectWormholeFees();
  }

  /// Returns the cost of sending a message throught Wormhole.
  function getWormholeMessageFee() public view returns (uint256) {
    return wormhole().messageFee();
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
      chainUserAddresses.push(wallet);
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

  /// Parses the encoded Wormhole input into a Message and carry-out
  /// the necessary checks.
  /// @param wormholeEncoded Encoded Wormhole message.
  /// @return parsedAndChecked The parsed Wormhole message.
  function parseAndCheckWormholeMessage(bytes memory wormholeEncoded)
    internal
    view
    returns (IWormhole.VM memory parsedAndChecked)
  {
    // Call the Wormhole core contract to parse and verify the encodedMessage
    (IWormhole.VM memory wormholeMessage, bool valid, string memory reason) =
      wormhole().parseAndVerifyVM(wormholeEncoded);

    // Confirm that the Wormhole core contract verified the message
    require(valid, reason);

    // Verify that this message was emitted by a registered emitter
    if (
      registeredForeignContracts[wormholeMessage.emitterChainId]
        != wormholeMessage.emitterAddress
    ) {
      revert EmitterNotRegistered();
    }

    // Ensure that this message hasn't been consumed before.
    if (hasConsumedWormholeMessage[wormholeMessage.hash]) {
      revert HasAlreadyConsumedMessage();
    }

    // Return the parsed message.
    parsedAndChecked = wormholeMessage;
  }

  /// Publishes a message to Wormhole and returns the message sequence.
  function publishPayloadMessage(bytes memory payload)
    internal
    returns (uint64 sequence)
  {
    // Publish the message to Wormhole.
    sequence = wormhole().publishMessage{value: getWormholeMessageFee()}(
      /* No Batching */
      0,
      payload,
      config.wormholeFinality
    );

    // Increment the chainStats for publishedWormholeMessagesCount.
    chainStats.publishedWormholeMessagesCount++;
  }
}
