// SPDX-License-Identifier: Apache 2
pragma solidity ^0.8.30;

import {Test} from 'forge-std/Test.sol';
import {CbPayloadCodec} from 'src/libraries/CbPayloadCodec.sol';
import {
  PAYABLE_ACTION_CLOSE,
  PAYABLE_ACTION_CREATE,
  PAYABLE_ACTION_REOPEN,
  PAYABLE_ACTION_UPDATE_ALLOWED_TOKENS_AND_AMOUNTS,
  PAYLOAD_VERSION,
  PAYABLE_PAYLOAD_TYPE,
  PAYMENT_ACTION_PAY,
  PAYMENT_PAYLOAD_LENGTH,
  PAYMENT_PAYLOAD_TYPE
} from 'src/types/CbConstants.sol';
import {PayablePayload, PaymentPayload, TokenAndAmountForeign} from 'src/types/CbTypes.sol';

/// Thin wrapper so the linked CbPayloadCodec library can be called from fuzz tests.
contract CodecHarness {
  function encodePayable(PayablePayload memory p) external pure returns (bytes memory) {
    return CbPayloadCodec.encodePayablePayload(p);
  }

  function decodePayable(bytes memory enc) external pure returns (PayablePayload memory) {
    return CbPayloadCodec.decodePayablePayload(enc);
  }

  function encodePayment(PaymentPayload memory p) external pure returns (bytes memory) {
    return CbPayloadCodec.encodePaymentPayload(p);
  }

  function decodePayment(bytes memory enc) external pure returns (PaymentPayload memory) {
    return CbPayloadCodec.decodePaymentPayload(enc);
  }
}

