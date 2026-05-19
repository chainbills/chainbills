// SPDX-License-Identifier: Apache 2
pragma solidity ^0.8.30;

import {Test} from 'forge-std/Test.sol';
import {CbStructs} from 'src/CbStructs.sol';
import {CbDecodePayload, CbEncodePayablePayload, CbEncodePaymentPayload} from 'src/CbPayloadMessages.sol';

contract CbPayloadMessagesTest is CbStructs, Test {
  using CbDecodePayload for bytes;
  using CbEncodePayablePayload for PayablePayload;
  using CbEncodePaymentPayload for PaymentPayload;

  // Blank Test Function to exclude this Test contract itself from test coverage reports.
  function test() public {}

  // ------------------------------------------------------------------------
  // Payable payload — action type 1 (Create / snapshot)
  // ------------------------------------------------------------------------

  function testEncodeDecodePayablePayloadActionType1() public pure {
    TokenAndAmountForeign[] memory ataa = new TokenAndAmountForeign[](2);
    ataa[0] = TokenAndAmountForeign({token: bytes32(0), amount: 100});
    ataa[1] = TokenAndAmountForeign({token: bytes32(0), amount: 200});

    bytes memory encoded = PayablePayload({
        payloadType: 1,
        version: 1,
        actionType: 1,
        payableId: bytes32(0),
        nonce: 7,
        initiatedAt: 0,
        isClosed: false,
        allowedTokensAndAmounts: ataa
      }).encode();

    PayablePayload memory parsed = encoded.decodePayablePayload();
    assertEq(parsed.version, 1);
    assertEq(parsed.actionType, 1);
    assertEq(parsed.payableId, bytes32(0));
    assertEq(parsed.nonce, 7);
    assertFalse(parsed.isClosed);
    assertEq(parsed.allowedTokensAndAmounts.length, 2);
    assertEq(parsed.allowedTokensAndAmounts[0].amount, 100);
    assertEq(parsed.allowedTokensAndAmounts[1].amount, 200);
  }

  function testEncodeDecodePayablePayloadActionType1WithNoAtaa() public pure {
    bytes memory encoded = PayablePayload({
        payloadType: 1,
        version: 1,
        actionType: 1,
        payableId: keccak256('payable'),
        nonce: 42,
        initiatedAt: 0,
        isClosed: false,
        allowedTokensAndAmounts: new TokenAndAmountForeign[](0)
      }).encode();

    PayablePayload memory parsed = encoded.decodePayablePayload();
    assertEq(parsed.nonce, 42);
    assertEq(parsed.allowedTokensAndAmounts.length, 0);
  }

  // ------------------------------------------------------------------------
  // Payable payload — action type 2 (Close)
  // ------------------------------------------------------------------------

  function testEncodeDecodePayablePayloadActionType2() public pure {
    bytes32 pid = keccak256('payable-x');
    bytes memory encoded = PayablePayload({
        payloadType: 1,
        version: 1,
        actionType: 2,
        payableId: pid,
        nonce: 13,
        initiatedAt: 0,
        isClosed: true,
        allowedTokensAndAmounts: new TokenAndAmountForeign[](0)
      }).encode();

    PayablePayload memory parsed = encoded.decodePayablePayload();
    assertEq(parsed.version, 1);
    assertEq(parsed.actionType, 2);
    assertEq(parsed.payableId, pid);
    assertEq(parsed.nonce, 13);
    assertTrue(parsed.isClosed);
  }

  // ------------------------------------------------------------------------
  // Payable payload — action type 3 (Reopen)
  // ------------------------------------------------------------------------

  function testEncodeDecodePayablePayloadActionType3() public pure {
    bytes32 pid = keccak256('payable-y');
    bytes memory encoded = PayablePayload({
        payloadType: 1,
        version: 1,
        actionType: 3,
        payableId: pid,
        nonce: 99,
        initiatedAt: 0,
        isClosed: false,
        allowedTokensAndAmounts: new TokenAndAmountForeign[](0)
      }).encode();

    PayablePayload memory parsed = encoded.decodePayablePayload();
    assertEq(parsed.actionType, 3);
    assertEq(parsed.payableId, pid);
    assertFalse(parsed.isClosed);
  }

  // ------------------------------------------------------------------------
  // Payable payload — action type 4 (Update ATAA)
  // ------------------------------------------------------------------------

  function testEncodeDecodePayablePayloadActionType4() public pure {
    TokenAndAmountForeign[] memory ataa = new TokenAndAmountForeign[](3);
    for (uint8 i = 0; i < 3; i++) {
      ataa[i] = TokenAndAmountForeign({token: bytes32(uint256(i + 1)), amount: uint64(i + 1) * 1e6});
    }

    bytes memory encoded = PayablePayload({
        payloadType: 1,
        version: 1,
        actionType: 4,
        payableId: bytes32(uint256(0xABC)),
        nonce: 5,
        initiatedAt: 0,
        isClosed: false,
        allowedTokensAndAmounts: ataa
      }).encode();

    PayablePayload memory parsed = encoded.decodePayablePayload();
    assertEq(parsed.actionType, 4);
    assertEq(parsed.allowedTokensAndAmounts.length, 3);
    assertEq(parsed.allowedTokensAndAmounts[2].amount, 3e6);
  }

  // ------------------------------------------------------------------------
  // Payable payload — invalid action type
  // ------------------------------------------------------------------------

  function testEncodePayablePayloadInvalidActionTypeReverts() public {
    // Action type 0 is invalid.
    vm.expectRevert(InvalidPayablePayloadActionType.selector);
    PayablePayload({
        payloadType: 1,
        version: 1,
        actionType: 0,
        payableId: bytes32(0),
        nonce: 1,
        initiatedAt: 0,
        isClosed: false,
        allowedTokensAndAmounts: new TokenAndAmountForeign[](0)
      }).encode();
  }

  function testEncodePayablePayloadActionType5Reverts() public {
    vm.expectRevert(InvalidPayablePayloadActionType.selector);
    PayablePayload({
        payloadType: 1,
        version: 1,
        actionType: 5,
        payableId: bytes32(0),
        nonce: 1,
        initiatedAt: 0,
        isClosed: false,
        allowedTokensAndAmounts: new TokenAndAmountForeign[](0)
      }).encode();
  }

  function testDecodePayablePayloadInvalidActionTypeReverts() public {
    // Manually craft a payload with action type 0.
    // Layout: type(1)|version(1)|action(1)|pid(32)|nonce(8)|initiatedAt(8)|closed(1)|ataaLen(1)
    bytes memory bad =
      abi.encodePacked(uint8(1), uint8(1), uint8(0), bytes32(0), uint64(1), uint64(0), uint8(1), uint8(0));
    vm.expectRevert(InvalidPayablePayloadActionType.selector);
    bad.decodePayablePayload();
  }

  function testDecodePayablePayloadInvalidTypeReverts() public {
    // Payload type 2 (PaymentPayload) sent to decodePayablePayload should revert.
    bytes memory bad =
      abi.encodePacked(uint8(2), uint8(1), uint8(1), bytes32(0), uint64(1), uint64(0), uint8(1), uint8(0));
    vm.expectRevert(InvalidPayload.selector);
    bad.decodePayablePayload();
  }

  // ------------------------------------------------------------------------
  // Payable payload — trailing bytes check
  // ------------------------------------------------------------------------

  function testDecodePayablePayloadTrailingBytesReverts() public {
    // Encode a valid close payload, then append an extra byte.
    bytes memory valid = PayablePayload({
        payloadType: 1,
        version: 1,
        actionType: 2,
        payableId: bytes32(0),
        nonce: 1,
        initiatedAt: 0,
        isClosed: true,
        allowedTokensAndAmounts: new TokenAndAmountForeign[](0)
      }).encode();

    bytes memory withTrailing = abi.encodePacked(valid, uint8(0xFF));
    vm.expectRevert(InvalidPayload.selector);
    withTrailing.decodePayablePayload();
  }

  // ------------------------------------------------------------------------
  // Payment payload
  // ------------------------------------------------------------------------

  function testEncodeDecodePaymentPayload() public pure {
    bytes32 payableChainId = keccak256(abi.encodePacked('eip155:2'));
    bytes32 payerChainId = keccak256(abi.encodePacked('eip155:4'));

    bytes memory encoded = PaymentPayload({
        payloadType: 2,
        version: 1,
        actionType: 5,
        payableId: bytes32(0),
        nonce: 2,
        initiatedAt: 1_700_000_000,
        amount: 100,
        payableChainToken: bytes32(0),
        payableChainId: payableChainId,
        payer: bytes32(0),
        payerChainToken: bytes32(0),
        payerChainId: payerChainId,
        payerPaymentId: bytes32(0)
      }).encode();

    PaymentPayload memory parsed = encoded.decodePaymentPayload();
    assertEq(parsed.version, 1);
    assertEq(parsed.actionType, 5);
    assertEq(parsed.payableId, bytes32(0));
    assertEq(parsed.nonce, 2);
    assertEq(parsed.amount, 100);
    assertEq(parsed.initiatedAt, 1_700_000_000);
    assertEq(parsed.payerPaymentId, bytes32(0));
    assertEq(parsed.payableChainToken, bytes32(0));
    assertEq(parsed.payableChainId, payableChainId);
    assertEq(parsed.payer, bytes32(0));
    assertEq(parsed.payerChainToken, bytes32(0));
    assertEq(parsed.payerChainId, payerChainId);
    assertEq(parsed.amount, 100);
    assertEq(parsed.nonce, 2);
  }

  function testEncodeDecodePaymentPayloadWithNonZeroFields() public pure {
    bytes32 payableId = keccak256('payable');
    bytes32 payableChainToken = bytes32(uint256(uint160(address(0x1234))));
    bytes32 payableChainId = keccak256('eip155:1');
    bytes32 payer = bytes32(uint256(uint160(address(0x5678))));
    bytes32 payerChainToken = bytes32(uint256(uint160(address(0xABCD))));
    bytes32 payerChainId = keccak256('eip155:10');
    bytes32 payerPaymentId_ = keccak256('user-payment-1');

    bytes memory encoded = PaymentPayload({
        payloadType: 2,
        version: 1,
        actionType: 5,
        payableId: payableId,
        nonce: 999,
        initiatedAt: 1_715_000_000,
        amount: 5e6,
        payableChainToken: payableChainToken,
        payableChainId: payableChainId,
        payer: payer,
        payerChainToken: payerChainToken,
        payerChainId: payerChainId,
        payerPaymentId: payerPaymentId_
      }).encode();

    PaymentPayload memory parsed = encoded.decodePaymentPayload();
    assertEq(parsed.actionType, 5);
    assertEq(parsed.payableId, payableId);
    assertEq(parsed.nonce, 999);
    assertEq(parsed.amount, 5e6);
    assertEq(parsed.initiatedAt, 1_715_000_000);
    assertEq(parsed.payerPaymentId, payerPaymentId_);
    assertEq(parsed.payableChainToken, payableChainToken);
    assertEq(parsed.payableChainId, payableChainId);
    assertEq(parsed.payer, payer);
    assertEq(parsed.payerChainToken, payerChainToken);
    assertEq(parsed.payerChainId, payerChainId);
    assertEq(parsed.amount, 5e6);
    assertEq(parsed.nonce, 999);
  }

  function testDecodePaymentPayloadTrailingBytesReverts() public {
    bytes memory valid = PaymentPayload({
        payloadType: 2,
        version: 1,
        actionType: 5,
        payableId: bytes32(0),
        nonce: 1,
        initiatedAt: 0,
        amount: 100,
        payableChainToken: bytes32(0),
        payableChainId: keccak256('eip155:1'),
        payer: bytes32(0),
        payerChainToken: bytes32(0),
        payerChainId: keccak256('eip155:2'),
        payerPaymentId: bytes32(0)
      }).encode();
    bytes memory withTrailing = abi.encodePacked(valid, uint8(0xFF));
    vm.expectRevert(InvalidPayload.selector);
    withTrailing.decodePaymentPayload();
  }

  function testDecodePaymentPayloadInvalidActionTypeReverts() public {
    // Correct type 2 but incorrect actionType (e.g., 6 instead of 5).
    bytes memory bad = PaymentPayload({
        payloadType: 2,
        version: 1,
        actionType: 6,
        payableId: bytes32(0),
        nonce: 1,
        initiatedAt: 0,
        amount: 100,
        payableChainToken: bytes32(0),
        payableChainId: keccak256('eip155:1'),
        payer: bytes32(0),
        payerChainToken: bytes32(0),
        payerChainId: keccak256('eip155:2'),
        payerPaymentId: bytes32(0)
      }).encode();

    vm.expectRevert(InvalidPayload.selector);
    bad.decodePaymentPayload();
  }

  function testDecodePaymentPayloadAtIndex() public pure {
    PaymentPayload memory original = PaymentPayload({
      payloadType: 2,
      version: 1,
      actionType: 5,
      payableId: keccak256('pid'),
      nonce: 123,
      initiatedAt: 1_720_000_000,
      amount: 456,
      payableChainToken: bytes32(uint256(1)),
      payableChainId: keccak256('c1'),
      payer: bytes32(uint256(2)),
      payerChainToken: bytes32(uint256(3)),
      payerChainId: keccak256('c2'),
      payerPaymentId: keccak256('user-pay-123')
    });

    bytes memory payload = original.encode();
    bytes memory message = abi.encodePacked(bytes('header-prefix'), payload, bytes('footer-suffix'));

    // Offset of payload in message is 13 bytes.
    PaymentPayload memory parsed = message.decodePaymentPayload(13);

    assertEq(parsed.payloadType, original.payloadType);
    assertEq(parsed.version, original.version);
    assertEq(parsed.actionType, original.actionType);
    assertEq(parsed.payableId, original.payableId);
    assertEq(parsed.nonce, original.nonce);
    assertEq(parsed.amount, original.amount);
    assertEq(parsed.initiatedAt, original.initiatedAt);
    assertEq(parsed.payerPaymentId, original.payerPaymentId);
    assertEq(parsed.payableChainToken, original.payableChainToken);
    assertEq(parsed.payableChainId, original.payableChainId);
    assertEq(parsed.payer, original.payer);
    assertEq(parsed.payerChainToken, original.payerChainToken);
    assertEq(parsed.payerChainId, original.payerChainId);
  }
}
