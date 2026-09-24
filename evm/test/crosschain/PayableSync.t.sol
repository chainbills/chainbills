// SPDX-License-Identifier: Apache 2
pragma solidity ^0.8.30;

import {CCTP_FINALITY_FAST, CCTP_FINALITY_FINALIZED, FEATURE_RECEIVE_PAYABLE_UPDATE} from 'src/types/CbConstants.sol';
import {PAYABLE_SYNC_ROLE} from 'src/types/CbRoles.sol';
import {ForeignChainSwitches, TokenAndAmountForeign} from 'src/types/CbTypes.sol';
import {CbTestBase} from '../base/CbTestBase.sol';
import {CctpMessageBuilder} from './CctpMessageBuilder.sol';

contract PayableSyncTest is CbTestBase, CctpMessageBuilder {
  function setUp() public override {
    super.setUp();
    _setUpChainB();
    vm.deal(host, 10 ether);
  }

  function _createPayableOnA() internal returns (bytes32 payableId) {
    vm.prank(host);
    (payableId,) = chainA.cb.createPayable{value: WORMHOLE_FEE}(_anyToken(), false);
  }

  // ---------------------------------------------------------------------------
  // Wormhole delivery
  // ---------------------------------------------------------------------------

  function test_ReceiveViaWormhole_AppliesCreate() public {
    bytes32 payableId = _createPayableOnA();
    bytes memory vaa = _lastVaa(chainA);
    vm.expectEmit(true, true, true, true, address(chainB.cb));
    emit ReceivedPayableUpdateViaWormhole(payableId, chainA.cbChainId, 1, keccak256(vaa));
    chainB.cb.receivePayableUpdateViaWormhole(vaa);
  }

  function test_RevertWhen_ReceiveViaWormhole_Replay() public {
    _createPayableOnA();
    bytes memory vaa = _lastVaa(chainA);
    chainB.cb.receivePayableUpdateViaWormhole(vaa);
    vm.expectRevert(abi.encodeWithSelector(WormholeMessageAlreadyConsumed.selector, keccak256(vaa)));
    chainB.cb.receivePayableUpdateViaWormhole(vaa);
  }

  function test_RevertWhen_ReceiveViaWormhole_UnknownChain() public {
    bytes memory vaa = chainB.wormhole.encodeVaa(999, bytes32(uint256(1)), 0, 1, bytes(''));
    vm.expectRevert(abi.encodeWithSelector(UnknownWormholeChain.selector, uint16(999)));
    chainB.cb.receivePayableUpdateViaWormhole(vaa);
  }

  function test_RevertWhen_ReceiveViaWormhole_EmitterNotRegistered() public {
    bytes32 wrongEmitter = bytes32(uint256(uint160(makeAddr('wrong-emitter'))));
    bytes memory vaa = chainB.wormhole.encodeVaa(chainA.wormholeChainId, wrongEmitter, 0, 1, bytes(''));
    vm.expectRevert(abi.encodeWithSelector(EmitterNotRegistered.selector, chainA.wormholeChainId, wrongEmitter));
    chainB.cb.receivePayableUpdateViaWormhole(vaa);
  }

  function test_RevertWhen_ReceiveViaWormhole_InboundUpdatesDisabled() public {
    vm.prank(owner);
    chainB.cb
      .setForeignChainSwitches(
        chainA.cbChainId,
        ForeignChainSwitches({
          isCctpUpdateEnabled: true,
          isInboundUpdateEnabled: false,
          isOutboundPaymentEnabled: true,
          isInboundPaymentEnabled: true
        })
      );
    _createPayableOnA();
    bytes memory vaa = _lastVaa(chainA);
    vm.expectRevert(abi.encodeWithSelector(InboundUpdatesDisabled.selector, chainA.cbChainId));
    chainB.cb.receivePayableUpdateViaWormhole(vaa);
  }

  function test_RevertWhen_ReceiveViaWormhole_CallerLacksRelayerRole() public {
    vm.prank(owner);
    chainB.cb.setRelayerRestricted(true);
    _createPayableOnA();
    bytes memory vaa = _lastVaa(chainA);
    vm.expectRevert(abi.encodeWithSelector(RelayerOnly.selector, stranger));
    vm.prank(stranger);
    chainB.cb.receivePayableUpdateViaWormhole(vaa);

    // A relayer may still submit.
    vm.prank(relayer);
    chainB.cb.receivePayableUpdateViaWormhole(vaa);
  }

  function test_RevertWhen_ReceiveViaWormhole_Paused() public {
    _createPayableOnA();
    bytes memory vaa = _lastVaa(chainA);
    vm.prank(owner);
    chainB.cb.pauseFeatures(FEATURE_RECEIVE_PAYABLE_UPDATE);
    vm.expectRevert(abi.encodeWithSelector(FeaturePaused.selector, FEATURE_RECEIVE_PAYABLE_UPDATE));
    chainB.cb.receivePayableUpdateViaWormhole(vaa);
  }

  // ---------------------------------------------------------------------------
  // CCTP delivery
  // ---------------------------------------------------------------------------

  function test_ReceiveViaCctp_UnfinalizedHandler() public {
    bytes32 payableId = _createPayableOnA();
    (bytes memory message, bytes memory attestation) = _lastCctp(chainA, CCTP_FINALITY_FAST, 0, false);
    vm.expectEmit(true, true, true, true, address(chainB.cb));
    emit ReceivedPayableUpdateViaCctp(payableId, chainA.cbChainId, 1, CCTP_FINALITY_FAST);
    chainB.cb.receivePayableUpdateViaCctp(message, attestation);
  }

  function test_ReceiveViaCctp_FinalizedHandler() public {
    bytes32 payableId = _createPayableOnA();
    (bytes memory message, bytes memory attestation) = _lastCctp(chainA, CCTP_FINALITY_FINALIZED, 0, false);
    vm.expectEmit(true, true, true, true, address(chainB.cb));
    emit ReceivedPayableUpdateViaCctp(payableId, chainA.cbChainId, 1, CCTP_FINALITY_FINALIZED);
    chainB.cb.receivePayableUpdateViaCctp(message, attestation);
  }

  function test_RevertWhen_ReceiveViaCctp_DestinationDomainMismatch() public {
    // Chain A also sends this same broadcast to chain B (domain 1); delivering it to chain A itself (domain 0)
    // mismatches the destination domain baked into the message.
    _createPayableOnA();
    (bytes memory message, bytes memory attestation) = _lastCctp(chainA, CCTP_FINALITY_FAST, 0, false);
    vm.expectRevert(abi.encodeWithSelector(CircleDestinationDomainMismatch.selector, chainB.circleDomain));
    chainA.cb.receivePayableUpdateViaCctp(message, attestation);
  }

  function test_RevertWhen_ReceiveViaCctp_DataNonceReplay() public {
    _createPayableOnA();
    (bytes memory message, bytes memory attestation) = _lastCctp(chainA, CCTP_FINALITY_FAST, 0, false);
    chainB.cb.receivePayableUpdateViaCctp(message, attestation);
    vm.expectRevert(); // CctpDataNonceAlreadyConsumed(sourceDomain, nonce) — nonce is opaque here.
    chainB.cb.receivePayableUpdateViaCctp(message, attestation);
  }

  function test_RevertWhen_ReceiveViaCctp_CctpNotEnabled() public {
    _createPayableOnA();
    (bytes memory message, bytes memory attestation) = _lastCctp(chainA, CCTP_FINALITY_FAST, 0, false);
    vm.prank(owner);
    chainB.cb.setCctpEnabled(false);
    vm.expectRevert(CctpNotEnabled.selector);
    chainB.cb.receivePayableUpdateViaCctp(message, attestation);
  }

  function test_RevertWhen_ReceiveViaCctp_UnknownDomain() public {
    CctpHeaderFields memory header = CctpHeaderFields({
      sourceDomain: 42,
      destinationDomain: chainB.circleDomain,
      nonce: bytes32(uint256(1)),
      sender: bytes32(uint256(uint160(address(chainA.cb)))),
      recipient: bytes32(uint256(uint160(address(chainB.cb)))),
      destinationCaller: bytes32(0),
      minFinalityThreshold: CCTP_FINALITY_FAST,
      finalityThresholdExecuted: CCTP_FINALITY_FAST
    });
    (bytes memory message, bytes memory attestation) = _buildDataMessage(header, bytes(''));
    vm.expectRevert(abi.encodeWithSelector(UnknownCircleDomain.selector, uint32(42)));
    chainB.cb.receivePayableUpdateViaCctp(message, attestation);
  }

  function test_RevertWhen_ReceiveViaCctp_WrongSender() public {
    bytes32 wrongSender = bytes32(uint256(uint160(makeAddr('wrong-sender'))));
    CctpHeaderFields memory header = CctpHeaderFields({
      sourceDomain: chainA.circleDomain,
      destinationDomain: chainB.circleDomain,
      nonce: bytes32(uint256(2)),
      sender: wrongSender,
      recipient: bytes32(uint256(uint160(address(chainB.cb)))),
      destinationCaller: bytes32(0),
      minFinalityThreshold: CCTP_FINALITY_FAST,
      finalityThresholdExecuted: CCTP_FINALITY_FAST
    });
    (bytes memory message, bytes memory attestation) = _buildDataMessage(header, bytes(''));
    vm.expectRevert(abi.encodeWithSelector(CircleSenderMismatch.selector, wrongSender));
    chainB.cb.receivePayableUpdateViaCctp(message, attestation);
  }

  function test_RevertWhen_ReceiveViaCctp_InsufficientFinality() public {
    CctpHeaderFields memory header = CctpHeaderFields({
      sourceDomain: chainA.circleDomain,
      destinationDomain: chainB.circleDomain,
      nonce: bytes32(uint256(3)),
      sender: bytes32(uint256(uint160(address(chainA.cb)))),
      recipient: bytes32(uint256(uint160(address(chainB.cb)))),
      destinationCaller: bytes32(0),
      minFinalityThreshold: CCTP_FINALITY_FAST,
      finalityThresholdExecuted: 500
    });
    (bytes memory message, bytes memory attestation) = _buildDataMessage(header, bytes(''));
    vm.expectRevert(abi.encodeWithSelector(InsufficientFinality.selector, uint32(500), CCTP_FINALITY_FAST));
    chainB.cb.receivePayableUpdateViaCctp(message, attestation);
  }

  function test_RevertWhen_HandleReceive_CallerNotTransmitter() public {
    vm.expectRevert(CircleTransmitterOnly.selector);
    chainB.cb
      .handleReceiveUnfinalizedMessage(
        chainA.circleDomain, bytes32(uint256(uint160(address(chainA.cb)))), CCTP_FINALITY_FAST, bytes('')
      );
  }

  // ---------------------------------------------------------------------------
  // Cross-protocol consistency
  // ---------------------------------------------------------------------------

  function test_RevertWhen_DuplicateAcrossProtocols_RejectedAsStale() public {
    bytes32 payableId = _createPayableOnA();
    bytes memory vaa = _lastVaa(chainA);
    chainB.cb.receivePayableUpdateViaWormhole(vaa);

    (bytes memory message, bytes memory attestation) = _lastCctp(chainA, CCTP_FINALITY_FAST, 0, false);
    vm.expectRevert(abi.encodeWithSelector(StalePayableUpdateNonce.selector, uint64(1), uint64(1)));
    chainB.cb.receivePayableUpdateViaCctp(message, attestation);
    payableId; // silence unused warning; the ID is asserted implicitly by both deliveries applying to it.
  }

  function test_RevertWhen_OutOfOrderDelivery_RejectedAsStale() public {
    bytes32 payableId = _createPayableOnA();
    vm.prank(host);
    chainA.cb.closePayable{value: WORMHOLE_FEE}(payableId); // nonce 2

    // Deliver the close (nonce 2) first, binding the payable and advancing the nonce.
    (bytes memory closeMessage, bytes memory closeAttestation) = _cctpAt(chainA, 1, CCTP_FINALITY_FAST, 0, false);
    chainB.cb.receivePayableUpdateViaCctp(closeMessage, closeAttestation);

    // The create (nonce 1) arrives late and is rejected as stale.
    (bytes memory createMessage, bytes memory createAttestation) = _cctpAt(chainA, 0, CCTP_FINALITY_FAST, 0, false);
    vm.expectRevert(abi.encodeWithSelector(StalePayableUpdateNonce.selector, uint64(1), uint64(2)));
    chainB.cb.receivePayableUpdateViaCctp(createMessage, createAttestation);
  }

  // ---------------------------------------------------------------------------
  // Admin sync
  // ---------------------------------------------------------------------------

  function test_AdminSyncForeignPayable_AppliesAndEmits() public {
    bytes32 payableId = keccak256('admin-payable');
    TokenAndAmountForeign[] memory list = new TokenAndAmountForeign[](0);
    vm.expectEmit(true, true, true, true, address(chainB.cb));
    emit ReceivedPayableUpdateViaAdminSync(payableId, chainA.cbChainId, 1, owner);
    vm.prank(owner);
    chainB.cb.adminSyncForeignPayable(payableId, chainA.cbChainId, 1, uint64(block.timestamp), 1, false, list);
  }

  function test_AdminSyncForeignPayable_NotPauseGated() public {
    vm.prank(owner);
    chainB.cb.pause();
    bytes32 payableId = keccak256('admin-payable-paused');
    TokenAndAmountForeign[] memory list = new TokenAndAmountForeign[](0);
    vm.prank(owner);
    chainB.cb.adminSyncForeignPayable(payableId, chainA.cbChainId, 1, uint64(block.timestamp), 1, false, list);
  }

  function test_RevertWhen_AdminSync_CallerLacksRole() public {
    TokenAndAmountForeign[] memory list = new TokenAndAmountForeign[](0);
    vm.expectRevert(abi.encodeWithSelector(AccessControlUnauthorizedAccount.selector, stranger, PAYABLE_SYNC_ROLE));
    vm.prank(stranger);
    chainB.cb.adminSyncForeignPayable(keccak256('x'), chainA.cbChainId, 1, uint64(block.timestamp), 1, false, list);
  }

  function test_RevertWhen_AdminSync_ZeroChainId() public {
    TokenAndAmountForeign[] memory list = new TokenAndAmountForeign[](0);
    vm.expectRevert(InvalidChainId.selector);
    vm.prank(owner);
    chainB.cb.adminSyncForeignPayable(keccak256('x'), bytes32(0), 1, uint64(block.timestamp), 1, false, list);
  }

  function test_RevertWhen_AdminSync_OwnChainId() public {
    TokenAndAmountForeign[] memory list = new TokenAndAmountForeign[](0);
    vm.expectRevert(InvalidChainId.selector);
    vm.prank(owner);
    chainB.cb.adminSyncForeignPayable(keccak256('x'), chainB.cbChainId, 1, uint64(block.timestamp), 1, false, list);
  }

  function test_RevertWhen_AdminSync_InvalidActionType() public {
    TokenAndAmountForeign[] memory list = new TokenAndAmountForeign[](0);
    vm.expectRevert(abi.encodeWithSelector(InvalidPayablePayloadActionType.selector, uint8(0)));
    vm.prank(owner);
    chainB.cb.adminSyncForeignPayable(keccak256('x'), chainA.cbChainId, 1, uint64(block.timestamp), 0, false, list);

    vm.expectRevert(abi.encodeWithSelector(InvalidPayablePayloadActionType.selector, uint8(5)));
    vm.prank(owner);
    chainB.cb.adminSyncForeignPayable(keccak256('x'), chainA.cbChainId, 1, uint64(block.timestamp), 5, false, list);
  }

  function test_RevertWhen_AdminSync_StaleNonce() public {
    bytes32 payableId = keccak256('admin-payable-stale');
    TokenAndAmountForeign[] memory list = new TokenAndAmountForeign[](0);
    vm.startPrank(owner);
    chainB.cb.adminSyncForeignPayable(payableId, chainA.cbChainId, 2, uint64(block.timestamp), 1, false, list);
    vm.expectRevert(abi.encodeWithSelector(StalePayableUpdateNonce.selector, uint64(1), uint64(2)));
    chainB.cb.adminSyncForeignPayable(payableId, chainA.cbChainId, 1, uint64(block.timestamp), 1, false, list);
    vm.stopPrank();
  }

  function test_RevertWhen_AdminSync_ChainMismatch() public {
    bytes32 payableId = keccak256('admin-payable-mismatch');
    TokenAndAmountForeign[] memory list = new TokenAndAmountForeign[](0);
    vm.startPrank(owner);
    chainB.cb.adminSyncForeignPayable(payableId, chainA.cbChainId, 1, uint64(block.timestamp), 1, false, list);
    bytes32 otherChainId = keccak256('eip155:999');
    vm.expectRevert(
      abi.encodeWithSelector(ForeignPayableChainMismatch.selector, payableId, chainA.cbChainId, otherChainId)
    );
    chainB.cb.adminSyncForeignPayable(payableId, otherChainId, 2, uint64(block.timestamp), 1, false, list);
    vm.stopPrank();
  }
}
