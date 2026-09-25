// SPDX-License-Identifier: Apache 2
pragma solidity ^0.8.30;

import {FEATURE_PAY, FEATURE_WITHDRAW} from 'src/types/CbConstants.sol';
import {CctpStats, ChainStats, ProtocolOverview, WormholeStats} from 'src/types/CbTypes.sol';
import {PopulatedViewsBase} from './PopulatedViewsBase.sol';

/// Protocol counters and the overview after rich two-chain activity.
contract CoreViewsPopulatedTest is PopulatedViewsBase {
  function test_GetChainStats_CountsEveryEntityOnChainA() public view {
    ChainStats memory stats = cb.getChainStats();
    assertEq(stats.usersCount, 6);
    assertEq(stats.payablesCount, 4);
    assertEq(stats.foreignPayablesCount, 2);
    assertEq(stats.userPaymentsCount, 9);
    assertEq(stats.payablePaymentsCount, 8);
    assertEq(stats.withdrawalsCount, 6);
    assertEq(stats.activitiesCount, 38);
  }

  function test_GetChainStats_AgreesWithListLengths() public view {
    ChainStats memory stats = cb.getChainStats();
    assertEq(stats.usersCount, cb.getChainUserCount());
    assertEq(stats.payablesCount, cb.getChainPayableCount());
    assertEq(stats.foreignPayablesCount, cb.getChainForeignPayableCount());
    assertEq(stats.userPaymentsCount, cb.getChainUserPaymentCount());
    assertEq(stats.payablePaymentsCount, cb.getChainPayablePaymentCount());
    assertEq(stats.withdrawalsCount, cb.getChainWithdrawalCount());
    assertEq(stats.activitiesCount, cb.getChainActivityCount());
  }

  function test_GetChainStats_CountsEveryEntityOnChainB() public view {
    ChainStats memory stats = chainB.cb.getChainStats();
    // foreignHost and foreignPayer.
    assertEq(stats.usersCount, 2);
    // F1 and F2.
    assertEq(stats.payablesCount, 2);
    // P2 mirrored from chain A.
    assertEq(stats.foreignPayablesCount, 1);
    // foreignPayer's payment to P2.
    assertEq(stats.userPaymentsCount, 1);
    // payer's relayed payment to F1; payer2's burn was never relayed.
    assertEq(stats.payablePaymentsCount, 1);
    assertEq(stats.withdrawalsCount, 0);
    // foreignHost: init, two creates, update, close; foreignPayer: init, paid; F1: received.
    assertEq(stats.activitiesCount, 8);
  }

  function test_GetWormholeStats_CountsPublishedAndConsumed() public view {
    WormholeStats memory a = cb.getWormholeStats();
    // Four creates, close and reopen of P2, update of P1, close of P4.
    assertEq(a.publishedWormholeMessagesCount, 8);
    // F1's create and F2's close.
    assertEq(a.consumedWormholeMessagesCount, 2);

    WormholeStats memory b = chainB.cb.getWormholeStats();
    assertEq(b.publishedWormholeMessagesCount, 4);
    assertEq(b.consumedWormholeMessagesCount, 1);
  }

  function test_GetCctpStats_CountsEmittedAndReceived() public view {
    CctpStats memory a = cb.getCctpStats();
    assertEq(a.emittedCctpPaymentMessagesCount, 2);
    // One data message to chain B per broadcast.
    assertEq(a.emittedCctpPayableUpdateMessagesCount, 8);
    assertEq(a.receivedCctpPaymentMessagesCount, 1);
    // F2's create and F1's update.
    assertEq(a.receivedCctpPayableUpdateMessagesCount, 2);

    CctpStats memory b = chainB.cb.getCctpStats();
    assertEq(b.emittedCctpPaymentMessagesCount, 1);
    assertEq(b.emittedCctpPayableUpdateMessagesCount, 4);
    assertEq(b.receivedCctpPaymentMessagesCount, 1);
    assertEq(b.receivedCctpPayableUpdateMessagesCount, 0);
  }

  function test_GetAllStats_AgreesWithIndividualGetters() public view {
    (ChainStats memory chainStats, WormholeStats memory wormholeStats, CctpStats memory cctpStats) = cb.getAllStats();
    assertEq(abi.encode(chainStats), abi.encode(cb.getChainStats()));
    assertEq(abi.encode(wormholeStats), abi.encode(cb.getWormholeStats()));
    assertEq(abi.encode(cctpStats), abi.encode(cb.getCctpStats()));
  }

  function test_GetProtocolOverview_MatchesScenario() public view {
    ProtocolOverview memory overview = cb.getProtocolOverview();

    assertEq(overview.protocol.cbChainId, chainA.cbChainId);
    assertEq(overview.protocol.feeCollector, feeCollector);
    assertEq(overview.protocol.withdrawalFeeBps, DEFAULT_FEE_BPS);
    assertEq(overview.protocol.maxAllowedTokensAndAmounts, DEFAULT_MAX_ALLOWED_TOKENS_AND_AMOUNTS);
    assertFalse(overview.protocol.isRelayerRestricted);
    assertFalse(overview.protocol.isPublishPayableRestricted);

    assertEq(overview.wormhole.wormhole, address(chainA.wormhole));
    assertEq(overview.wormhole.wormholeChainId, chainA.wormholeChainId);
    assertEq(overview.wormhole.finality, 1);
    assertTrue(overview.wormhole.isEnabled);

    assertEq(overview.cctp.tokenMessenger, address(chainA.messenger));
    assertEq(overview.cctp.messageTransmitter, address(chainA.transmitter));
    assertEq(overview.cctp.tokenMinter, address(chainA.minter));
    assertEq(overview.cctp.domain, chainA.circleDomain);
    assertTrue(overview.cctp.isEnabled);

    assertEq(abi.encode(overview.chainStats), abi.encode(cb.getChainStats()));
    assertEq(abi.encode(overview.wormholeStats), abi.encode(cb.getWormholeStats()));
    assertEq(abi.encode(overview.cctpStats), abi.encode(cb.getCctpStats()));
    assertEq(overview.chainStats.activitiesCount, 38);

    assertFalse(overview.isPaused);
    assertEq(overview.pausedFeatures, 0);
    assertEq(overview.foreignChainsCount, 1);
    // Native, USDC, TAX.
    assertEq(overview.registeredTokensCount, 3);
    assertEq(overview.lastPayableUpdateNonce, 8);
  }

  function test_GetProtocolOverview_ChainBMatchesScenario() public view {
    ProtocolOverview memory overview = chainB.cb.getProtocolOverview();
    assertEq(overview.protocol.cbChainId, chainB.cbChainId);
    assertEq(overview.wormhole.wormholeChainId, chainB.wormholeChainId);
    assertEq(overview.cctp.domain, chainB.circleDomain);
    assertEq(overview.foreignChainsCount, 1);
    // Native and USDC.
    assertEq(overview.registeredTokensCount, 2);
    assertEq(overview.lastPayableUpdateNonce, 4);
    assertEq(overview.chainStats.activitiesCount, 8);
  }

  function test_GetProtocolOverview_ReflectsPauseState() public {
    vm.prank(owner);
    cb.pauseFeatures(FEATURE_PAY | FEATURE_WITHDRAW);
    ProtocolOverview memory overview = cb.getProtocolOverview();
    assertFalse(overview.isPaused);
    assertEq(overview.pausedFeatures, FEATURE_PAY | FEATURE_WITHDRAW);

    vm.prank(owner);
    cb.pause();
    overview = cb.getProtocolOverview();
    assertTrue(overview.isPaused);
    assertEq(overview.pausedFeatures, FEATURE_PAY | FEATURE_WITHDRAW);
    // Pausing does not disturb any counter.
    assertEq(overview.chainStats.activitiesCount, 38);
    assertEq(overview.lastPayableUpdateNonce, 8);
  }
}
