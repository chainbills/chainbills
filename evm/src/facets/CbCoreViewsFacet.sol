// SPDX-License-Identifier: Apache 2
pragma solidity ^0.8.30;

import {EnumerableSet} from '@openzeppelin/contracts/utils/structs/EnumerableSet.sol';
import {ICbCoreViews} from '../interfaces/ICbCoreViews.sol';
import {LibPause} from '../access/LibPause.sol';
import {LibRelayGuard} from '../libraries/LibRelayGuard.sol';
import {LibChainRegistryStorage} from '../storage/LibChainRegistryStorage.sol';
import {LibConfigStorage} from '../storage/LibConfigStorage.sol';
import {LibMessagingStorage} from '../storage/LibMessagingStorage.sol';
import {LibStatsStorage} from '../storage/LibStatsStorage.sol';
import {LibTokenRegistryStorage} from '../storage/LibTokenRegistryStorage.sol';
import {
  CctpConfig,
  CctpStats,
  ChainStats,
  ProtocolConfig,
  ProtocolOverview,
  WormholeConfig,
  WormholeStats
} from '../types/CbTypes.sol';
import {CbFacetBase} from './CbFacetBase.sol';

/// Protocol configuration and statistics.
contract CbCoreViewsFacet is CbFacetBase, ICbCoreViews {
  using EnumerableSet for EnumerableSet.AddressSet;
  using EnumerableSet for EnumerableSet.Bytes32Set;

  /// @inheritdoc ICbCoreViews
  function isInitialized() external view returns (bool) {
    return LibConfigStorage.layout().isInitialized;
  }

  /// @inheritdoc ICbCoreViews
  function cbChainId() external view returns (bytes32) {
    return LibConfigStorage.layout().cbChainId;
  }

  /// @inheritdoc ICbCoreViews
  function nativeToken() external view returns (address) {
    return address(this);
  }

  /// @inheritdoc ICbCoreViews
  function getProtocolConfig() external view returns (ProtocolConfig memory) {
    return _protocolConfig();
  }

  /// @inheritdoc ICbCoreViews
  function getWormholeConfig() external view returns (WormholeConfig memory) {
    return _wormholeConfig();
  }

  /// @inheritdoc ICbCoreViews
  function getCctpConfig() external view returns (CctpConfig memory) {
    return _cctpConfig();
  }

  /// @inheritdoc ICbCoreViews
  function hasWormhole() external view returns (bool) {
    return LibRelayGuard.isWormholeActive();
  }

  /// @inheritdoc ICbCoreViews
  function hasCctp() external view returns (bool) {
    return LibRelayGuard.isCctpActive();
  }

  /// @inheritdoc ICbCoreViews
  function getWormholeMessageFee() external view returns (uint256) {
    return LibRelayGuard.wormholeMessageFee();
  }

  /// @inheritdoc ICbCoreViews
  function getChainStats() external view returns (ChainStats memory) {
    return LibStatsStorage.layout().chainStats;
  }

  /// @inheritdoc ICbCoreViews
  function getWormholeStats() external view returns (WormholeStats memory) {
    return LibMessagingStorage.layout().wormholeStats;
  }

  /// @inheritdoc ICbCoreViews
  function getCctpStats() external view returns (CctpStats memory) {
    return LibMessagingStorage.layout().cctpStats;
  }

  /// @inheritdoc ICbCoreViews
  function getAllStats()
    external
    view
    returns (ChainStats memory chainStats, WormholeStats memory wormholeStats, CctpStats memory cctpStats)
  {
    chainStats = LibStatsStorage.layout().chainStats;
    LibMessagingStorage.Layout storage messaging = LibMessagingStorage.layout();
    wormholeStats = messaging.wormholeStats;
    cctpStats = messaging.cctpStats;
  }

  /// @inheritdoc ICbCoreViews
  function getProtocolOverview() external view returns (ProtocolOverview memory overview) {
    overview.protocol = _protocolConfig();
    overview.wormhole = _wormholeConfig();
    overview.cctp = _cctpConfig();
    overview.chainStats = LibStatsStorage.layout().chainStats;
    LibMessagingStorage.Layout storage messaging = LibMessagingStorage.layout();
    overview.wormholeStats = messaging.wormholeStats;
    overview.cctpStats = messaging.cctpStats;
    LibPause.Layout storage pause = LibPause.layout();
    overview.isPaused = pause.isPaused;
    overview.pausedFeatures = pause.pausedFeatures;
    overview.foreignChainsCount = LibChainRegistryStorage.layout().registeredChainIds.length();
    overview.registeredTokensCount = LibTokenRegistryStorage.layout().registeredTokens.length();
    overview.lastPayableUpdateNonce = messaging.lastPayableUpdateNonce;
  }

  /// Builds the protocol-wide settings from storage.
  function _protocolConfig() private view returns (ProtocolConfig memory) {
    LibConfigStorage.Layout storage $ = LibConfigStorage.layout();
    return ProtocolConfig({
      cbChainId: $.cbChainId,
      feeCollector: $.feeCollector,
      withdrawalFeeBps: $.withdrawalFeeBps,
      maxAllowedTokensAndAmounts: $.maxAllowedTokensAndAmounts,
      isRelayerRestricted: $.isRelayerRestricted,
      isPublishPayableRestricted: $.isPublishPayableRestricted
    });
  }

  /// Builds the Wormhole wiring from storage.
  function _wormholeConfig() private view returns (WormholeConfig memory) {
    LibConfigStorage.Layout storage $ = LibConfigStorage.layout();
    return WormholeConfig({
      wormhole: $.wormhole,
      wormholeChainId: $.wormholeChainId,
      finality: $.wormholeFinality,
      isEnabled: $.isWormholeEnabled
    });
  }

  /// Builds the CCTP wiring from storage.
  function _cctpConfig() private view returns (CctpConfig memory) {
    LibConfigStorage.Layout storage $ = LibConfigStorage.layout();
    return CctpConfig({
      tokenMessenger: $.cctpTokenMessenger,
      messageTransmitter: $.cctpMessageTransmitter,
      tokenMinter: $.cctpTokenMinter,
      domain: $.cctpDomain,
      isEnabled: $.isCctpEnabled
    });
  }
}
