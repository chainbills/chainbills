// SPDX-License-Identifier: Apache 2
pragma solidity ^0.8.30;

import {
  CCTP_FINALITY_FAST,
  FEATURE_AUTO_WITHDRAW,
  FEATURE_RECEIVE_FOREIGN_PAYMENT,
  FEATURE_RECEIVE_PAYABLE_UPDATE
} from 'src/types/CbConstants.sol';
import {
  ForeignChainConfig,
  PayableForeign,
  TokenAndAmount,
  TokenAndAmountForeign,
  TokenStats
} from 'src/types/CbTypes.sol';
import {CbTestBase} from '../base/CbTestBase.sol';

/// End-to-end two-chain scenarios asserted through views and events.
contract TwoChainE2ETest is CbTestBase {
  function setUp() public override {
    super.setUp();
    _setUpChainB();
    vm.deal(host, 10 ether);
    vm.deal(payer, 10 ether);
  }

  // -------------------------------------------------------------------------
  // Scenario 1: Allowed token payable on chain B, paid from chain A with fast
  // finality and a CCTP fee, with auto-withdraw on
  // -------------------------------------------------------------------------

  function test_AllowedTokenPayable_AutoWithdraw_FastFinality_WithCctpFee() public {
    uint256 payAmount = 50e6;
    uint256 maxFee = 5e6;

    // Create a payable on chain B: only USDC at exactly 50e6, auto-withdraw enabled.
    bytes32 pid = _createPayable(chainB, host, _only(address(chainB.usdc), payAmount), true);

    // Mirror the payable on chain A via Wormhole.
    vm.expectEmit(true, true, true, false, address(chainA.cb));
    emit ReceivedPayableUpdateViaWormhole(pid, chainB.cbChainId, 1, bytes32(0));
    chainA.cb.receivePayableUpdateViaWormhole(_lastVaa(chainB));

    // Views: foreign payable is visible on chain A with the correct allowed entry.
    assertTrue(chainA.cb.foreignPayableExists(pid), 'foreign payable should exist on A');
    TokenAndAmountForeign[] memory allowed = chainA.cb.getForeignPayableAllowedTokensAndAmounts(pid);
    assertEq(allowed.length, 1, 'one allowed entry');
    assertEq(allowed[0].token, _toBytes32(address(chainB.usdc)), 'allowed token');
    // forge-lint: disable-next-line(unsafe-typecast)
    assertEq(allowed[0].amount, uint64(payAmount), 'allowed amount');
    assertEq(chainA.cb.getForeignPayableUpdateNonce(pid), 1, 'nonce after create');

    // Pre-flight view: payment should succeed.
    (bool ok,) = chainA.cb.canPayForeign(pid, address(chainA.usdc), payAmount, maxFee);
    assertTrue(ok, 'canPayForeign should succeed');

    _fundUsdc(chainA, payer, 200e6);
    uint256 hostBefore = chainB.usdc.balanceOf(host);
    uint256 collectorBefore = chainB.usdc.balanceOf(feeCollector);

    // Payer sends the cross-chain payment from chain A (amount + maxFee burned).
    vm.expectEmit(true, true, false, true, address(chainA.cb));
    emit SentForeignPaymentViaCctp(pid, chainB.cbChainId, bytes32(0), 1, payAmount + maxFee, maxFee, CCTP_FINALITY_FAST);
    vm.prank(payer);
    chainA.cb.payForeignViaCctp(pid, address(chainA.usdc), payAmount, maxFee);

    // Circle takes the full maxFee, so exactly payAmount is minted on chain B.
    (bytes memory message, bytes memory attestation) = _lastCctp(chainA, CCTP_FINALITY_FAST, maxFee, true);

    uint256 protocolFee = (payAmount * uint256(DEFAULT_FEE_BPS)) / 10_000;

    // Relay the CCTP burn to chain B.
    vm.expectEmit(true, true, false, false, address(chainB.cb));
    emit ReceivedForeignPaymentViaCctp(pid, chainA.cbChainId, bytes32(0), bytes32(0), payAmount, CCTP_FINALITY_FAST);
    vm.prank(relayer);
    chainB.cb.receiveForeignPaymentViaCctp(message, attestation);

    // Auto-withdraw: host and fee collector received their shares immediately.
    assertEq(chainB.usdc.balanceOf(host), hostBefore + payAmount - protocolFee, 'host balance');
    assertEq(chainB.usdc.balanceOf(feeCollector), collectorBefore + protocolFee, 'fee collector balance');
    assertEq(chainB.usdc.balanceOf(address(chainB.cb)), 0, 'diamond holds nothing');

    // Views: payable balance is zero (auto-withdrawn) and token stats reflect the payment.
    assertEq(chainB.cb.getBalance(pid, address(chainB.usdc)), 0, 'payable balance after auto-withdraw');
    TokenStats memory stats = chainB.cb.getTokenStats(address(chainB.usdc));
    assertEq(stats.totalPayableReceived, payAmount, 'totalPayableReceived');
    assertEq(stats.totalPayableBalance, 0, 'totalPayableBalance');
    assertEq(stats.totalWithdrawn, payAmount, 'totalWithdrawn');
    assertEq(stats.totalWithdrawalFeesCollected, protocolFee, 'totalWithdrawalFeesCollected');

    // Payment nonce on chain A advanced.
    assertEq(chainA.cb.getNextPaymentNonce(payer), 2, 'next payment nonce');
  }

  // -------------------------------------------------------------------------
  // Scenario 2: An update delivered over both Wormhole and CCTP, where the
  // second delivery is rejected as stale
  // -------------------------------------------------------------------------

  function test_UpdateDeliveredOverBothProtocols_SecondIsStale() public {
    bytes32 pid = _createPayable(chainA, host, _anyToken(), false);
    bytes memory createVaa = _lastVaa(chainA);
    (bytes memory createCctp, bytes memory createAtt) = _lastCctp(chainA, CCTP_FINALITY_FAST, 0, false);

    // Wormhole delivery succeeds: payable mirrored on chain B, nonce = 1.
    vm.expectEmit(true, true, true, true, address(chainB.cb));
    emit ReceivedPayableUpdateViaWormhole(pid, chainA.cbChainId, 1, keccak256(createVaa));
    chainB.cb.receivePayableUpdateViaWormhole(createVaa);

    assertEq(chainB.cb.getForeignPayableUpdateNonce(pid), 1, 'nonce after Wormhole delivery');
    assertTrue(chainB.cb.foreignPayableExists(pid), 'payable exists on B');

    // CCTP delivery of the same nonce is rejected as stale.
    vm.expectRevert(abi.encodeWithSelector(StalePayableUpdateNonce.selector, uint64(1), uint64(1)));
    chainB.cb.receivePayableUpdateViaCctp(createCctp, createAtt);

    // View: nonce is still 1, state unchanged.
    assertEq(chainB.cb.getForeignPayableUpdateNonce(pid), 1, 'nonce unchanged after stale CCTP');

    // Close the payable on chain A (nonce 2): CCTP delivered first, Wormhole second.
    vm.prank(host);
    chainA.cb.closePayable{value: WORMHOLE_FEE}(pid);
    bytes memory closeVaa = _lastVaa(chainA);
    (bytes memory closeCctp, bytes memory closeAtt) = _lastCctp(chainA, CCTP_FINALITY_FAST, 0, false);

    // CCTP close delivery succeeds (nonce 2 > 1).
    vm.expectEmit(true, true, true, true, address(chainB.cb));
    emit ReceivedPayableUpdateViaCctp(pid, chainA.cbChainId, 2, CCTP_FINALITY_FAST);
    chainB.cb.receivePayableUpdateViaCctp(closeCctp, closeAtt);

    // View: foreign payable is closed.
    PayableForeign memory fp = chainB.cb.getForeignPayable(pid);
    assertTrue(fp.isClosed, 'foreign payable closed after CCTP delivery');
    assertEq(fp.lastUpdateNonce, 2, 'nonce after CCTP close');

    // Wormhole delivery of the close (same nonce 2) is rejected as stale.
    vm.expectRevert(abi.encodeWithSelector(StalePayableUpdateNonce.selector, uint64(2), uint64(2)));
    chainB.cb.receivePayableUpdateViaWormhole(closeVaa);

    // View: state unchanged after stale Wormhole rejection.
    assertEq(chainB.cb.getForeignPayableUpdateNonce(pid), 2, 'nonce unchanged after stale Wormhole');
    assertTrue(chainB.cb.getForeignPayable(pid).isClosed, 'still closed');
  }

  // -------------------------------------------------------------------------
  // Scenario 3: Relayer restriction switched on and off
  // -------------------------------------------------------------------------

  function test_RelayerRestriction_SwitchOnAndOff() public {
    // Initial state: no restriction.
    assertFalse(chainB.cb.getProtocolConfig().isRelayerRestricted, 'initially unrestricted');

    // Create payable 1 on chain A; stranger can deliver while unrestricted.
    bytes32 pid1 = _createPayable(chainA, host, _anyToken(), false);
    bytes memory vaa1 = _lastVaa(chainA);

    vm.expectEmit(true, true, true, false, address(chainB.cb));
    emit ReceivedPayableUpdateViaWormhole(pid1, chainA.cbChainId, 1, bytes32(0));
    vm.prank(stranger);
    chainB.cb.receivePayableUpdateViaWormhole(vaa1);

    assertEq(chainB.cb.getForeignPayableUpdateNonce(pid1), 1, 'pid1 delivered by stranger');

    // Turn restriction on.
    vm.expectEmit(false, false, false, true, address(chainB.cb));
    emit RelayerRestrictionUpdated(true);
    vm.prank(owner);
    chainB.cb.setRelayerRestricted(true);

    assertTrue(chainB.cb.getProtocolConfig().isRelayerRestricted, 'restriction enabled');

    // Create payable 2 on chain A; stranger cannot deliver.
    bytes32 pid2 = _createPayable(chainA, host, _anyToken(), false);
    bytes memory vaa2 = _lastVaa(chainA);

    vm.expectRevert(abi.encodeWithSelector(RelayerOnly.selector, stranger));
    vm.prank(stranger);
    chainB.cb.receivePayableUpdateViaWormhole(vaa2);

    // The designated relayer can still deliver.
    vm.expectEmit(true, true, true, false, address(chainB.cb));
    emit ReceivedPayableUpdateViaWormhole(pid2, chainA.cbChainId, 1, bytes32(0));
    vm.prank(relayer);
    chainB.cb.receivePayableUpdateViaWormhole(vaa2);

    assertEq(chainB.cb.getForeignPayableUpdateNonce(pid2), 2, 'pid2 delivered by relayer');

    // Turn restriction off.
    vm.expectEmit(false, false, false, true, address(chainB.cb));
    emit RelayerRestrictionUpdated(false);
    vm.prank(owner);
    chainB.cb.setRelayerRestricted(false);

    assertFalse(chainB.cb.getProtocolConfig().isRelayerRestricted, 'restriction disabled');

    // Create payable 3 on chain A; stranger can deliver again.
    bytes32 pid3 = _createPayable(chainA, host, _anyToken(), false);
    bytes memory vaa3 = _lastVaa(chainA);

    vm.expectEmit(true, true, true, false, address(chainB.cb));
    emit ReceivedPayableUpdateViaWormhole(pid3, chainA.cbChainId, 1, bytes32(0));
    vm.prank(stranger);
    chainB.cb.receivePayableUpdateViaWormhole(vaa3);

    assertEq(chainB.cb.getForeignPayableUpdateNonce(pid3), 3, 'pid3 delivered by stranger after restriction lifted');
  }

  // -------------------------------------------------------------------------
  // Scenario 4: A pause while a message is in flight, then unpause and deliver
  // -------------------------------------------------------------------------

  function test_PauseWhileMessageInFlight_ThenUnpause_Delivers() public {
    // Create payable on chain B (auto-withdraw off so we can check the balance after delivery).
    bytes32 pid = _createPayable(chainB, host, _anyToken(), false);
    chainA.cb.receivePayableUpdateViaWormhole(_lastVaa(chainB));

    _fundUsdc(chainA, payer, 200e6);

    // Payer initiates cross-chain payment from chain A (CCTP burn is committed).
    vm.prank(payer);
    chainA.cb.payForeignViaCctp(pid, address(chainA.usdc), 100e6, 0);

    (bytes memory message, bytes memory attestation) = _lastCctp(chainA, CCTP_FINALITY_FAST, 0, true);

    // Pause FEATURE_RECEIVE_FOREIGN_PAYMENT on chain B while the message is in flight.
    vm.prank(owner);
    chainB.cb.pauseFeatures(FEATURE_RECEIVE_FOREIGN_PAYMENT);

    // Delivery attempt fails: feature is paused.
    vm.expectRevert(abi.encodeWithSelector(FeaturePaused.selector, FEATURE_RECEIVE_FOREIGN_PAYMENT));
    vm.prank(relayer);
    chainB.cb.receiveForeignPaymentViaCctp(message, attestation);

    // View: payable still has no balance (delivery was rejected).
    assertEq(chainB.cb.getBalance(pid, address(chainB.usdc)), 0, 'no balance while paused');

    // Unpause and deliver: the same message and attestation can now be accepted.
    vm.prank(owner);
    chainB.cb.unpauseFeatures(FEATURE_RECEIVE_FOREIGN_PAYMENT);

    vm.expectEmit(true, true, false, false, address(chainB.cb));
    emit ReceivedForeignPaymentViaCctp(pid, chainA.cbChainId, bytes32(0), bytes32(0), 100e6, CCTP_FINALITY_FAST);
    vm.prank(relayer);
    chainB.cb.receiveForeignPaymentViaCctp(message, attestation);

    // View: payable balance credited (not auto-withdrawn since isAutoWithdraw=false).
    assertEq(chainB.cb.getBalance(pid, address(chainB.usdc)), 100e6, 'balance after delivery');
    assertEq(chainB.usdc.balanceOf(address(chainB.cb)), 100e6, 'diamond holds payment');

    // Token stats reflect the received payment.
    TokenStats memory stats = chainB.cb.getTokenStats(address(chainB.usdc));
    assertEq(stats.totalPayableReceived, 100e6, 'totalPayableReceived');
    assertEq(stats.totalPayableBalance, 100e6, 'totalPayableBalance');
  }

  // -------------------------------------------------------------------------
  // Scenario 5: Unregistering a chain while a message is in flight, then
  // re-registering it and delivering
  // -------------------------------------------------------------------------

  function test_UnregisterChainWhileMessageInFlight_ThenReregister_Delivers() public {
    bytes32 pid = _createPayable(chainB, host, _anyToken(), false);
    chainA.cb.receivePayableUpdateViaWormhole(_lastVaa(chainB));

    _fundUsdc(chainA, payer, 200e6);

    // Payer initiates a cross-chain payment (burn committed on chain A).
    vm.prank(payer);
    chainA.cb.payForeignViaCctp(pid, address(chainA.usdc), 100e6, 0);

    (bytes memory message, bytes memory attestation) = _lastCctp(chainA, CCTP_FINALITY_FAST, 0, true);

    // Chain A is unregistered from chain B while the message is in flight.
    vm.expectEmit(true, false, false, false, address(chainB.cb));
    emit ForeignChainUnregistered(chainA.cbChainId);
    vm.prank(owner);
    chainB.cb.unregisterForeignChain(chainA.cbChainId);

    assertFalse(chainB.cb.isForeignChainRegistered(chainA.cbChainId), 'chain A not registered on B');

    // Delivery fails: Circle domain lookup finds no registered chain.
    vm.expectRevert(abi.encodeWithSelector(UnknownCircleDomain.selector, chainA.circleDomain));
    vm.prank(relayer);
    chainB.cb.receiveForeignPaymentViaCctp(message, attestation);

    // Re-register chain A on chain B with the original configuration.
    bytes32 remoteDiamond = _toBytes32(address(chainA.cb));
    ForeignChainConfig memory config = _defaultForeignChainConfig(chainA, remoteDiamond);
    vm.expectEmit(true, false, false, false, address(chainB.cb));
    emit ForeignChainRegistered(chainA.cbChainId);
    vm.prank(owner);
    chainB.cb.registerForeignChain(chainA.cbChainId, config);

    assertTrue(chainB.cb.isForeignChainRegistered(chainA.cbChainId), 'chain A re-registered on B');

    // The matching token mapping survived unregistration; delivery now succeeds.
    vm.expectEmit(true, true, false, false, address(chainB.cb));
    emit ReceivedForeignPaymentViaCctp(pid, chainA.cbChainId, bytes32(0), bytes32(0), 100e6, CCTP_FINALITY_FAST);
    vm.prank(relayer);
    chainB.cb.receiveForeignPaymentViaCctp(message, attestation);

    assertEq(chainB.cb.getBalance(pid, address(chainB.usdc)), 100e6, 'balance after re-registration delivery');

    // Cross-chain views: CCTP burn nonce is now consumed.
    assertEq(chainB.cb.getTokenStats(address(chainB.usdc)).totalPayableReceived, 100e6);
  }
}
