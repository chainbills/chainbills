// SPDX-License-Identifier: Apache 2
pragma solidity ^0.8.20;

import 'forge-std/Test.sol';
import 'wormhole/Utils.sol';
import 'src/CbPayloadMessages.sol';

contract CbPayloadMessagesTest is Test {
  CbPayloadMessages public cbpm;

  function setUp() public {
    cbpm = new CbPayloadMessages();
  }

  function testEncodeDecodePayablePayload() public view {
    TokenAndAmountForeign[] memory ataa = new TokenAndAmountForeign[](2);
    ataa[0] = TokenAndAmountForeign({token: bytes32(0), amount: 100});
    ataa[1] = TokenAndAmountForeign({token: bytes32(0), amount: 200});
    bytes memory encoded = cbpm.encodePayablePayload(
      PayablePayload({
        version: 1,
        actionType: 1,
        payableId: bytes32(0),
        isClosed: false,
        allowedTokensAndAmounts: ataa
      })
    );
    PayablePayload memory parsed = cbpm.decodePayablePayload(encoded);
    assert(parsed.version == 1);
    assert(parsed.actionType == 1);
    assert(parsed.payableId == bytes32(0));
    assert(parsed.isClosed == false);
    assert(parsed.allowedTokensAndAmounts.length == 2);
  }

  function testEncodeDecodePaymentPayload() public view {
    bytes memory encoded = cbpm.encodePaymentPayload(
      PaymentPayload({
        version: 1,
        payableId: bytes32(0),
        payableChainToken: bytes32(0),
        payableChainId: 2,
        payer: bytes32(0),
        payerChainToken: bytes32(0),
        payerChainId: 4,
        amount: 100,
        circleNonce: 2
      })
    );
    PaymentPayload memory parsed = cbpm.decodePaymentPayload(encoded);
    assert(parsed.version == 1);
    assert(parsed.payableId == bytes32(0));
    assert(parsed.payableChainToken == bytes32(0));
    assert(parsed.payableChainId == 2);
    assert(parsed.payer == bytes32(0));
    assert(parsed.payerChainToken == bytes32(0));
    assert(parsed.payerChainId == 4);
    assert(parsed.amount == 100);
    assert(parsed.circleNonce == 2);
  }
}
