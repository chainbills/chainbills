// SPDX-License-Identifier: Apache 2
pragma solidity ^0.8.30;

import {Test} from 'forge-std/Test.sol';
import {CbPayloadCodec} from 'src/libraries/CbPayloadCodec.sol';
import {ICbErrors} from 'src/interfaces/ICbErrors.sol';
import {
  PAYABLE_ACTION_CLOSE,
  PAYABLE_ACTION_CREATE,
  PAYABLE_ACTION_REOPEN,
  PAYABLE_ACTION_UPDATE_ALLOWED_TOKENS_AND_AMOUNTS,
  PAYABLE_PAYLOAD_TYPE,
  PAYLOAD_VERSION,
  PAYMENT_ACTION_PAY,
  PAYMENT_PAYLOAD_LENGTH,
  PAYMENT_PAYLOAD_TYPE
} from 'src/types/CbConstants.sol';
import {PayablePayload, PaymentPayload, TokenAndAmountForeign} from 'src/types/CbTypes.sol';

/// Thin wrapper so the linked library's reverts surface at cheatcode depth.
contract CodecRevertsHarness {
  function encodePayable(PayablePayload memory p) external pure returns (bytes memory) {
    return CbPayloadCodec.encodePayablePayload(p);
  }

  function decodePayable(bytes memory enc) external pure returns (PayablePayload memory) {
    return CbPayloadCodec.decodePayablePayload(enc);
  }

  function decodePayment(bytes memory enc) external pure returns (PaymentPayload memory) {
    return CbPayloadCodec.decodePaymentPayload(enc);
  }
}

contract PayloadCodecRevertsTest is Test, ICbErrors {
  CodecRevertsHarness internal harness;

  function setUp() public {
    harness = new CodecRevertsHarness();
  }

  function test() public {}

  // ---------------------------------------------------------------------------
  // encodePayablePayload
  // ---------------------------------------------------------------------------

  function test_RevertWhen_Encode_UnknownActionType() public {
    PayablePayload memory p;
    p.version = PAYLOAD_VERSION;
    p.actionType = 99; // outside 1..4
    vm.expectRevert(abi.encodeWithSelector(InvalidPayablePayloadActionType.selector, uint8(99)));
    harness.encodePayable(p);
  }

  function test_RevertWhen_Encode_ZeroActionType() public {
    PayablePayload memory p;
    p.version = PAYLOAD_VERSION;
    p.actionType = 0;
    vm.expectRevert(abi.encodeWithSelector(InvalidPayablePayloadActionType.selector, uint8(0)));
    harness.encodePayable(p);
  }

  // ---------------------------------------------------------------------------
  // decodePayablePayload
  // ---------------------------------------------------------------------------

  function test_RevertWhen_DecodePayable_WrongPayloadType() public {
    // First byte is the payload type: must be 1 for payable payloads.
    bytes memory bad = abi.encodePacked(
      uint8(PAYMENT_PAYLOAD_TYPE),
      uint8(PAYLOAD_VERSION),
      uint8(PAYABLE_ACTION_CLOSE),
      bytes32(uint256(0x11)),
      uint64(1),
      uint64(1),
      false
    );
    vm.expectRevert(InvalidPayload.selector);
    harness.decodePayable(bad);
  }

  function test_RevertWhen_DecodePayable_UnknownActionType() public {
    bytes memory bad = abi.encodePacked(
      uint8(PAYABLE_PAYLOAD_TYPE),
      uint8(PAYLOAD_VERSION),
      uint8(88), // unknown
      bytes32(uint256(0x11)),
      uint64(1),
      uint64(1)
    );
    vm.expectRevert(abi.encodeWithSelector(InvalidPayablePayloadActionType.selector, uint8(88)));
    harness.decodePayable(bad);
  }

  function test_RevertWhen_DecodePayable_TrailingBytes() public {
    PayablePayload memory p;
    p.version = PAYLOAD_VERSION;
    p.actionType = PAYABLE_ACTION_CLOSE;
    p.isClosed = true;
    bytes memory enc = harness.encodePayable(p);
    bytes memory withTrailing = abi.encodePacked(enc, uint8(0xff));
    vm.expectRevert(InvalidPayload.selector);
    harness.decodePayable(withTrailing);
  }

  // ---------------------------------------------------------------------------
  // decodePaymentPayload
  // ---------------------------------------------------------------------------

  function test_RevertWhen_DecodePayment_WrongLength() public {
    bytes memory tooShort = new bytes(PAYMENT_PAYLOAD_LENGTH - 1);
    vm.expectRevert(InvalidPayload.selector);
    harness.decodePayment(tooShort);

    bytes memory tooLong = new bytes(PAYMENT_PAYLOAD_LENGTH + 1);
    vm.expectRevert(InvalidPayload.selector);
    harness.decodePayment(tooLong);
  }

  function test_RevertWhen_DecodePayment_WrongPayloadType() public {
    bytes memory bad = new bytes(PAYMENT_PAYLOAD_LENGTH);
    bad[0] = bytes1(uint8(PAYABLE_PAYLOAD_TYPE)); // must be 2 for payment payloads.
    bad[1] = bytes1(uint8(PAYLOAD_VERSION));
    bad[2] = bytes1(uint8(PAYMENT_ACTION_PAY));
    vm.expectRevert(InvalidPayload.selector);
    harness.decodePayment(bad);
  }

  function test_RevertWhen_DecodePayment_WrongActionType() public {
    bytes memory bad = new bytes(PAYMENT_PAYLOAD_LENGTH);
    bad[0] = bytes1(uint8(PAYMENT_PAYLOAD_TYPE));
    bad[1] = bytes1(uint8(PAYLOAD_VERSION));
    bad[2] = bytes1(uint8(PAYABLE_ACTION_CREATE)); // wrong action for payment payload
    vm.expectRevert(InvalidPayload.selector);
    harness.decodePayment(bad);
  }

  // ---------------------------------------------------------------------------
  // Encode: over-large allowed-tokens list
  // ---------------------------------------------------------------------------

  function test_RevertWhen_Encode_TooManyAllowedTokens() public {
    PayablePayload memory p;
    p.version = PAYLOAD_VERSION;
    p.actionType = PAYABLE_ACTION_UPDATE_ALLOWED_TOKENS_AND_AMOUNTS;
    // The codec rejects counts above type(uint8).max = 255. Building a 256-length array explicitly.
    p.allowedTokensAndAmounts = new TokenAndAmountForeign[](256);
    vm.expectRevert(InvalidPayload.selector);
    harness.encodePayable(p);
  }

  // ---------------------------------------------------------------------------
  // Reopen round-trip: ensures the closed-status branch of encode fires.
  // ---------------------------------------------------------------------------

  function test_ReopenRoundTrip() public view {
    PayablePayload memory p;
    p.version = PAYLOAD_VERSION;
    p.actionType = PAYABLE_ACTION_REOPEN;
    p.payableId = keccak256('reopen');
    p.nonce = 3;
    p.initiatedAt = uint64(block.timestamp);
    p.isClosed = false;
    PayablePayload memory dec = harness.decodePayable(harness.encodePayable(p));
    assertEq(dec.actionType, PAYABLE_ACTION_REOPEN);
    assertFalse(dec.isClosed);
  }
}
