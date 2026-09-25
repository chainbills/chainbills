// SPDX-License-Identifier: Apache 2
pragma solidity ^0.8.30;

import {BytesParsing} from 'wormhole/libraries/BytesParsing.sol';
import {ICbErrors} from '../interfaces/ICbErrors.sol';
import {
  PAYABLE_ACTION_CLOSE,
  PAYABLE_ACTION_CREATE,
  PAYABLE_ACTION_REOPEN,
  PAYABLE_ACTION_UPDATE_ALLOWED_TOKENS_AND_AMOUNTS,
  PAYABLE_PAYLOAD_TYPE,
  PAYMENT_ACTION_PAY,
  PAYMENT_PAYLOAD_LENGTH,
  PAYMENT_PAYLOAD_TYPE
} from '../types/CbConstants.sol';
import {PayablePayload, PaymentPayload, TokenAndAmountForeign} from '../types/CbTypes.sol';

/// Encoding and decoding of cross-chain payloads. Linked library.
/// @dev Payable payload wire format:
///   payloadType(1) | version(1) | actionType(1) | payableId(32) | nonce(8) | initiatedAt(8) then
///   for action 1 or 4: count(1) | [token(32) | amount(8)] * count, and for action 2 or 3: isClosed(1).
/// Payment payload wire format (251 bytes):
///   payloadType(1) | version(1) | actionType(1) | payableId(32) | nonce(8) | initiatedAt(8) | amount(8) |
///   payableChainToken(32) | payableChainId(32) | payer(32) | payerChainToken(32) | payerChainId(32) |
///   payerPaymentId(32).
library CbPayloadCodec {
  using BytesParsing for bytes;

  /// Encodes a payable payload.
  /// @param payload Payable payload.
  /// @return encoded Wire bytes.
  function encodePayablePayload(PayablePayload memory payload) public pure returns (bytes memory encoded) {
    encoded = abi.encodePacked(
      PAYABLE_PAYLOAD_TYPE, payload.version, payload.actionType, payload.payableId, payload.nonce, payload.initiatedAt
    );
    if (_carriesAllowedTokens(payload.actionType)) {
      uint256 count = payload.allowedTokensAndAmounts.length;
      if (count > type(uint8).max) revert ICbErrors.InvalidPayload();
      // forge-lint: disable-next-line(unsafe-typecast)
      encoded = abi.encodePacked(encoded, uint8(count));
      for (uint256 i; i < count; i++) {
        encoded = abi.encodePacked(
          encoded, payload.allowedTokensAndAmounts[i].token, payload.allowedTokensAndAmounts[i].amount
        );
      }
    } else if (_carriesClosedStatus(payload.actionType)) {
      encoded = abi.encodePacked(encoded, payload.isClosed);
    } else {
      revert ICbErrors.InvalidPayablePayloadActionType(payload.actionType);
    }
  }

  /// Decodes a payable payload. Rejects trailing bytes.
  /// @param encoded Wire bytes.
  /// @return payload Payable payload.
  function decodePayablePayload(bytes memory encoded) public pure returns (PayablePayload memory payload) {
    uint256 index;
    (payload.payloadType, index) = encoded.asUint8(0);
    if (payload.payloadType != PAYABLE_PAYLOAD_TYPE) revert ICbErrors.InvalidPayload();
    (payload.version, index) = encoded.asUint8(index);
    (payload.actionType, index) = encoded.asUint8(index);
    (payload.payableId, index) = encoded.asBytes32(index);
    (payload.nonce, index) = encoded.asUint64(index);
    (payload.initiatedAt, index) = encoded.asUint64(index);
    if (_carriesAllowedTokens(payload.actionType)) {
      uint8 count;
      (count, index) = encoded.asUint8(index);
      payload.allowedTokensAndAmounts = new TokenAndAmountForeign[](count);
      for (uint256 i; i < count; i++) {
        (payload.allowedTokensAndAmounts[i].token, index) = encoded.asBytes32(index);
        (payload.allowedTokensAndAmounts[i].amount, index) = encoded.asUint64(index);
      }
    } else if (_carriesClosedStatus(payload.actionType)) {
      (payload.isClosed, index) = encoded.asBool(index);
    } else {
      revert ICbErrors.InvalidPayablePayloadActionType(payload.actionType);
    }
    if (index != encoded.length) revert ICbErrors.InvalidPayload();
  }

  /// Encodes a payment payload.
  /// @param payload Payment payload.
  /// @return encoded 251 wire bytes.
  function encodePaymentPayload(PaymentPayload memory payload) public pure returns (bytes memory encoded) {
    encoded = abi.encodePacked(
      PAYMENT_PAYLOAD_TYPE,
      payload.version,
      PAYMENT_ACTION_PAY,
      payload.payableId,
      payload.nonce,
      payload.initiatedAt,
      payload.amount,
      payload.payableChainToken,
      payload.payableChainId,
      payload.payer,
      payload.payerChainToken,
      payload.payerChainId,
      payload.payerPaymentId
    );
  }

  /// Decodes a payment payload. The input must be exactly 251 bytes.
  /// @param encoded Wire bytes.
  /// @return payload Payment payload.
  function decodePaymentPayload(bytes memory encoded) public pure returns (PaymentPayload memory payload) {
    if (encoded.length != PAYMENT_PAYLOAD_LENGTH) revert ICbErrors.InvalidPayload();
    uint256 index;
    (payload.payloadType, index) = encoded.asUint8(0);
    if (payload.payloadType != PAYMENT_PAYLOAD_TYPE) revert ICbErrors.InvalidPayload();
    (payload.version, index) = encoded.asUint8(index);
    (payload.actionType, index) = encoded.asUint8(index);
    if (payload.actionType != PAYMENT_ACTION_PAY) revert ICbErrors.InvalidPayload();
    (payload.payableId, index) = encoded.asBytes32(index);
    (payload.nonce, index) = encoded.asUint64(index);
    (payload.initiatedAt, index) = encoded.asUint64(index);
    (payload.amount, index) = encoded.asUint64(index);
    (payload.payableChainToken, index) = encoded.asBytes32(index);
    (payload.payableChainId, index) = encoded.asBytes32(index);
    (payload.payer, index) = encoded.asBytes32(index);
    (payload.payerChainToken, index) = encoded.asBytes32(index);
    (payload.payerChainId, index) = encoded.asBytes32(index);
    (payload.payerPaymentId, index) = encoded.asBytes32(index);
  }

  /// Returns whether `actionType` carries allowed tokens and amounts.
  function _carriesAllowedTokens(uint8 actionType) private pure returns (bool) {
    return actionType == PAYABLE_ACTION_CREATE || actionType == PAYABLE_ACTION_UPDATE_ALLOWED_TOKENS_AND_AMOUNTS;
  }

  /// Returns whether `actionType` carries a closed status.
  function _carriesClosedStatus(uint8 actionType) private pure returns (bool) {
    return actionType == PAYABLE_ACTION_CLOSE || actionType == PAYABLE_ACTION_REOPEN;
  }
}
