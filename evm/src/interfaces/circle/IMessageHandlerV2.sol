// SPDX-License-Identifier: Apache 2
pragma solidity ^0.8.30;

/// Callbacks Circle's MessageTransmitterV2 invokes on the recipient of a CCTP data message.
interface IMessageHandlerV2 {
  /// Handles a message attested at finality 2000 or above.
  /// @param sourceDomain Circle domain of the source chain.
  /// @param sender Sender of the message on the source chain.
  /// @param finalityThresholdExecuted Finality at which the message was attested.
  /// @param messageBody Message body.
  /// @return True on success.
  function handleReceiveFinalizedMessage(
    uint32 sourceDomain,
    bytes32 sender,
    uint32 finalityThresholdExecuted,
    bytes calldata messageBody
  ) external returns (bool);

  /// Handles a message attested below finality 2000.
  /// @param sourceDomain Circle domain of the source chain.
  /// @param sender Sender of the message on the source chain.
  /// @param finalityThresholdExecuted Finality at which the message was attested.
  /// @param messageBody Message body.
  /// @return True on success.
  function handleReceiveUnfinalizedMessage(
    uint32 sourceDomain,
    bytes32 sender,
    uint32 finalityThresholdExecuted,
    bytes calldata messageBody
  ) external returns (bool);
}
