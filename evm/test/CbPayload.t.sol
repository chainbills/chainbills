// SPDX-License-Identifier: Apache 2
pragma solidity ^0.8.20;

import 'forge-std/Test.sol';
import 'wormhole/Utils.sol';
import '../src/CbPayload.sol';

contract CbPayloadTest is Test {
  CbPayload public cbpd;

  function setUp() public {
    cbpd = new CbPayload();
  }

  function testEncodeDecodeStartPaymentPayload() public  {  
    bytes memory encoded = cbpd.encodeStartPaymentPayload(
      StartPaymentPayload({payableId: bytes32(0), payerCount: 10})
    );
    StartPaymentPayload memory parsed = cbpd
      .decodeStartPaymentPayload(encoded);
    assert(parsed.payableId == bytes32(0));
    assert(parsed.payerCount == 10);
  }

  function testEncodeDecodeCompletePaymentPayload() public {    
    bytes memory encoded = cbpd.encodeCompletePaymentPayload(
      CompletePaymentPayload({
        payableId: bytes32(0),
        wallet: bytes32(0),
        token: bytes32(0),
        amount: 100,
        payableCount: 5,
        timestamp: 1631234567
      })
    );
    CompletePaymentPayload memory parsed = cbpd
      .decodeCompletePaymentPayload(encoded);
    assert(parsed.payableId == bytes32(0));
    assert(parsed.wallet == bytes32(0));
    assert(parsed.token == bytes32(0));
    assert(parsed.amount == 100);
    assert(parsed.payableCount == 5);
    assert(parsed.timestamp == 1631234567);
  }
}
