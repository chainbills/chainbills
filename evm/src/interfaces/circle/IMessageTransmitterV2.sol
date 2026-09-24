// SPDX-License-Identifier: Apache 2
pragma solidity ^0.8.30;

/// Subset of Circle's CCTP V2 MessageTransmitterV2 used by Chainbills.
interface IMessageTransmitterV2 {
  /// Sends a data message to `recipient` on `destinationDomain`.
  /// @param destinationDomain Circle domain of the destination chain.
  /// @param recipient Handler of the message on the destination chain.
  /// @param destinationCaller Only account allowed to receive the message on the destination, or zero for anyone.
  /// @param minFinalityThreshold Finality required before attestation (1000 fast, 2000 finalized).
  /// @param messageBody Message body.
  function sendMessage(
    uint32 destinationDomain,
    bytes32 recipient,
    bytes32 destinationCaller,
    uint32 minFinalityThreshold,
    bytes calldata messageBody
  ) external;

  /// Verifies `attestation` over `message`, marks its nonce used, and delivers it.
  /// @param message CCTP V2 message.
  /// @param attestation Circle attestation.
  /// @return success True on success.
  function receiveMessage(bytes calldata message, bytes calldata attestation) external returns (bool success);

  /// Returns the Circle domain of this chain.
  /// @return Circle domain.
  function localDomain() external view returns (uint32);
}
