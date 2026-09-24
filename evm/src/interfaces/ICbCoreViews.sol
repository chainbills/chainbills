// SPDX-License-Identifier: Apache 2
pragma solidity ^0.8.30;

import {
  CctpConfig,
  CctpStats,
  ChainStats,
  ProtocolConfig,
  ProtocolOverview,
  WormholeConfig,
  WormholeStats
} from '../types/CbTypes.sol';

/// Protocol configuration and statistics.
interface ICbCoreViews {
  /// Returns whether the diamond initializer ran.
  function isInitialized() external view returns (bool);

  /// Returns the CAIP-2 chain identifier of this chain.
  function cbChainId() external view returns (bytes32);

  /// Returns the address that represents the native token in token fields (the diamond itself).
  function nativeToken() external view returns (address);

  /// Returns the protocol-wide settings.
  function getProtocolConfig() external view returns (ProtocolConfig memory);

  /// Returns the Wormhole wiring.
  function getWormholeConfig() external view returns (WormholeConfig memory);

  /// Returns the CCTP wiring.
  function getCctpConfig() external view returns (CctpConfig memory);

  /// Returns whether Wormhole is configured and enabled.
  function hasWormhole() external view returns (bool);

  /// Returns whether CCTP is configured and enabled.
  function hasCctp() external view returns (bool);

  /// Returns the Wormhole message fee, or zero when Wormhole is not active.
  function getWormholeMessageFee() external view returns (uint256);

  /// Returns the entity counters.
  function getChainStats() external view returns (ChainStats memory);

  /// Returns the Wormhole counters.
  function getWormholeStats() external view returns (WormholeStats memory);

  /// Returns the CCTP counters.
  function getCctpStats() external view returns (CctpStats memory);

  /// Returns all counters in one call.
  function getAllStats()
    external
    view
    returns (ChainStats memory chainStats, WormholeStats memory wormholeStats, CctpStats memory cctpStats);

  /// Returns configuration, counters, and pause state in one call.
  function getProtocolOverview() external view returns (ProtocolOverview memory);
}
