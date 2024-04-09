// SPDX-License-Identifier: Apache 2
pragma solidity ^0.8.20;

import './CbStructs.sol';

contract CbPayloadMessages is CbStructs {
  /// Encodes the CbPayloadMessage struct into bytes.
  /// @param parsed CbPayloadMessage struct
  /// @return encoded bytes
  function encodePayloadMessage(
    CbPayloadMessage memory parsed
  ) public pure returns (bytes memory encoded) {
    encoded = abi.encode(parsed);
  }

  /// Decodes the encoded bytes into a CbPayloadMessage struct.
  /// @param encoded bytes
  /// @return parsed CbPayloadMessage struct
  function decodePayloadMessage(
    bytes memory encoded
  ) public pure returns (CbPayloadMessage memory parsed) {
    parsed = abi.decode(encoded, (CbPayloadMessage));
  }
}
