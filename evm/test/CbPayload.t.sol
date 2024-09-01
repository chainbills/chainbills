// SPDX-License-Identifier: Apache 2
pragma solidity ^0.8.20;

import 'wormhole/Utils.sol';
import '../src/CbPayload.sol';

contract CbPayloadTest {
  CbPayload public cbpd;

  function setUp() public {
    cbpd = new CbPayload();
  }

  function testEncodeDecodeStartPaymentPayload() public view {
    bytes memory encoded = cbpd.encodeStartPaymentPayload(
      CbPayload.StartPaymentPayload({payableId: bytes32(0), payerCount: 10})
    );
    CbPayload.StartPaymentPayload memory parsed = cbpd
      .decodeStartPaymentPayload(encoded);
    assert(parsed.payableId == bytes32(0));
    assert(parsed.payerCount == 10);
  }

  function testEncodeDecodeCompletePaymentPayload() public view {
    bytes memory encoded = cbpd.encodeCompletePaymentPayload(
      CbPayload.CompletePaymentPayload({
        payableId: bytes32(0),
        wallet: bytes32(0),
        token: bytes32(0),
        amount: 100,
        payableCount: 5,
        timestamp: 1631234567
      })
    );
    CbPayload.CompletePaymentPayload memory parsed = cbpd
      .decodeCompletePaymentPayload(encoded);
    assert(parsed.payableId == bytes32(0));
    assert(parsed.wallet == bytes32(0));
    assert(parsed.token == bytes32(0));
    assert(parsed.amount == 100);
    assert(parsed.payableCount == 5);
    assert(parsed.timestamp == 1631234567);
  }
}
