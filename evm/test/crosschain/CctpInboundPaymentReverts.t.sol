// SPDX-License-Identifier: Apache 2
pragma solidity ^0.8.30;

import {BytesParsing} from 'wormhole/libraries/BytesParsing.sol';
import {CCTP_FINALITY_FAST, CCTP_MESSAGE_BODY_OFFSET, CCTP_HOOK_DATA_OFFSET} from 'src/types/CbConstants.sol';
import {CbTestBase} from '../base/CbTestBase.sol';

contract CctpInboundPaymentRevertsTest is CbTestBase {
  using BytesParsing for bytes;

  bytes32 internal payableId;
  uint256 internal constant HOOK_DATA_START = CCTP_MESSAGE_BODY_OFFSET + CCTP_HOOK_DATA_OFFSET;
  uint256 internal constant PAYLOAD_AMOUNT_OFFSET = 51;
  uint256 internal constant PAYLOAD_PAYABLE_CHAIN_TOKEN_OFFSET = 59;
  uint256 internal constant PAYLOAD_PAYABLE_CHAIN_ID_OFFSET = 91;
  uint256 internal constant PAYLOAD_PAYER_CHAIN_TOKEN_OFFSET = 155;
  uint256 internal constant PAYLOAD_PAYER_CHAIN_ID_OFFSET = 187;

  function setUp() public override {
    super.setUp();
    _setUpChainB();
    vm.deal(host, 10 ether);
    vm.prank(host);
    (payableId,) = chainB.cb.createPayable{value: WORMHOLE_FEE}(_anyToken(), false);
    chainA.cb.receivePayableUpdateViaWormhole(_lastVaa(chainB));
    _fundUsdc(chainA, payer, 1_000e6);
  }

  function test_RevertWhen_ReceiveForeignPaymentViaCctp_PayerChainMismatch() public {
    vm.prank(payer);
    chainA.cb.payForeignViaCctp(payableId, address(chainA.usdc), 100e6, 10e6);
    (bytes memory message,) = _lastCctp(chainA, CCTP_FINALITY_FAST, 0, true);
    bytes memory tampered = _replaceBytes32(message, HOOK_DATA_START + PAYLOAD_PAYER_CHAIN_ID_OFFSET, bytes32('wrong'));
    vm.expectRevert(PaymentChainMismatch.selector);
    vm.prank(relayer);
    chainB.cb.receiveForeignPaymentViaCctp(tampered, _attestationFor(tampered));
  }

  function test_RevertWhen_ReceiveForeignPaymentViaCctp_PayableChainMismatch() public {
    vm.prank(payer);
    chainA.cb.payForeignViaCctp(payableId, address(chainA.usdc), 100e6, 10e6);
    (bytes memory message,) = _lastCctp(chainA, CCTP_FINALITY_FAST, 0, true);
    bytes memory tampered = _replaceBytes32(message, HOOK_DATA_START + PAYLOAD_PAYABLE_CHAIN_ID_OFFSET, bytes32('wrong'));
    vm.expectRevert(PaymentChainMismatch.selector);
    vm.prank(relayer);
    chainB.cb.receiveForeignPaymentViaCctp(tampered, _attestationFor(tampered));
  }

  function test_RevertWhen_ReceiveForeignPaymentViaCctp_ZeroAmount() public {
    vm.prank(payer);
    chainA.cb.payForeignViaCctp(payableId, address(chainA.usdc), 100e6, 10e6);
    (bytes memory message,) = _lastCctp(chainA, CCTP_FINALITY_FAST, 0, true);
    bytes memory tampered = _replaceUint64(message, HOOK_DATA_START + PAYLOAD_AMOUNT_OFFSET, 0);
    vm.expectRevert(ZeroAmountSpecified.selector);
    vm.prank(relayer);
    chainB.cb.receiveForeignPaymentViaCctp(tampered, _attestationFor(tampered));
  }

  function test_RevertWhen_ReceiveForeignPaymentViaCctp_PayerChainTokenMismatch() public {
    vm.prank(payer);
    chainA.cb.payForeignViaCctp(payableId, address(chainA.usdc), 100e6, 10e6);
    (bytes memory message,) = _lastCctp(chainA, CCTP_FINALITY_FAST, 0, true);
    bytes32 forgedPayerToken = bytes32(uint256(uint160(makeAddr('wrong-payer-token'))));
    bytes memory tampered = _replaceBytes32(message, HOOK_DATA_START + PAYLOAD_PAYER_CHAIN_TOKEN_OFFSET, forgedPayerToken);
    bytes32 burnToken = bytes32(uint256(uint160(address(chainA.usdc))));
    vm.expectRevert(abi.encodeWithSelector(CircleTokenMismatch.selector, burnToken, forgedPayerToken));
    vm.prank(relayer);
    chainB.cb.receiveForeignPaymentViaCctp(tampered, _attestationFor(tampered));
  }

  function test_RevertWhen_ReceiveForeignPaymentViaCctp_PayableChainTokenMismatch() public {
    vm.prank(payer);
    chainA.cb.payForeignViaCctp(payableId, address(chainA.usdc), 100e6, 10e6);
    (bytes memory message,) = _lastCctp(chainA, CCTP_FINALITY_FAST, 0, true);
    bytes32 forgedPayableToken = bytes32(uint256(uint160(makeAddr('wrong-payable-token'))));
    bytes memory tampered =
      _replaceBytes32(message, HOOK_DATA_START + PAYLOAD_PAYABLE_CHAIN_TOKEN_OFFSET, forgedPayableToken);
    bytes32 burnToken = bytes32(uint256(uint160(address(chainA.usdc))));
    vm.expectRevert(abi.encodeWithSelector(CircleTokenMismatch.selector, burnToken, forgedPayableToken));
    vm.prank(relayer);
    chainB.cb.receiveForeignPaymentViaCctp(tampered, _attestationFor(tampered));
  }

  function test_RevertWhen_ReceiveForeignPaymentViaCctp_BurnAmountLessThanPayloadAmount() public {
    vm.prank(payer);
    chainA.cb.payForeignViaCctp(payableId, address(chainA.usdc), 100e6, 10e6);
    (bytes memory message,) = _lastCctp(chainA, CCTP_FINALITY_FAST, 0, true);
    // The burn body carries amount=110e6 (100 + 10 maxFee). Rewrite the payload amount to 200e6 so the burn amount
    // falls below it. Also rewrite the payer chain token so both token checks pass first.
    bytes memory tampered = _replaceUint64(message, HOOK_DATA_START + PAYLOAD_AMOUNT_OFFSET, 200e6);
    vm.expectRevert(abi.encodeWithSelector(CircleMintedLessThanAmount.selector, uint256(110e6), uint256(200e6)));
    vm.prank(relayer);
    chainB.cb.receiveForeignPaymentViaCctp(tampered, _attestationFor(tampered));
  }

  function test_RevertWhen_ReceiveForeignPaymentViaCctp_PayableChainTokenUnmapped() public {
    // The minter has no local token registered for the (sourceDomain, forgedPayerToken) tuple.
    // Rewrite both the burn token in the CCTP body and the payerChainToken in the payload so parsing agrees
    // but the minter mapping returns address(0).
    vm.prank(payer);
    chainA.cb.payForeignViaCctp(payableId, address(chainA.usdc), 100e6, 10e6);
    (bytes memory message,) = _lastCctp(chainA, CCTP_FINALITY_FAST, 0, true);
    bytes32 forged = bytes32(uint256(uint160(makeAddr('unmapped-token'))));
    // Burn token in the body sits at absolute offset CCTP_MESSAGE_BODY_OFFSET + 4.
    bytes memory tampered = _replaceBytes32(message, CCTP_MESSAGE_BODY_OFFSET + 4, forged);
    tampered = _replaceBytes32(tampered, HOOK_DATA_START + PAYLOAD_PAYER_CHAIN_TOKEN_OFFSET, forged);
    // Payable chain token is not tampered, so localToken=address(0) triggers the mismatch on the local side.
    bytes32 payableChainToken = bytes32(uint256(uint160(address(chainB.usdc))));
    vm.expectRevert(abi.encodeWithSelector(CircleTokenMismatch.selector, forged, payableChainToken));
    vm.prank(relayer);
    chainB.cb.receiveForeignPaymentViaCctp(tampered, _attestationFor(tampered));
  }

  function _replaceBytes32(bytes memory data, uint256 offset, bytes32 value) internal pure returns (bytes memory) {
    (bytes memory prefix,) = data.slice(0, offset);
    (bytes memory suffix,) = data.slice(offset + 32, data.length - offset - 32);
    return abi.encodePacked(prefix, value, suffix);
  }

  function _replaceUint64(bytes memory data, uint256 offset, uint64 value) internal pure returns (bytes memory) {
    (bytes memory prefix,) = data.slice(0, offset);
    (bytes memory suffix,) = data.slice(offset + 8, data.length - offset - 8);
    return abi.encodePacked(prefix, value, suffix);
  }

  function _attestationFor(bytes memory message) internal pure returns (bytes memory) {
    return abi.encodePacked(keccak256(message));
  }
}
