// SPDX-License-Identifier: Apache 2
pragma solidity ^0.8.30;

import {FEATURE_PAY} from 'src/types/CbConstants.sol';
import {CctpStats, ChainStats, ProtocolConfig, WormholeStats} from 'src/types/CbTypes.sol';
import {CbTestBase} from '../base/CbTestBase.sol';

contract CoreViewsTest is CbTestBase {
  // ---------------------------------------------------------------------------
  // Basics
  // ---------------------------------------------------------------------------

  function test_IsInitialized() public view {
    assertTrue(cb.isInitialized());
  }

  function test_CbChainId() public view {
    assertEq(cb.cbChainId(), chainA.cbChainId);
  }

  function test_NativeToken() public view {
    assertEq(cb.nativeToken(), address(cb));
  }

  // ---------------------------------------------------------------------------
  // Configuration
  // ---------------------------------------------------------------------------

  function test_GetProtocolConfig() public view {
    ProtocolConfig memory config = cb.getProtocolConfig();
    assertEq(config.cbChainId, chainA.cbChainId);
    assertEq(config.feeCollector, feeCollector);
    assertEq(config.withdrawalFeeBps, DEFAULT_FEE_BPS);
    assertEq(config.maxAllowedTokensAndAmounts, DEFAULT_MAX_ALLOWED_TOKENS_AND_AMOUNTS);
    assertFalse(config.isRelayerRestricted);
    assertFalse(config.isPublishPayableRestricted);
  }

  function test_GetProtocolConfig_ReflectsRestrictions() public {
    vm.startPrank(owner);
    cb.setRelayerRestricted(true);
    cb.setPublishPayableRestricted(true);
    vm.stopPrank();

    ProtocolConfig memory config = cb.getProtocolConfig();
    assertTrue(config.isRelayerRestricted);
    assertTrue(config.isPublishPayableRestricted);
  }

  function test_GetWormholeConfig() public view {
    assertEq(cb.getWormholeConfig().wormhole, address(chainA.wormhole));
    assertEq(cb.getWormholeConfig().wormholeChainId, chainA.wormholeChainId);
    assertEq(cb.getWormholeConfig().finality, 1);
    assertTrue(cb.getWormholeConfig().isEnabled);
  }

  function test_GetCctpConfig() public view {
    assertEq(cb.getCctpConfig().tokenMessenger, address(chainA.messenger));
    assertTrue(cb.getCctpConfig().isEnabled);
  }

  function test_HasWormholeAndHasCctp() public view {
    assertTrue(cb.hasWormhole());
    assertTrue(cb.hasCctp());
  }

  function test_HasWormhole_FalseWhenDisabled() public {
    vm.prank(owner);
    cb.setWormholeEnabled(false);
    assertFalse(cb.hasWormhole());
  }

  function test_HasCctp_FalseWhenDisabled() public {
    vm.prank(owner);
    cb.setCctpEnabled(false);
    assertFalse(cb.hasCctp());
  }

  function test_GetWormholeMessageFee() public view {
    assertEq(cb.getWormholeMessageFee(), WORMHOLE_FEE);
  }

  function test_GetWormholeMessageFee_ZeroWhenWormholeDisabled() public {
    vm.prank(owner);
    cb.setWormholeEnabled(false);
    assertEq(cb.getWormholeMessageFee(), 0);
  }

  // ---------------------------------------------------------------------------
  // Stats, empty diamond
  // ---------------------------------------------------------------------------

  function test_GetChainStats_EmptyDiamond() public view {
    assertEq(cb.getChainStats().usersCount, 0);
    assertEq(cb.getChainStats().payablesCount, 0);
    assertEq(cb.getChainStats().foreignPayablesCount, 0);
    assertEq(cb.getChainStats().userPaymentsCount, 0);
    assertEq(cb.getChainStats().payablePaymentsCount, 0);
    assertEq(cb.getChainStats().withdrawalsCount, 0);
    assertEq(cb.getChainStats().activitiesCount, 0);
  }

  function test_GetWormholeStats_EmptyDiamond() public view {
    assertEq(cb.getWormholeStats().publishedWormholeMessagesCount, 0);
    assertEq(cb.getWormholeStats().consumedWormholeMessagesCount, 0);
  }

  function test_GetCctpStats_EmptyDiamond() public view {
    assertEq(cb.getCctpStats().emittedCctpPaymentMessagesCount, 0);
    assertEq(cb.getCctpStats().emittedCctpPayableUpdateMessagesCount, 0);
    assertEq(cb.getCctpStats().receivedCctpPaymentMessagesCount, 0);
    assertEq(cb.getCctpStats().receivedCctpPayableUpdateMessagesCount, 0);
  }

  function test_GetAllStats_MatchesIndividualGetters() public view {
    (ChainStats memory chainStats, WormholeStats memory wormholeStats, CctpStats memory cctpStats) = cb.getAllStats();
    assertEq(chainStats.usersCount, cb.getChainStats().usersCount);
    assertEq(wormholeStats.publishedWormholeMessagesCount, cb.getWormholeStats().publishedWormholeMessagesCount);
    assertEq(cctpStats.emittedCctpPaymentMessagesCount, cb.getCctpStats().emittedCctpPaymentMessagesCount);
  }

  // ---------------------------------------------------------------------------
  // Protocol overview
  // ---------------------------------------------------------------------------

  function test_GetProtocolOverview_EmptyDiamond() public view {
    assertFalse(cb.getProtocolOverview().isPaused);
    assertEq(cb.getProtocolOverview().pausedFeatures, 0);
    assertEq(cb.getProtocolOverview().foreignChainsCount, 0);
    // Native token and USDC are allowed for payments in `setUp`.
    assertEq(cb.getProtocolOverview().registeredTokensCount, 2);
    assertEq(cb.getProtocolOverview().lastPayableUpdateNonce, 0);
  }

  function test_GetProtocolOverview_ReflectsPauseAndRegistry() public {
    vm.startPrank(owner);
    cb.pauseFeatures(FEATURE_PAY);
    vm.stopPrank();
    _setUpChainB();

    assertTrue(cb.getProtocolOverview().pausedFeatures & FEATURE_PAY != 0);
    assertEq(cb.getProtocolOverview().foreignChainsCount, 1);
    assertEq(cb.getProtocolOverview().registeredTokensCount, 2);
    assertEq(cb.getProtocolOverview().lastPayableUpdateNonce, cb.getLastPayableUpdateNonce());
  }

  function test_GetProtocolOverview_ReflectsGlobalPause() public {
    vm.startPrank(owner);
    cb.pause();
    vm.stopPrank();
    assertTrue(cb.getProtocolOverview().isPaused);
  }

  function test_GetProtocolOverview_ChainStatsMatch() public view {
    assertEq(cb.getProtocolOverview().chainStats.usersCount, cb.getChainStats().usersCount);
  }

  function test_GetProtocolOverview_ConfigMatches() public view {
    assertEq(cb.getProtocolOverview().protocol.cbChainId, cb.cbChainId());
    assertEq(cb.getProtocolOverview().wormhole.wormhole, cb.getWormholeConfig().wormhole);
    assertEq(cb.getProtocolOverview().cctp.tokenMessenger, cb.getCctpConfig().tokenMessenger);
  }
}
