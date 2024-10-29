// SPDX-License-Identifier: Apache 2
pragma solidity ^0.8.20;

import 'wormhole/libraries/BytesParsing.sol';

error InvalidPayload();

/// Necessary info to record a payable's payment if the involved blockchain
/// networks are different. That is the when a user is on a different chain
/// from the payable.
struct StartPaymentPayload {
  /// The Payable's ID.
  bytes32 payableId;
  /// The nth count of payments by the payer at the point of this payment.
  /// This can only be obtained from the User's chain.
  uint256 payerCount;
}

/// Necessary info to record a user's payment if the involved blockchain
/// networks are different. That is the when a user is on a different chain
/// from the payable.
struct CompletePaymentPayload {
  /// The Payable's ID.
  bytes32 payableId;
  /// The Wormhole-normalized wallet address that made the payment.
  bytes32 wallet;
  /// The Wormhole-normalized address of the involved token.
  bytes32 token;
  /// The Wormhole-normalized (with 8 decimals) amount of the token.
  uint256 amount;
  /// The nth count of payments by the payable at the point of this payment.
  /// This can only be obtained from the Payable's chain.
  uint256 payableCount;
  /// When the payment was made.
  uint256 timestamp;
}

contract CbPayload {
  using BytesParsing for bytes;

  /// Encodes the StartPaymentPayload struct into bytes.
  /// @param payload StartPaymentPayload struct
  /// @return encoded bytes
  function encodeStartPaymentPayload(StartPaymentPayload memory payload)
    public
    pure
    returns (bytes memory encoded)
  {
    encoded = abi.encodePacked(payload.payableId, uint64(payload.payerCount));
  }

  /// Decodes the encoded bytes into a StartPaymentPayload struct.
  /// @param encoded bytes
  /// @return parsed StartPaymentPayload struct
  function decodeStartPaymentPayload(bytes memory encoded)
    public
    pure
    returns (StartPaymentPayload memory parsed)
  {
    uint256 index;
    (parsed.payableId, index) = encoded.asBytes32(0);
    (parsed.payerCount, index) = encoded.asUint64(index);
    if (index != encoded.length) revert InvalidPayload();
  }

  /// Encodes the CompletePaymentPayload struct into bytes.
  /// @param payload CompletePaymentPayload struct
  /// @return encoded bytes
  function encodeCompletePaymentPayload(CompletePaymentPayload memory payload)
    public
    pure
    returns (bytes memory encoded)
  {
    encoded = abi.encodePacked(
      payload.payableId,
      payload.wallet,
      payload.token,
      uint64(payload.amount),
      uint64(payload.payableCount),
      uint64(payload.timestamp)
    );
  }

  /// Decodes the encoded bytes into a CompletePaymentPayload struct.
  /// @param encoded bytes
  /// @return parsed CompletePaymentPayload struct
  function decodeCompletePaymentPayload(bytes memory encoded)
    public
    pure
    returns (CompletePaymentPayload memory parsed)
  {
    uint256 index;
    (parsed.payableId, index) = encoded.asBytes32(0);
    (parsed.wallet, index) = encoded.asBytes32(index);
    (parsed.token, index) = encoded.asBytes32(index);
    (parsed.amount, index) = encoded.asUint64(index);
    (parsed.payableCount, index) = encoded.asUint64(index);
    (parsed.timestamp, index) = encoded.asUint64(index);
    if (index != encoded.length) revert InvalidPayload();
  }
}
