// SPDX-License-Identifier: Apache 2
pragma solidity ^0.8.20;

import 'wormhole/libraries/BytesParsing.sol';

import './CbErrors.sol';
import './CbStructs.sol';

contract CbPayloadMessages is CbStructs, CbErrors {
  using BytesParsing for bytes;

  /// Encodes the CbPayloadMessage struct into bytes.
  ///
  /// This encoding is solely based on the valid contents of the struct.
  /// Or rather, what is encoded depends on the actionId of the payload.
  /// Only what is needed is encoded. Other properties will be discarded as
  /// they will contain default or zero-like/falsy values.
  ///
  /// @param parsed CbPayloadMessage struct
  /// @return encoded bytes
  function encodePayloadMessage(
    CbPayloadMessage memory parsed
  ) public pure returns (bytes memory encoded) {
    encoded = abi.encodePacked(parsed.actionId, parsed.caller);

    if (parsed.actionId == 1) {
      if (parsed.allowsFreePayments) {
        encoded = abi.encodePacked(encoded, uint8(1));
      } else {
        encoded = abi.encodePacked(encoded, uint8(0));

        uint8 taaLength = uint8(parsed.tokensAndAmounts.length);
        encoded = abi.encodePacked(encoded, taaLength);

        for (uint8 i = 0; i < taaLength; i++) {
          encoded = abi.encodePacked(
            encoded,
            parsed.tokensAndAmounts[i].token,
            uint64(parsed.tokensAndAmounts[i].amount)
          );
        }
      }

      bytes memory encodedDesc = abi.encodePacked(parsed.description);
      encoded = abi.encodePacked(
        encoded,
        uint8(encodedDesc.length),
        encodedDesc
      );
    } else if (parsed.actionId > 1 && parsed.actionId <= 6) {
      encoded = abi.encodePacked(encoded, parsed.payableId);

      if (parsed.actionId == 4) {
        bytes memory encodedDesc = abi.encodePacked(parsed.description);
        encoded = abi.encodePacked(
          encoded,
          uint8(encodedDesc.length),
          encodedDesc
        );
      }

      if (parsed.actionId == 5 || parsed.actionId == 6) {
        encoded = abi.encodePacked(
          encoded,
          parsed.token,
          uint64(parsed.amount)
        );
      }
    } else {
      revert InvalidPayloadMessage();
    }
  }

  /// Decodes the encoded bytes into a CbPayloadMessage struct.
  /// @param encoded bytes
  /// @return parsed CbPayloadMessage struct
  function decodePayloadMessage(
    bytes memory encoded
  ) public pure returns (CbPayloadMessage memory parsed) {
    uint256 index;
    (parsed.actionId, index) = encoded.asUint8(0);
    (parsed.caller, index) = encoded.asBytes32(index);

    if (parsed.actionId == 1) {
      uint8 allowsFreeEncoded;
      (allowsFreeEncoded, index) = encoded.asUint8(index);

      if (allowsFreeEncoded == 0) parsed.allowsFreePayments = false;
      else if (allowsFreeEncoded == 1) parsed.allowsFreePayments = true;
      else revert InvalidPayloadMessage();

      if (!parsed.allowsFreePayments) {
        uint8 taaLength;
        (taaLength, index) = encoded.asUint8(index);

        if (taaLength > MAX_PAYABLES_TOKENS) revert InvalidPayloadMessage();

        CbTokenAndAmount[] memory tokensAndAmounts = new CbTokenAndAmount[](
          taaLength
        );
        for (uint8 i = 0; i < taaLength; i++) {
          (tokensAndAmounts[i].token, index) = encoded.asBytes32(index);
          (tokensAndAmounts[i].amount, index) = encoded.asUint64(index);
        }
        parsed.tokensAndAmounts = tokensAndAmounts;
      }

      uint8 descLength;
      (descLength, index) = encoded.asUint8(index);
      if (descLength > MAX_PAYABLES_DESCRIPTION_LENGTH) {
        revert InvalidPayloadMessage();
      }

      bytes memory descBytes;
      (descBytes, index) = encoded.slice(index, descLength);
      parsed.description = string(descBytes);

      // confirm that the message was the payload has ended
      if (index != encoded.length) revert InvalidPayloadMessage();
    } else if (parsed.actionId > 1 && parsed.actionId <= 6) {
      (parsed.payableId, index) = encoded.asBytes32(index);

      if (parsed.actionId == 4) {
        uint8 descLength;
        (descLength, index) = encoded.asUint8(index);
        if (descLength > MAX_PAYABLES_DESCRIPTION_LENGTH) {
          revert InvalidPayloadMessage();
        }

        bytes memory descBytes;
        (descBytes, index) = encoded.slice(index, descLength);
        parsed.description = string(descBytes);
      }

      if (parsed.actionId == 5 || parsed.actionId == 6) {
        (parsed.token, index) = encoded.asBytes32(index);
        (parsed.amount, index) = encoded.asUint64(index);
      }

      // confirm that the message was the payload has ended
      if (index != encoded.length) revert InvalidPayloadMessage();
    } else {
      revert InvalidPayloadMessage();
    }
  }
}