/// Fuzz tests for CbPayloadCodec encode/decode round-trips.
contract PayloadCodecFuzzTest is Test {
  CodecHarness internal harness;

  function setUp() public {
    harness = new CodecHarness();
  }

  // Excludes the base from coverage reports.
  function test() public virtual {}

  // -------------------------------------------------------------------------
  // Payable payload: create / update (carry allowed tokens and amounts)
  // -------------------------------------------------------------------------

  /// Round-trip with exactly 0 allowed entries.
  function test_PayablePayload_Create_ZeroTokens_RoundTrip() public {
    PayablePayload memory p;
    p.version = PAYLOAD_VERSION;
    p.actionType = PAYABLE_ACTION_CREATE;
    p.payableId = keccak256('payable-zero');
    p.nonce = 1;
    p.initiatedAt = uint64(block.timestamp);
    p.allowedTokensAndAmounts = new TokenAndAmountForeign[](0);

    bytes memory enc = harness.encodePayable(p);
    PayablePayload memory dec = harness.decodePayable(enc);

    assertEq(dec.payloadType, PAYABLE_PAYLOAD_TYPE);
    assertEq(dec.version, PAYLOAD_VERSION);
    assertEq(dec.actionType, PAYABLE_ACTION_CREATE);
    assertEq(dec.payableId, p.payableId);
    assertEq(dec.nonce, p.nonce);
    assertEq(dec.initiatedAt, p.initiatedAt);
    assertEq(dec.allowedTokensAndAmounts.length, 0);
  }

  /// Round-trip with exactly 255 allowed entries (the uint8 maximum).
  function test_PayablePayload_Create_MaxTokens_RoundTrip() public {
    PayablePayload memory p;
    p.version = PAYLOAD_VERSION;
    p.actionType = PAYABLE_ACTION_CREATE;
    p.payableId = keccak256('payable-max');
    p.nonce = 1;
    p.initiatedAt = uint64(block.timestamp);
    p.allowedTokensAndAmounts = new TokenAndAmountForeign[](255);
    for (uint256 i; i < 255; i++) {
      // forge-lint: disable-next-line(unsafe-typecast)
      p.allowedTokensAndAmounts[i] = TokenAndAmountForeign(bytes32(i + 1), uint64(i + 1));
    }

    bytes memory enc = harness.encodePayable(p);
    PayablePayload memory dec = harness.decodePayable(enc);

    assertEq(dec.allowedTokensAndAmounts.length, 255);
    for (uint256 i; i < 255; i++) {
      assertEq(dec.allowedTokensAndAmounts[i].token, bytes32(i + 1));
      // forge-lint: disable-next-line(unsafe-typecast)
      assertEq(dec.allowedTokensAndAmounts[i].amount, uint64(i + 1));
    }
  }

  /// Fuzz round-trip for the create action with a variable entry count.
  function testFuzz_PayablePayload_Create_RoundTrip(
    bytes32 payableId,
    uint64 nonce,
    uint64 initiatedAt,
    uint8 count,
    bytes32[8] memory tokens,
    uint64[8] memory amounts
  ) public {
    uint256 n = bound(count, 0, 8);

    PayablePayload memory p;
    p.version = PAYLOAD_VERSION;
    p.actionType = PAYABLE_ACTION_CREATE;
    p.payableId = payableId;
    p.nonce = nonce;
    p.initiatedAt = initiatedAt;
    p.allowedTokensAndAmounts = new TokenAndAmountForeign[](n);
    for (uint256 i; i < n; i++) {
      p.allowedTokensAndAmounts[i] = TokenAndAmountForeign(tokens[i], amounts[i]);
    }

    bytes memory enc = harness.encodePayable(p);
    PayablePayload memory dec = harness.decodePayable(enc);

    assertEq(dec.payloadType, PAYABLE_PAYLOAD_TYPE);
    assertEq(dec.version, PAYLOAD_VERSION);
    assertEq(dec.actionType, PAYABLE_ACTION_CREATE);
    assertEq(dec.payableId, payableId);
    assertEq(dec.nonce, nonce);
    assertEq(dec.initiatedAt, initiatedAt);
    assertEq(dec.allowedTokensAndAmounts.length, n);
    for (uint256 i; i < n; i++) {
      assertEq(dec.allowedTokensAndAmounts[i].token, tokens[i]);
      assertEq(dec.allowedTokensAndAmounts[i].amount, amounts[i]);
    }
  }

  /// Fuzz round-trip for the update-allowed-tokens-and-amounts action.
  function testFuzz_PayablePayload_Update_RoundTrip(
    bytes32 payableId,
    uint64 nonce,
    uint64 initiatedAt,
    uint8 count,
    bytes32[8] memory tokens,
    uint64[8] memory amounts
  ) public {
    uint256 n = bound(count, 0, 8);

    PayablePayload memory p;
    p.version = PAYLOAD_VERSION;
    p.actionType = PAYABLE_ACTION_UPDATE_ALLOWED_TOKENS_AND_AMOUNTS;
    p.payableId = payableId;
    p.nonce = nonce;
    p.initiatedAt = initiatedAt;
    p.allowedTokensAndAmounts = new TokenAndAmountForeign[](n);
    for (uint256 i; i < n; i++) {
      p.allowedTokensAndAmounts[i] = TokenAndAmountForeign(tokens[i], amounts[i]);
    }

    bytes memory enc = harness.encodePayable(p);
    PayablePayload memory dec = harness.decodePayable(enc);

    assertEq(dec.actionType, PAYABLE_ACTION_UPDATE_ALLOWED_TOKENS_AND_AMOUNTS);
    assertEq(dec.payableId, payableId);
    assertEq(dec.allowedTokensAndAmounts.length, n);
    for (uint256 i; i < n; i++) {
      assertEq(dec.allowedTokensAndAmounts[i].token, tokens[i]);
      assertEq(dec.allowedTokensAndAmounts[i].amount, amounts[i]);
    }
  }

  // -------------------------------------------------------------------------
  // Payable payload: close / reopen (carry isClosed status)
  // -------------------------------------------------------------------------

  function testFuzz_PayablePayload_Close_RoundTrip(bytes32 payableId, uint64 nonce, uint64 initiatedAt) public {
    PayablePayload memory p;
    p.version = PAYLOAD_VERSION;
    p.actionType = PAYABLE_ACTION_CLOSE;
    p.payableId = payableId;
    p.nonce = nonce;
    p.initiatedAt = initiatedAt;
    p.isClosed = true;

    PayablePayload memory dec = harness.decodePayable(harness.encodePayable(p));

    assertEq(dec.payloadType, PAYABLE_PAYLOAD_TYPE);
    assertEq(dec.actionType, PAYABLE_ACTION_CLOSE);
    assertEq(dec.payableId, payableId);
    assertEq(dec.nonce, nonce);
    assertEq(dec.initiatedAt, initiatedAt);
    assertTrue(dec.isClosed);
  }

  function testFuzz_PayablePayload_Reopen_RoundTrip(bytes32 payableId, uint64 nonce, uint64 initiatedAt) public {
    PayablePayload memory p;
    p.version = PAYLOAD_VERSION;
    p.actionType = PAYABLE_ACTION_REOPEN;
    p.payableId = payableId;
    p.nonce = nonce;
    p.initiatedAt = initiatedAt;
    p.isClosed = false;

    PayablePayload memory dec = harness.decodePayable(harness.encodePayable(p));

    assertEq(dec.actionType, PAYABLE_ACTION_REOPEN);
    assertEq(dec.payableId, payableId);
    assertFalse(dec.isClosed);
  }

  // -------------------------------------------------------------------------
  // Payment payload: 251-byte fixed-length round-trip
  // -------------------------------------------------------------------------

  function testFuzz_PaymentPayload_RoundTrip(
    bytes32 payableId,
    uint64 nonce,
    uint64 initiatedAt,
    uint64 amount,
    bytes32 payableChainToken,
    bytes32 payableChainId,
    bytes32 payer,
    bytes32 payerChainToken,
    bytes32 payerChainId,
    bytes32 payerPaymentId
  ) public {
    PaymentPayload memory p;
    p.version = PAYLOAD_VERSION;
    p.payableId = payableId;
    p.nonce = nonce;
    p.initiatedAt = initiatedAt;
    p.amount = amount;
    p.payableChainToken = payableChainToken;
    p.payableChainId = payableChainId;
    p.payer = payer;
    p.payerChainToken = payerChainToken;
    p.payerChainId = payerChainId;
    p.payerPaymentId = payerPaymentId;

    bytes memory enc = harness.encodePayment(p);
    assertEq(enc.length, PAYMENT_PAYLOAD_LENGTH, 'exact 251 bytes');

    PaymentPayload memory dec = harness.decodePayment(enc);

    assertEq(dec.payloadType, PAYMENT_PAYLOAD_TYPE);
    assertEq(dec.version, PAYLOAD_VERSION);
    assertEq(dec.actionType, PAYMENT_ACTION_PAY);
    assertEq(dec.payableId, payableId);
    assertEq(dec.nonce, nonce);
    assertEq(dec.initiatedAt, initiatedAt);
    assertEq(dec.amount, amount);
    assertEq(dec.payableChainToken, payableChainToken);
    assertEq(dec.payableChainId, payableChainId);
    assertEq(dec.payer, payer);
    assertEq(dec.payerChainToken, payerChainToken);
    assertEq(dec.payerChainId, payerChainId);
    assertEq(dec.payerPaymentId, payerPaymentId);
  }

  // -------------------------------------------------------------------------
  // Boundary / negative cases
  // -------------------------------------------------------------------------

  /// decodePayablePayload rejects trailing bytes.
  function testFuzz_PayablePayload_Decode_RejectsTrailingBytes(bytes memory extra) public {
    vm.assume(extra.length > 0 && extra.length < 64);

    PayablePayload memory p;
    p.version = PAYLOAD_VERSION;
    p.actionType = PAYABLE_ACTION_CREATE;
    p.allowedTokensAndAmounts = new TokenAndAmountForeign[](0);

    bytes memory enc = abi.encodePacked(harness.encodePayable(p), extra);
    vm.expectRevert();
    harness.decodePayable(enc);
  }

  /// decodePaymentPayload rejects wrong-length input.
  function testFuzz_PaymentPayload_Decode_RejectsWrongLength(uint8 delta) public {
    vm.assume(delta > 0);

    PaymentPayload memory p;
    p.version = PAYLOAD_VERSION;
    bytes memory enc = harness.encodePayment(p);

    // Shorten by one byte.
    bytes memory shorter = new bytes(enc.length - 1);
    for (uint256 i; i < shorter.length; i++) shorter[i] = enc[i];
    vm.expectRevert();
    harness.decodePayment(shorter);

    // Extend by delta bytes.
    bytes memory longer = abi.encodePacked(enc, new bytes(delta));
    vm.expectRevert();
    harness.decodePayment(longer);
  }
}
