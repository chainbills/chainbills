// SPDX-License-Identifier: Apache 2
pragma solidity ^0.8.30;

import {CCTP_FINALITY_FAST} from 'src/types/CbConstants.sol';
import {PopulatedViewsBase} from './PopulatedViewsBase.sol';

/// Replay-protection and nonce views after messages were relayed over both transports in both directions, with one
/// copy of every payable update and one payment burn deliberately left unrelayed.
contract CrossChainViewsPopulatedTest is PopulatedViewsBase {
  // ---------------------------------------------------------------------------
  // Wormhole
  // ---------------------------------------------------------------------------

  function test_IsWormholeMessageConsumed_OnlyRelayedVaas() public view {
    // Chain B nonces 1 (F1 create) and 4 (F2 close) went over Wormhole; 2 and 3 went over CCTP.
    assertTrue(cb.isWormholeMessageConsumed(bVaaHashes[0]));
    assertFalse(cb.isWormholeMessageConsumed(bVaaHashes[1]));
    assertFalse(cb.isWormholeMessageConsumed(bVaaHashes[2]));
    assertTrue(cb.isWormholeMessageConsumed(bVaaHashes[3]));
    // Chain A's own messages are never consumed on chain A.
    for (uint256 i; i < 8; i++) {
      assertFalse(cb.isWormholeMessageConsumed(keccak256(chainA.wormhole.vaaOf(i))));
    }

    // Chain B consumed only P2's creation.
    assertTrue(chainB.cb.isWormholeMessageConsumed(p2CreateVaaHash));
    for (uint256 i; i < 8; i++) {
      if (i == 1) continue;
      assertFalse(chainB.cb.isWormholeMessageConsumed(keccak256(chainA.wormhole.vaaOf(i))));
    }
  }

  function test_ConsumedWormholeMessages_Paginate() public view {
    bytes32[] memory expected = new bytes32[](2);
    expected[0] = bVaaHashes[0];
    expected[1] = bVaaHashes[3];
    assertEq(cb.getConsumedWormholeMessageCount(), 2);
    assertEq(cb.getConsumedWormholeMessageCount(), cb.getWormholeStats().consumedWormholeMessagesCount);
    _checkPages(_consumedVaas, _consumedVaasDesc, bytes32(0), expected, 'consumed vaas');
  }

  function test_ConsumedWormholeMessagesByChain_PaginatePerEmitterChain() public view {
    bytes32[] memory expected = new bytes32[](2);
    expected[0] = bVaaHashes[0];
    expected[1] = bVaaHashes[3];
    bytes32 chainBKey = bytes32(uint256(chainB.wormholeChainId));
    assertEq(cb.getConsumedWormholeMessageCountByChain(chainB.wormholeChainId), 2);
    _checkPages(_consumedVaasByChain, _consumedVaasByChainDesc, chainBKey, expected, 'consumed vaas by chain');

    bytes32 chainAKey = bytes32(uint256(chainA.wormholeChainId));
    assertEq(cb.getConsumedWormholeMessageCountByChain(chainA.wormholeChainId), 0);
    _checkPages(_consumedVaasByChain, _consumedVaasByChainDesc, chainAKey, new bytes32[](0), 'own chain');
    _checkPages(_consumedVaasByChain, _consumedVaasByChainDesc, bytes32(uint256(999)), new bytes32[](0), 'unknown');
  }

  function test_ConsumedWormholeMessages_ChainBListsP2Creation() public view {
    assertEq(chainB.cb.getConsumedWormholeMessageCount(), 1);
    assertEq(chainB.cb.getConsumedWormholeMessages(0, 10)[0], p2CreateVaaHash);
    assertEq(chainB.cb.getConsumedWormholeMessagesDesc(0, 10)[0], p2CreateVaaHash);
    assertEq(chainB.cb.getConsumedWormholeMessageCountByChain(chainA.wormholeChainId), 1);
    assertEq(chainB.cb.getConsumedWormholeMessagesByChain(chainA.wormholeChainId, 0, 1)[0], p2CreateVaaHash);
    assertEq(chainB.cb.getConsumedWormholeMessagesByChain(chainA.wormholeChainId, 1, 1).length, 0);
    assertEq(chainB.cb.getConsumedWormholeMessagesByChain(chainA.wormholeChainId, 0, 0).length, 0);
  }

  function test_ReceivePayableUpdateViaWormhole_StaleVaaLeavesHashUnconsumed() public {
    // F2's creation (nonce 2) was already applied over CCTP and superseded by its close (nonce 4).
    bytes memory vaa = chainB.wormhole.vaaOf(1);
    vm.expectRevert(abi.encodeWithSelector(StalePayableUpdateNonce.selector, 2, 4));
    vm.prank(relayer);
    cb.receivePayableUpdateViaWormhole(vaa);
    assertFalse(cb.isWormholeMessageConsumed(bVaaHashes[1]));
    assertEq(cb.getConsumedWormholeMessageCount(), 2);
  }

  // ---------------------------------------------------------------------------
  // CCTP
  // ---------------------------------------------------------------------------

  function test_IsCctpDataNonceConsumed_OnlyRelayedMessages() public view {
    uint32 domainB = chainB.circleDomain;
    // Chain B nonces 2 (F2 create) and 3 (F1 update) went over CCTP.
    assertFalse(cb.isCctpDataNonceConsumed(domainB, bCctpNonces[0]));
    assertTrue(cb.isCctpDataNonceConsumed(domainB, bCctpNonces[1]));
    assertTrue(cb.isCctpDataNonceConsumed(domainB, bCctpNonces[2]));
    assertFalse(cb.isCctpDataNonceConsumed(domainB, bCctpNonces[3]));
    // The payment burn is tracked as a burn nonce, not a data nonce.
    assertFalse(cb.isCctpDataNonceConsumed(domainB, bCctpNonces[4]));
    // Nonces are keyed by source domain.
    assertFalse(cb.isCctpDataNonceConsumed(chainA.circleDomain, bCctpNonces[1]));

    // Chain B received no data messages.
    for (uint256 i; i < 8; i++) {
      assertFalse(chainB.cb.isCctpDataNonceConsumed(chainA.circleDomain, _cctpNonce(chainA.transmitter.sent(i))));
    }
  }

  function test_IsCctpBurnNonceConsumed_OnlyRelayedBurns() public view {
    assertTrue(cb.isCctpBurnNonceConsumed(chainB.circleDomain, bCctpNonces[4]));
    for (uint256 i; i < 4; i++) {
      assertFalse(cb.isCctpBurnNonceConsumed(chainB.circleDomain, bCctpNonces[i]));
    }
    assertFalse(cb.isCctpBurnNonceConsumed(chainA.circleDomain, bCctpNonces[4]));

    assertTrue(chainB.cb.isCctpBurnNonceConsumed(chainA.circleDomain, relayedBurnNonceA));
    assertFalse(chainB.cb.isCctpBurnNonceConsumed(chainA.circleDomain, unrelayedBurnNonceA));
    // Burns sent by chain A are not consumed on chain A.
    assertFalse(cb.isCctpBurnNonceConsumed(chainA.circleDomain, relayedBurnNonceA));
  }

  function test_IsPaymentNonceConsumed_OnlyRelayedPayments() public view {
    // foreignPayer's first payment arrived on chain A.
    assertTrue(cb.isPaymentNonceConsumed(chainB.cbChainId, _toBytes32(foreignPayer), 1));
    assertFalse(cb.isPaymentNonceConsumed(chainB.cbChainId, _toBytes32(foreignPayer), 2));
    assertFalse(cb.isPaymentNonceConsumed(chainA.cbChainId, _toBytes32(foreignPayer), 1));

    // payer's fourth payment (to F1) arrived on chain B; payer2's fourth never did.
    assertTrue(chainB.cb.isPaymentNonceConsumed(chainA.cbChainId, _toBytes32(payer), 4));
    assertFalse(chainB.cb.isPaymentNonceConsumed(chainA.cbChainId, _toBytes32(payer2), 4));
    // payer's earlier nonces were same-chain payments and never cross chains.
    for (uint64 nonce = 1; nonce < 4; nonce++) {
      assertFalse(chainB.cb.isPaymentNonceConsumed(chainA.cbChainId, _toBytes32(payer), nonce));
    }
    assertFalse(cb.isPaymentNonceConsumed(chainA.cbChainId, _toBytes32(payer), 4));
  }

  function test_ReceiveForeignPaymentViaCctp_LateRelayMarksNoncesAndUpdatesViews() public {
    (bytes memory message, bytes memory attestation) = _cctpAt(chainA, 9, CCTP_FINALITY_FAST, 0, true);
    vm.prank(relayer);
    bytes32 id = chainB.cb.receiveForeignPaymentViaCctp(message, attestation);

    assertTrue(chainB.cb.isCctpBurnNonceConsumed(chainA.circleDomain, unrelayedBurnNonceA));
    assertTrue(chainB.cb.isPaymentNonceConsumed(chainA.cbChainId, _toBytes32(payer2), 4));
    assertEq(chainB.cb.getCctpStats().receivedCctpPaymentMessagesCount, 2);
    assertEq(chainB.cb.getChainPayablePaymentCount(), 2);
    assertEq(chainB.cb.getPayableChainPaymentCount(f1, chainA.cbChainId), 2);
    assertEq(chainB.cb.getPayablePaymentIdsDesc(f1, 0, 1)[0], id);
    assertEq(chainB.cb.getPayablePayment(id).payerPaymentId, up[8]);
    assertEq(chainB.cb.getPayablePayment(id).localChainCount, 2);
    assertEq(chainB.cb.getBalance(f1, address(chainB.usdc)), 150e6);
  }

  function test_ReceivePayableUpdateViaCctp_StaleMessageLeavesNonceUnconsumed() public {
    // F1's creation (nonce 1) was applied over Wormhole and superseded by its update (nonce 3).
    (bytes memory message, bytes memory attestation) = _cctpAt(chainB, 0, CCTP_FINALITY_FAST, 0, false);
    vm.expectRevert(abi.encodeWithSelector(StalePayableUpdateNonce.selector, 1, 3));
    vm.prank(relayer);
    cb.receivePayableUpdateViaCctp(message, attestation);
    assertFalse(cb.isCctpDataNonceConsumed(chainB.circleDomain, bCctpNonces[0]));
    assertEq(cb.getCctpStats().receivedCctpPayableUpdateMessagesCount, 2);
  }

  // ---------------------------------------------------------------------------
  // Update and payment nonces
  // ---------------------------------------------------------------------------

  function test_GetForeignPayableUpdateNonce_TracksLastAppliedUpdate() public view {
    assertEq(cb.getForeignPayableUpdateNonce(f1), 3);
    assertEq(cb.getForeignPayableUpdateNonce(f2), 4);
    // Local and unknown payables have no foreign nonce.
    assertEq(cb.getForeignPayableUpdateNonce(p1), 0);
    assertEq(cb.getForeignPayableUpdateNonce(UNKNOWN_ID), 0);
    // Chain B applied only P2's creation; P2's later close and reopen were never relayed.
    assertEq(chainB.cb.getForeignPayableUpdateNonce(p2), 2);
    assertEq(chainB.cb.getForeignPayableUpdateNonce(f1), 0);
  }

  function test_GetLastPayableUpdateNonce_CountsBroadcasts() public view {
    // Chain A: four creates, close and reopen of P2, update of P1, close of P4.
    assertEq(cb.getLastPayableUpdateNonce(), 8);
    assertEq(cb.getLastPayableUpdateNonce(), cb.getWormholeStats().publishedWormholeMessagesCount);
    assertEq(cb.getLastPayableUpdateNonce(), cb.getCctpStats().emittedCctpPayableUpdateMessagesCount);
    // Chain B: two creates, update of F1, close of F2.
    assertEq(chainB.cb.getLastPayableUpdateNonce(), 4);
  }

  function test_GetLastPayableUpdateNonce_IgnoresAutoWithdrawToggle() public {
    // Auto-withdraw changes are local and broadcast nothing.
    vm.prank(host2);
    cb.updatePayableAutoWithdraw(p3, false);
    assertEq(cb.getLastPayableUpdateNonce(), 8);
  }

  function test_GetNextPaymentNonce_PerPayer() public view {
    assertEq(cb.getNextPaymentNonce(payer), 5);
    assertEq(cb.getNextPaymentNonce(payer2), 5);
    assertEq(cb.getNextPaymentNonce(payer3), 2);
    assertEq(cb.getNextPaymentNonce(host), 1);
    assertEq(cb.getNextPaymentNonce(stranger), 1);
    // Receiving cross-chain payments does not advance a remote payer's nonce here.
    assertEq(cb.getNextPaymentNonce(foreignPayer), 1);
    assertEq(chainB.cb.getNextPaymentNonce(foreignPayer), 2);
    assertEq(chainB.cb.getNextPaymentNonce(payer), 1);
  }

  function test_GetNextPaymentNonce_IsTheNonceTheNextForeignPaymentCarries() public {
    uint64 expected = cb.getNextPaymentNonce(payer);
    vm.prank(payer);
    cb.payForeignViaCctp(f1, address(usdc), 75e6, 0);
    (bytes memory message, bytes memory attestation) = _lastCctp(chainA, CCTP_FINALITY_FAST, 0, true);
    vm.prank(relayer);
    chainB.cb.receiveForeignPaymentViaCctp(message, attestation);
    assertTrue(chainB.cb.isPaymentNonceConsumed(chainA.cbChainId, _toBytes32(payer), expected));
    assertEq(cb.getNextPaymentNonce(payer), expected + 1);
  }
}
