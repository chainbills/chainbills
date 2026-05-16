// SPDX-License-Identifier: Apache 2
pragma solidity ^0.8.30;

import {BytesParsing} from 'wormhole/libraries/BytesParsing.sol';
import {CbErrors} from './CbErrors.sol';
import {CbStructs} from './CbStructs.sol';

library CbEncodePayablePayload {
  using BytesParsing for bytes;

  /// Encodes the PayablePayload struct into bytes.
  ///
  /// Wire format (version 1):
  ///   payloadType(1) | version(1) | actionType(1) | payableId(32) | nonce(8)
  ///   then action-specific fields:
  ///     actionType 1 or 4: ataaLength(1) | [token(32) | amount(8)] * n
  ///     actionType 2 or 3: isClosed(1)
  ///
  /// @param payload PayablePayload struct
  /// @return encoded bytes
  function encode(CbStructs.PayablePayload memory payload) public pure returns (bytes memory encoded) {
    encoded =
      abi.encodePacked(payload.payloadType, payload.version, payload.actionType, payload.payableId, payload.nonce);
    if (payload.actionType == 1 || payload.actionType == 4) {
      uint8 ataaLength = uint8(payload.allowedTokensAndAmounts.length);
      encoded = abi.encodePacked(encoded, ataaLength);
      for (uint8 i = 0; i < ataaLength; i++) {
        encoded = abi.encodePacked(
          encoded, payload.allowedTokensAndAmounts[i].token, payload.allowedTokensAndAmounts[i].amount
        );
      }
    } else if (payload.actionType == 2 || payload.actionType == 3) {
      encoded = abi.encodePacked(encoded, payload.isClosed);
    } else {
      revert CbErrors.InvalidPayablePayloadActionType();
    }
  }
}

library CbEncodePaymentPayload {
  using BytesParsing for bytes;

  /// Encodes the PaymentPayload struct into bytes.
  ///
  /// Wire format:
  ///   payloadType(1) | version(1) | actionType(1) | payableId(32) | circleNonce(8) | amount(8)
  ///   | payableChainToken(32) | payableChainId(32) | payer(32) | payerChainToken(32) | payerChainId(32)
  ///
  /// @param payload PaymentPayload struct
  /// @return encoded bytes
  function encode(CbStructs.PaymentPayload memory payload) public pure returns (bytes memory encoded) {
    encoded = abi.encodePacked(
      payload.payloadType,
      payload.version,
      payload.actionType,
      payload.payableId,
      payload.circleNonce,
      payload.amount,
      payload.payableChainToken,
      payload.payableChainId,
      payload.payer,
      payload.payerChainToken,
      payload.payerChainId
    );
  }
}

library CbDecodePayload {
  using BytesParsing for bytes;

  /// Decodes the encoded bytes into a PayablePayload struct.
  /// @param encoded bytes
  /// @return parsed PayablePayload struct
  function decodePayablePayload(bytes memory encoded) public pure returns (CbStructs.PayablePayload memory parsed) {
    uint256 index;
    (parsed.payloadType, index) = encoded.asUint8(0);
    if (parsed.payloadType != 1) revert CbErrors.InvalidPayload();
    (parsed.version, index) = encoded.asUint8(index);
    (parsed.actionType, index) = encoded.asUint8(index);
    (parsed.payableId, index) = encoded.asBytes32(index);
    (parsed.nonce, index) = encoded.asUint64(index);
    if (parsed.actionType == 1 || parsed.actionType == 4) {
      uint8 ataaLength;
      (ataaLength, index) = encoded.asUint8(index);
      parsed.allowedTokensAndAmounts = new CbStructs.TokenAndAmountForeign[](ataaLength);
      for (uint8 i = 0; i < ataaLength; i++) {
        CbStructs.TokenAndAmountForeign memory ataa;
        (ataa.token, index) = encoded.asBytes32(index);
        (ataa.amount, index) = encoded.asUint64(index);
        parsed.allowedTokensAndAmounts[i] = ataa;
      }
    } else if (parsed.actionType == 2 || parsed.actionType == 3) {
      (parsed.isClosed, index) = encoded.asBool(index);
    } else {
      revert CbErrors.InvalidPayablePayloadActionType();
    }
    if (index != encoded.length) revert CbErrors.InvalidPayload();
  }

  /// Decodes the encoded bytes into a PaymentPayload struct.
  /// payableChainId and payerChainId are CAIP-2 cbChainIds (bytes32).
  /// @param encoded bytes
  /// @return parsed PaymentPayload struct
  function decodePaymentPayload(bytes memory encoded) public pure returns (CbStructs.PaymentPayload memory parsed) {
    parsed = decodePaymentPayload(encoded, 0);
    // Validate no trailing bytes in the body when decoding a standalone payload.
    // 32*6 (bytes32) + 8*2 (uint64) + 1*3 (uint8) = 192 + 16 + 3 = 211 bytes.
    if (encoded.length != 211) revert CbErrors.InvalidPayload();
  }

  /// Decodes the encoded bytes into a PaymentPayload struct starting at a given index.
  /// @param encoded bytes
  /// @param index starting index
  /// @return parsed PaymentPayload struct
  function decodePaymentPayload(bytes memory encoded, uint256 index)
    public
    pure
    returns (CbStructs.PaymentPayload memory parsed)
  {
    (parsed.payloadType, index) = encoded.asUint8(index);
    if (parsed.payloadType != 2) revert CbErrors.InvalidPayload();
    (parsed.version, index) = encoded.asUint8(index);
    (parsed.actionType, index) = encoded.asUint8(index);
    if (parsed.actionType != 5) revert CbErrors.InvalidPayload();
    (parsed.payableId, index) = encoded.asBytes32(index);
    (parsed.circleNonce, index) = encoded.asUint64(index);
    (parsed.amount, index) = encoded.asUint64(index);
    (parsed.payableChainToken, index) = encoded.asBytes32(index);
    (parsed.payableChainId, index) = encoded.asBytes32(index);
    (parsed.payer, index) = encoded.asBytes32(index);
    (parsed.payerChainToken, index) = encoded.asBytes32(index);
    (parsed.payerChainId, index) = encoded.asBytes32(index);

    // Validate we've reached the expected end of a PaymentPayload (163 bytes from start).
    // Note: If this is part of a larger message (like CCTP), the caller should validate
    // the total length if needed.
  }
}
