// SPDX-License-Identifier: Apache 2
pragma solidity ^0.8.30;

import {BytesParsing} from 'wormhole/libraries/BytesParsing.sol';
import {
  CCTP_DESTINATION_CALLER_OFFSET,
  CCTP_FINALITY_FAST,
  CCTP_FINALITY_FINALIZED,
  CCTP_FINALITY_THRESHOLD_EXECUTED_OFFSET,
  CCTP_MESSAGE_BODY_OFFSET,
  CCTP_MINT_RECIPIENT_OFFSET,
  CCTP_MESSAGE_SENDER_OFFSET,
  CCTP_BURN_TOKEN_OFFSET,
  CCTP_SENDER_OFFSET,
  FEATURE_PAY_FOREIGN,
  FEATURE_RECEIVE_FOREIGN_PAYMENT
} from 'src/types/CbConstants.sol';
import {ForeignChainLimits, ForeignChainSwitches, TokenAndAmount} from 'src/types/CbTypes.sol';
import {CbTestBase} from '../base/CbTestBase.sol';
import {MockTaxToken} from '../mocks/MockTaxToken.sol';

contract CrossChainPaymentsTest is CbTestBase {
  using BytesParsing for bytes;

  bytes32 internal payableId;

  function setUp() public override {
    super.setUp();
    _setUpChainB();
    vm.deal(host, 10 ether);
    vm.prank(host);
    (payableId,) = chainB.cb.createPayable{value: WORMHOLE_FEE}(_anyToken(), false);
    // Mirror the payable on chain A so it can be paid from there.
    chainA.cb.receivePayableUpdateViaWormhole(_lastVaa(chainB));

    _fundUsdc(chainA, payer, 1_000e6);
  }

  function _createForeignPayable(TokenAndAmount[] memory allowed, bool isAutoWithdraw) internal returns (bytes32 id) {
    vm.deal(host, host.balance + WORMHOLE_FEE);
    vm.prank(host);
    (id,) = chainB.cb.createPayable{value: WORMHOLE_FEE}(allowed, isAutoWithdraw);
    chainA.cb.receivePayableUpdateViaWormhole(_lastVaa(chainB));
  }

  // ---------------------------------------------------------------------------
  // payForeignViaCctp
  // ---------------------------------------------------------------------------

  function test_PayForeignViaCctp_BurnsAndEmits() public {
    vm.expectEmit(true, true, false, true, address(chainA.cb));
    emit SentForeignPaymentViaCctp(payableId, chainB.cbChainId, bytes32(0), 1, 110e6, 10e6, CCTP_FINALITY_FAST);
    vm.prank(payer);
    chainA.cb.payForeignViaCctp(payableId, address(chainA.usdc), 100e6, 10e6);
    assertEq(chainA.usdc.balanceOf(payer), 1_000e6 - 110e6);
  }

  function test_RevertWhen_PayForeignViaCctp_NativeTokenNotBridgeable() public {
    vm.expectRevert(NativeTokenNotBridgeable.selector);
    vm.prank(payer);
    chainA.cb.payForeignViaCctp(payableId, address(chainA.cb), 100e6, 10e6);
  }

  function test_RevertWhen_PayForeignViaCctp_AmountExceedsCrossChainLimit() public {
    vm.expectRevert(AmountExceedsCrossChainLimit.selector);
    vm.prank(payer);
    chainA.cb.payForeignViaCctp(payableId, address(chainA.usdc), uint256(type(uint64).max) + 1, 0);
  }

  function test_RevertWhen_PayForeignViaCctp_InvalidPayableId() public {
    vm.expectRevert(InvalidPayableId.selector);
    vm.prank(payer);
    // forge-lint: disable-next-line(unsafe-typecast)
    chainA.cb.payForeignViaCctp(bytes32('nope'), address(chainA.usdc), 100e6, 10e6);
  }

  function test_RevertWhen_PayForeignViaCctp_PayableIsClosed() public {
    vm.prank(host);
    chainB.cb.closePayable{value: WORMHOLE_FEE}(payableId);
    chainA.cb.receivePayableUpdateViaWormhole(_lastVaa(chainB));
    vm.expectRevert(PayableIsClosed.selector);
    vm.prank(payer);
    chainA.cb.payForeignViaCctp(payableId, address(chainA.usdc), 100e6, 10e6);
  }

  function test_RevertWhen_PayForeignViaCctp_OutboundPaymentsDisabled() public {
    vm.prank(owner);
    chainA.cb
      .setForeignChainSwitches(
        chainB.cbChainId,
        ForeignChainSwitches({
          isCctpUpdateEnabled: true,
          isInboundUpdateEnabled: true,
          isOutboundPaymentEnabled: false,
          isInboundPaymentEnabled: true
        })
      );
    vm.expectRevert(abi.encodeWithSelector(OutboundPaymentsDisabled.selector, chainB.cbChainId));
    vm.prank(payer);
    chainA.cb.payForeignViaCctp(payableId, address(chainA.usdc), 100e6, 10e6);
  }

  function test_RevertWhen_PayForeignViaCctp_CctpMaxFeeTooHigh() public {
    vm.prank(owner);
    chainA.cb.setForeignChainLimits(chainB.cbChainId, ForeignChainLimits(true, 100)); // 1% cap
    vm.expectRevert(abi.encodeWithSelector(CctpMaxFeeTooHigh.selector, 5e6, 1e6));
    vm.prank(payer);
    chainA.cb.payForeignViaCctp(payableId, address(chainA.usdc), 100e6, 5e6);
  }

  function test_RevertWhen_PayForeignViaCctp_MatchingTokenNotFound() public {
    MockTaxToken unmatched = new MockTaxToken(0);
    vm.prank(owner);
    chainA.cb.allowPaymentsForToken(address(unmatched));
    unmatched.mint(payer, 1000e18);
    vm.prank(payer);
    unmatched.approve(address(chainA.cb), type(uint256).max);

    vm.expectRevert(abi.encodeWithSelector(MatchingTokenNotFound.selector, chainB.cbChainId, bytes32(0)));
    vm.prank(payer);
    chainA.cb.payForeignViaCctp(payableId, address(unmatched), 1e18, 0);
  }

  function test_RevertWhen_PayForeignViaCctp_MatchingTokenAndAmountNotFound() public {
    bytes32 restrictedPayableId = _createForeignPayable(_only(address(chainB.usdc), 50e6), false);
    vm.expectRevert(MatchingTokenAndAmountNotFound.selector);
    vm.prank(payer);
    chainA.cb.payForeignViaCctp(restrictedPayableId, address(chainA.usdc), 999e6, 0);
  }

  function test_PayForeignViaCctp_RespectsAllowedTokenAndAmount() public {
    bytes32 restrictedPayableId = _createForeignPayable(_only(address(chainB.usdc), 50e6), false);
    vm.prank(payer);
    chainA.cb.payForeignViaCctp(restrictedPayableId, address(chainA.usdc), 50e6, 0);
  }

  function test_RevertWhen_PayForeignViaCctp_UnexpectedAmountReceived() public {
    MockTaxToken tax = new MockTaxToken(500);
    vm.startPrank(owner);
    chainA.cb.allowPaymentsForToken(address(tax));
    chainA.cb.registerMatchingToken(chainB.cbChainId, bytes32(uint256(uint160(address(chainB.usdc)))), address(tax));
    vm.stopPrank();
    tax.mint(payer, 1000e18);
    vm.prank(payer);
    tax.approve(address(chainA.cb), type(uint256).max);

    vm.expectRevert(abi.encodeWithSelector(UnexpectedAmountReceived.selector, 0.95e18, 1e18));
    vm.prank(payer);
    chainA.cb.payForeignViaCctp(payableId, address(tax), 1e18, 0);
  }

  function test_RevertWhen_PayForeignViaCctp_Paused() public {
    vm.prank(owner);
    chainA.cb.pauseFeatures(FEATURE_PAY_FOREIGN);
    vm.expectRevert(abi.encodeWithSelector(FeaturePaused.selector, FEATURE_PAY_FOREIGN));
    vm.prank(payer);
    chainA.cb.payForeignViaCctp(payableId, address(chainA.usdc), 100e6, 10e6);
  }

  // ---------------------------------------------------------------------------
  // receiveForeignPaymentViaCctp: happy paths
  // ---------------------------------------------------------------------------

  function test_ReceiveForeignPaymentViaCctp_FastFinality_CreditsPayable() public {
    vm.prank(payer);
    chainA.cb.payForeignViaCctp(payableId, address(chainA.usdc), 100e6, 10e6);
    // Circle takes the full offered fee, so exactly the requested amount is minted.
    (bytes memory message, bytes memory attestation) = _lastCctp(chainA, CCTP_FINALITY_FAST, 10e6, true);
    (bytes32 burnNonce,) = message.asBytes32(12);

    vm.expectEmit(true, true, false, true, address(chainB.cb));
    emit ReceivedForeignPaymentViaCctp(payableId, chainA.cbChainId, bytes32(0), burnNonce, 100e6, CCTP_FINALITY_FAST);
    vm.prank(relayer);
    chainB.cb.receiveForeignPaymentViaCctp(message, attestation);
    assertEq(chainB.usdc.balanceOf(address(chainB.cb)), 100e6);
  }

  function test_ReceiveForeignPaymentViaCctp_FinalizedFinality_CreditsPayable() public {
    vm.prank(payer);
    chainA.cb.payForeignViaCctp(payableId, address(chainA.usdc), 100e6, 10e6);
    (bytes memory message, bytes memory attestation) = _lastCctp(chainA, CCTP_FINALITY_FINALIZED, 10e6, true);
    vm.prank(relayer);
    chainB.cb.receiveForeignPaymentViaCctp(message, attestation);
    assertEq(chainB.usdc.balanceOf(address(chainB.cb)), 100e6);
  }

  function test_ReceiveForeignPaymentViaCctp_FeeExecuted_CreditsMintedAmount() public {
    vm.prank(payer);
    chainA.cb.payForeignViaCctp(payableId, address(chainA.usdc), 100e6, 10e6);
    // Circle only takes 4 of the 10 offered as fee: the payer gets the difference credited.
    (bytes memory message, bytes memory attestation) = _lastCctp(chainA, CCTP_FINALITY_FAST, 4e6, true);
    vm.prank(relayer);
    chainB.cb.receiveForeignPaymentViaCctp(message, attestation);
    assertEq(chainB.usdc.balanceOf(address(chainB.cb)), 106e6);
  }

  function test_ReceiveForeignPaymentViaCctp_ClosedPayableStillCredited() public {
    vm.prank(payer);
    chainA.cb.payForeignViaCctp(payableId, address(chainA.usdc), 100e6, 10e6);
    (bytes memory message, bytes memory attestation) = _lastCctp(chainA, CCTP_FINALITY_FAST, 10e6, true);

    // The payable closes locally on B after the payer already burned on A.
    vm.prank(host);
    chainB.cb.closePayable{value: WORMHOLE_FEE}(payableId);

    vm.prank(relayer);
    chainB.cb.receiveForeignPaymentViaCctp(message, attestation);
    assertEq(chainB.usdc.balanceOf(address(chainB.cb)), 100e6);
  }

  function test_ReceiveForeignPaymentViaCctp_AutoWithdrawCreditsHostImmediately() public {
    bytes32 autoPayableId = _createForeignPayable(_anyToken(), true);
    vm.prank(payer);
    chainA.cb.payForeignViaCctp(autoPayableId, address(chainA.usdc), 100e6, 10e6);
    (bytes memory message, bytes memory attestation) = _lastCctp(chainA, CCTP_FINALITY_FAST, 10e6, true);

    uint256 fee = (uint256(100e6) * uint256(DEFAULT_FEE_BPS)) / 10_000;
    vm.prank(relayer);
    chainB.cb.receiveForeignPaymentViaCctp(message, attestation);
    assertEq(chainB.usdc.balanceOf(host), 100e6 - fee);
    assertEq(chainB.usdc.balanceOf(address(chainB.cb)), 0);
  }

  // ---------------------------------------------------------------------------
  // receiveForeignPaymentViaCctp: guards
  // ---------------------------------------------------------------------------

  function test_RevertWhen_ReceiveForeignPaymentViaCctp_InvalidPayableId() public {
    bytes memory message = _burnMessageForNonexistentPayable();
    vm.expectRevert(InvalidPayableId.selector);
    vm.prank(relayer);
    chainB.cb.receiveForeignPaymentViaCctp(message, _attestationFor(message));
  }

  function test_RevertWhen_ReceiveForeignPaymentViaCctp_BurnNonceReplay() public {
    vm.prank(payer);
    chainA.cb.payForeignViaCctp(payableId, address(chainA.usdc), 100e6, 10e6);
    (bytes memory message, bytes memory attestation) = _lastCctp(chainA, CCTP_FINALITY_FAST, 0, true);
    vm.prank(relayer);
    chainB.cb.receiveForeignPaymentViaCctp(message, attestation);
    vm.expectRevert(); // CctpBurnNonceAlreadyConsumed(sourceDomain, nonce) — nonce is opaque here.
    vm.prank(relayer);
    chainB.cb.receiveForeignPaymentViaCctp(message, attestation);
  }

  function test_RevertWhen_ReceiveForeignPaymentViaCctp_PaymentNonceReplay() public {
    vm.prank(payer);
    chainA.cb.payForeignViaCctp(payableId, address(chainA.usdc), 100e6, 10e6);
    (bytes memory message, bytes memory attestation) = _lastCctp(chainA, CCTP_FINALITY_FAST, 0, true);
    vm.prank(relayer);
    chainB.cb.receiveForeignPaymentViaCctp(message, attestation);

    // A different physical CCTP message (new header nonce) carrying the exact same payment payload.
    bytes memory resent = _replaceBytes32(message, 12, bytes32(uint256(999)));
    bytes memory resentAttestation = _attestationFor(resent);
    vm.expectRevert(); // PaymentNonceAlreadyConsumed(payerChainId, payer, nonce)
    vm.prank(relayer);
    chainB.cb.receiveForeignPaymentViaCctp(resent, resentAttestation);
  }

  function test_RevertWhen_ReceiveForeignPaymentViaCctp_CircleMessageReceivingFailed() public {
    vm.prank(payer);
    chainA.cb.payForeignViaCctp(payableId, address(chainA.usdc), 100e6, 10e6);
    (bytes memory message, bytes memory attestation) = _lastCctp(chainA, CCTP_FINALITY_FAST, 0, true);
    chainB.transmitter.setFailingReceives(true);
    vm.expectRevert(CircleMessageReceivingFailed.selector);
    vm.prank(relayer);
    chainB.cb.receiveForeignPaymentViaCctp(message, attestation);
  }

  function test_RevertWhen_ReceiveForeignPaymentViaCctp_CircleMintedLessThanAmount() public {
    vm.prank(payer);
    chainA.cb.payForeignViaCctp(payableId, address(chainA.usdc), 100e6, 10e6);
    // Circle takes more fee than was ever offered as `maxFee`, so the mint falls below the payment amount.
    (bytes memory message, bytes memory attestation) = _lastCctp(chainA, CCTP_FINALITY_FAST, 11e6, true);
    vm.expectRevert(abi.encodeWithSelector(CircleMintedLessThanAmount.selector, 99e6, 100e6));
    vm.prank(relayer);
    chainB.cb.receiveForeignPaymentViaCctp(message, attestation);
  }

  function test_RevertWhen_ReceiveForeignPaymentViaCctp_InsufficientFinality() public {
    vm.prank(payer);
    chainA.cb.payForeignViaCctp(payableId, address(chainA.usdc), 100e6, 10e6);
    (bytes memory message, bytes memory attestation) = _lastCctp(chainA, 500, 0, true);
    vm.expectRevert(abi.encodeWithSelector(InsufficientFinality.selector, uint32(500), CCTP_FINALITY_FAST));
    vm.prank(relayer);
    chainB.cb.receiveForeignPaymentViaCctp(message, attestation);
  }

  function test_RevertWhen_ReceiveForeignPaymentViaCctp_WrongDestinationCaller() public {
    vm.prank(payer);
    chainA.cb.payForeignViaCctp(payableId, address(chainA.usdc), 100e6, 10e6);
    (bytes memory message,) = _lastCctp(chainA, CCTP_FINALITY_FAST, 0, true);
    bytes32 wrongCaller = bytes32(uint256(uint160(makeAddr('wrong-caller'))));
    bytes memory tampered = _replaceBytes32(message, CCTP_DESTINATION_CALLER_OFFSET, wrongCaller);
    vm.expectRevert(abi.encodeWithSelector(CircleRecipientMismatch.selector, wrongCaller));
    vm.prank(relayer);
    chainB.cb.receiveForeignPaymentViaCctp(tampered, _attestationFor(tampered));
  }

  function test_RevertWhen_ReceiveForeignPaymentViaCctp_WrongMintRecipient() public {
    vm.prank(payer);
    chainA.cb.payForeignViaCctp(payableId, address(chainA.usdc), 100e6, 10e6);
    (bytes memory message,) = _lastCctp(chainA, CCTP_FINALITY_FAST, 0, true);
    bytes32 wrongRecipient = bytes32(uint256(uint160(makeAddr('wrong-recipient'))));
    bytes memory tampered =
      _replaceBytes32(message, CCTP_MESSAGE_BODY_OFFSET + CCTP_MINT_RECIPIENT_OFFSET, wrongRecipient);
    vm.expectRevert(abi.encodeWithSelector(CircleRecipientMismatch.selector, wrongRecipient));
    vm.prank(relayer);
    chainB.cb.receiveForeignPaymentViaCctp(tampered, _attestationFor(tampered));
  }

  function test_RevertWhen_ReceiveForeignPaymentViaCctp_WrongBurnSender() public {
    vm.prank(payer);
    chainA.cb.payForeignViaCctp(payableId, address(chainA.usdc), 100e6, 10e6);
    (bytes memory message,) = _lastCctp(chainA, CCTP_FINALITY_FAST, 0, true);
    bytes32 wrongSender = bytes32(uint256(uint160(makeAddr('wrong-burn-sender'))));
    bytes memory tampered = _replaceBytes32(message, CCTP_MESSAGE_BODY_OFFSET + CCTP_MESSAGE_SENDER_OFFSET, wrongSender);
    vm.expectRevert(abi.encodeWithSelector(CircleSenderMismatch.selector, wrongSender));
    vm.prank(relayer);
    chainB.cb.receiveForeignPaymentViaCctp(tampered, _attestationFor(tampered));
  }

  function test_RevertWhen_ReceiveForeignPaymentViaCctp_TokenMismatch() public {
    vm.prank(payer);
    chainA.cb.payForeignViaCctp(payableId, address(chainA.usdc), 100e6, 10e6);
    (bytes memory message,) = _lastCctp(chainA, CCTP_FINALITY_FAST, 0, true);
    bytes32 wrongToken = bytes32(uint256(uint160(makeAddr('wrong-token'))));
    bytes memory tampered = _replaceBytes32(message, CCTP_MESSAGE_BODY_OFFSET + CCTP_BURN_TOKEN_OFFSET, wrongToken);
    vm.expectRevert(
      abi.encodeWithSelector(CircleTokenMismatch.selector, wrongToken, bytes32(uint256(uint160(address(chainA.usdc)))))
    );
    vm.prank(relayer);
    chainB.cb.receiveForeignPaymentViaCctp(tampered, _attestationFor(tampered));
  }

  function test_RevertWhen_ReceiveForeignPaymentViaCctp_DestinationDomainMismatch() public {
    vm.prank(payer);
    chainA.cb.payForeignViaCctp(payableId, address(chainA.usdc), 100e6, 10e6);
    (bytes memory message, bytes memory attestation) = _lastCctp(chainA, CCTP_FINALITY_FAST, 0, true);
    // Delivering B's own outbound message to A mismatches A's destination domain (0) against the encoded value (1).
    vm.expectRevert(abi.encodeWithSelector(CircleDestinationDomainMismatch.selector, chainB.circleDomain));
    vm.prank(relayer);
    chainA.cb.receiveForeignPaymentViaCctp(message, attestation);
  }

  function test_RevertWhen_ReceiveForeignPaymentViaCctp_InboundPaymentsDisabled() public {
    vm.prank(owner);
    chainB.cb
      .setForeignChainSwitches(
        chainA.cbChainId,
        ForeignChainSwitches({
          isCctpUpdateEnabled: true,
          isInboundUpdateEnabled: true,
          isOutboundPaymentEnabled: true,
          isInboundPaymentEnabled: false
        })
      );
    vm.prank(payer);
    chainA.cb.payForeignViaCctp(payableId, address(chainA.usdc), 100e6, 10e6);
    (bytes memory message, bytes memory attestation) = _lastCctp(chainA, CCTP_FINALITY_FAST, 0, true);
    vm.expectRevert(abi.encodeWithSelector(InboundPaymentsDisabled.selector, chainA.cbChainId));
    vm.prank(relayer);
    chainB.cb.receiveForeignPaymentViaCctp(message, attestation);
  }

  function test_RevertWhen_ReceiveForeignPaymentViaCctp_CallerLacksRelayerRole() public {
    vm.prank(owner);
    chainB.cb.setRelayerRestricted(true);
    vm.prank(payer);
    chainA.cb.payForeignViaCctp(payableId, address(chainA.usdc), 100e6, 10e6);
    (bytes memory message, bytes memory attestation) = _lastCctp(chainA, CCTP_FINALITY_FAST, 0, true);
    vm.expectRevert(abi.encodeWithSelector(RelayerOnly.selector, stranger));
    vm.prank(stranger);
    chainB.cb.receiveForeignPaymentViaCctp(message, attestation);
  }

  function test_RevertWhen_ReceiveForeignPaymentViaCctp_Paused() public {
    vm.prank(payer);
    chainA.cb.payForeignViaCctp(payableId, address(chainA.usdc), 100e6, 10e6);
    (bytes memory message, bytes memory attestation) = _lastCctp(chainA, CCTP_FINALITY_FAST, 0, true);
    vm.prank(owner);
    chainB.cb.pauseFeatures(FEATURE_RECEIVE_FOREIGN_PAYMENT);
    vm.expectRevert(abi.encodeWithSelector(FeaturePaused.selector, FEATURE_RECEIVE_FOREIGN_PAYMENT));
    vm.prank(relayer);
    chainB.cb.receiveForeignPaymentViaCctp(message, attestation);
  }

  // ---------------------------------------------------------------------------
  // Byte-level helpers
  // ---------------------------------------------------------------------------

  /// Replaces 32 bytes of `data` at `offset` with `value`.
  function _replaceBytes32(bytes memory data, uint256 offset, bytes32 value) internal pure returns (bytes memory) {
    (bytes memory prefix,) = data.slice(0, offset);
    (bytes memory suffix,) = data.slice(offset + 32, data.length - offset - 32);
    return abi.encodePacked(prefix, value, suffix);
  }

  /// Returns the Circle attestation matching `message`.
  function _attestationFor(bytes memory message) internal pure returns (bytes memory) {
    return abi.encodePacked(keccak256(message));
  }

  /// Builds a syntactically valid but never-created payable ID burn message by tampering a real one's payable ID.
  function _burnMessageForNonexistentPayable() internal returns (bytes memory) {
    vm.prank(payer);
    chainA.cb.payForeignViaCctp(payableId, address(chainA.usdc), 100e6, 10e6);
    (bytes memory message,) = _lastCctp(chainA, CCTP_FINALITY_FAST, 0, true);
    // The payable ID sits at the start of the 251-byte hook data appended after the fixed burn body fields.
    uint256 hookDataOffset = CCTP_MESSAGE_BODY_OFFSET + 228;
    uint256 payableIdOffset = hookDataOffset + 3; // payloadType(1) | version(1) | actionType(1) | payableId(32)
    // forge-lint: disable-next-line(unsafe-typecast)
    return _replaceBytes32(message, payableIdOffset, bytes32('does-not-exist'));
  }
}
