// SPDX-License-Identifier: Apache 2
pragma solidity ^0.8.30;

/// Subset of Circle's CCTP V2 TokenMessengerV2 used by Chainbills.
interface ITokenMessengerV2 {
  /// Burns `amount` of `burnToken` for minting on `destinationDomain`, carrying `hookData` in the burn message.
  /// @param amount Amount to burn, including `maxFee`.
  /// @param destinationDomain Circle domain of the destination chain.
  /// @param mintRecipient Recipient of the minted tokens on the destination chain.
  /// @param burnToken Token to burn on this chain.
  /// @param destinationCaller Only account allowed to receive the message on the destination, or zero for anyone.
  /// @param maxFee Largest fee Circle may take from `amount`.
  /// @param minFinalityThreshold Finality required before attestation (1000 fast, 2000 finalized).
  /// @param hookData Arbitrary bytes carried in the burn message body.
  function depositForBurnWithHook(
    uint256 amount,
    uint32 destinationDomain,
    bytes32 mintRecipient,
    address burnToken,
    bytes32 destinationCaller,
    uint256 maxFee,
    uint32 minFinalityThreshold,
    bytes calldata hookData
  ) external;

  /// Returns the local MessageTransmitterV2.
  /// @return Message transmitter address.
  function localMessageTransmitter() external view returns (address);

  /// Returns the local TokenMinterV2.
  /// @return Token minter address.
  function localMinter() external view returns (address);
}
