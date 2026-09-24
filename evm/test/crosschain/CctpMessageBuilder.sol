// SPDX-License-Identifier: Apache 2
pragma solidity ^0.8.30;

/// Builds raw CCTP V2 message and attestation bytes for tests that need full control over individual fields
/// (wrong sender, tampered tokens, insufficient finality, ...) beyond what the mock's own send path produces.
/// @dev Mirrors the layout `CbCctpMessaging` parses: a 148-byte header, then either a payable-update body (opaque
/// bytes) or a burn body (`version(4) | burnToken(32) | mintRecipient(32) | amount(32) | messageSender(32) |
/// maxFee(32) | feeExecuted(32) | expirationBlock(32) | hookData`).
abstract contract CctpMessageBuilder {
  struct CctpHeaderFields {
    uint32 sourceDomain;
    uint32 destinationDomain;
    bytes32 nonce;
    bytes32 sender;
    bytes32 recipient;
    bytes32 destinationCaller;
    uint32 minFinalityThreshold;
    uint32 finalityThresholdExecuted;
  }

  /// Builds a data message (used for payable updates) with an opaque body.
  function _buildDataMessage(CctpHeaderFields memory header, bytes memory body)
    internal
    pure
    returns (bytes memory message, bytes memory attestation)
  {
    message = abi.encodePacked(
      uint32(1),
      header.sourceDomain,
      header.destinationDomain,
      header.nonce,
      header.sender,
      header.recipient,
      header.destinationCaller,
      header.minFinalityThreshold,
      header.finalityThresholdExecuted,
      body
    );
    attestation = abi.encodePacked(keccak256(message));
  }

  /// Builds a burn message with the given burn body fields.
  function _buildBurnMessage(
    CctpHeaderFields memory header,
    bytes32 burnToken,
    bytes32 mintRecipient,
    uint256 amount,
    bytes32 messageSender,
    uint256 maxFee,
    uint256 feeExecuted,
    bytes memory hookData
  ) internal pure returns (bytes memory message, bytes memory attestation) {
    bytes memory body = abi.encodePacked(
      uint32(1), burnToken, mintRecipient, amount, messageSender, maxFee, feeExecuted, uint256(0), hookData
    );
    return _buildDataMessage(header, body);
  }
}
