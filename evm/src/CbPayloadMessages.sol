// SPDX-License-Identifier: Apache 2
pragma solidity ^0.8.20;

import 'wormhole/libraries/BytesParsing.sol';
import './CbErrors.sol';
import './CbStructs.sol';

library CbEncodePayablePayload {
  using BytesParsing for bytes;

  /// Encodes the PayablePayload struct into bytes.
  /// @param payload PayablePayload struct
  /// @return encoded bytes
  function encode(CbStructs.PayablePayload memory payload) public pure returns (bytes memory encoded) {
    encoded = abi.encodePacked(payload.version, payload.actionType, payload.payableId);
    if (payload.actionType == 1 || payload.actionType == 4) {
      uint8 ataaLength = uint8(payload.allowedTokensAndAmounts.length);
      encoded = abi.encodePacked(encoded, ataaLength);
      for (uint8 i = 0; i < ataaLength; i++) {
        encoded =
          abi.encodePacked(encoded, payload.allowedTokensAndAmounts[i].token, payload.allowedTokensAndAmounts[i].amount);
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
  /// @param payload PaymentPayload struct
  /// @return encoded bytes
  function encode(CbStructs.PaymentPayload memory payload) public pure returns (bytes memory encoded) {
    encoded = abi.encodePacked(
      payload.version,
      payload.payableId,
      payload.payableChainToken,
      payload.payableChainId,
      payload.payer,
      payload.payerChainToken,
      payload.payerChainId,
      payload.amount,
      payload.circleNonce
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
    (parsed.version, index) = encoded.asUint8(0);
    (parsed.actionType, index) = encoded.asUint8(index);
    (parsed.payableId, index) = encoded.asBytes32(index);
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
  /// @param encoded bytes
  /// @return parsed PaymentPayload struct
  function decodePaymentPayload(bytes memory encoded) public pure returns (CbStructs.PaymentPayload memory parsed) {
    uint256 index;
    (parsed.version, index) = encoded.asUint8(0);
    (parsed.payableId, index) = encoded.asBytes32(index);
    (parsed.payableChainToken, index) = encoded.asBytes32(index);
    (parsed.payableChainId, index) = encoded.asUint16(index);
    (parsed.payer, index) = encoded.asBytes32(index);
    (parsed.payerChainToken, index) = encoded.asBytes32(index);
    (parsed.payerChainId, index) = encoded.asUint16(index);
    (parsed.amount, index) = encoded.asUint64(index);
    (parsed.circleNonce, index) = encoded.asUint64(index);
    if (index != encoded.length) revert CbErrors.InvalidPayload();
  }
}
