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
      version: 1,
      actionType: 1,
      payableId: bytes32(0),
      nonce: 7,
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
      version: 1,
      actionType: 1,
      payableId: keccak256('payable'),
      nonce: 42,
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
      version: 1,
      actionType: 2,
      payableId: pid,
      nonce: 13,
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
      version: 1,
      actionType: 3,
      payableId: pid,
      nonce: 99,
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
      version: 1,
      actionType: 4,
      payableId: bytes32(uint256(0xABC)),
      nonce: 5,
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
      version: 1,
      actionType: 0,
      payableId: bytes32(0),
      nonce: 1,
      isClosed: false,
      allowedTokensAndAmounts: new TokenAndAmountForeign[](0)
    }).encode();
  }

  function testEncodePayablePayloadActionType5Reverts() public {
    vm.expectRevert(InvalidPayablePayloadActionType.selector);
    PayablePayload({
      version: 1,
      actionType: 5,
      payableId: bytes32(0),
      nonce: 1,
      isClosed: false,
      allowedTokensAndAmounts: new TokenAndAmountForeign[](0)
    }).encode();
  }

  function testDecodePayablePayloadInvalidActionTypeReverts() public {
    // Manually craft a payload with action type 0.
    bytes memory bad = abi.encodePacked(uint8(1), uint8(0), bytes32(0), uint64(1), uint8(1));
    vm.expectRevert(InvalidPayablePayloadActionType.selector);
    bad.decodePayablePayload();
  }

  // ------------------------------------------------------------------------
  // Payable payload — trailing bytes check
  // ------------------------------------------------------------------------

  function testDecodePayablePayloadTrailingBytesReverts() public {
    // Encode a valid close payload, then append an extra byte.
    bytes memory valid = PayablePayload({
      version: 1,
      actionType: 2,
      payableId: bytes32(0),
      nonce: 1,
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
      version: 1,
      payableId: bytes32(0),
      payableChainToken: bytes32(0),
      payableChainId: payableChainId,
      payer: bytes32(0),
      payerChainToken: bytes32(0),
      payerChainId: payerChainId,
      amount: 100,
      circleNonce: 2
    }).encode();

    PaymentPayload memory parsed = encoded.decodePaymentPayload();
    assertEq(parsed.version, 1);
    assertEq(parsed.payableId, bytes32(0));
    assertEq(parsed.payableChainToken, bytes32(0));
    assertEq(parsed.payableChainId, payableChainId);
    assertEq(parsed.payer, bytes32(0));
    assertEq(parsed.payerChainToken, bytes32(0));
    assertEq(parsed.payerChainId, payerChainId);
    assertEq(parsed.amount, 100);
    assertEq(parsed.circleNonce, 2);
  }

  function testEncodeDecodePaymentPayloadWithNonZeroFields() public pure {
    bytes32 payableId = keccak256('payable');
    bytes32 payableChainToken = bytes32(uint256(uint160(address(0x1234))));
    bytes32 payableChainId = keccak256('eip155:1');
    bytes32 payer = bytes32(uint256(uint160(address(0x5678))));
    bytes32 payerChainToken = bytes32(uint256(uint160(address(0xABCD))));
    bytes32 payerChainId = keccak256('eip155:10');

    bytes memory encoded = PaymentPayload({
      version: 1,
      payableId: payableId,
      payableChainToken: payableChainToken,
      payableChainId: payableChainId,
      payer: payer,
      payerChainToken: payerChainToken,
      payerChainId: payerChainId,
      amount: 5e6,
      circleNonce: 999
    }).encode();

    PaymentPayload memory parsed = encoded.decodePaymentPayload();
    assertEq(parsed.payableId, payableId);
    assertEq(parsed.payableChainToken, payableChainToken);
    assertEq(parsed.payableChainId, payableChainId);
    assertEq(parsed.payer, payer);
    assertEq(parsed.payerChainToken, payerChainToken);
    assertEq(parsed.payerChainId, payerChainId);
    assertEq(parsed.amount, 5e6);
    assertEq(parsed.circleNonce, 999);
  }

  function testDecodePaymentPayloadTrailingBytesReverts() public {
    bytes memory valid = PaymentPayload({
      version: 1,
      payableId: bytes32(0),
      payableChainToken: bytes32(0),
      payableChainId: keccak256('eip155:1'),
      payer: bytes32(0),
      payerChainToken: bytes32(0),
      payerChainId: keccak256('eip155:2'),
      amount: 100,
      circleNonce: 1
    }).encode();
    bytes memory withTrailing = abi.encodePacked(valid, uint8(0xFF));
    vm.expectRevert(InvalidPayload.selector);
    withTrailing.decodePaymentPayload();
  }
}
