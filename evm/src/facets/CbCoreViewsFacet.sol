// SPDX-License-Identifier: Apache 2
pragma solidity ^0.8.30;

import {ICbCoreViews} from '../interfaces/ICbCoreViews.sol';
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

contract CbCoreViewsFacet is CbFacetBase, ICbCoreViews {
  function isInitialized() external view returns (bool) {
    revert('unimplemented');
  }

  function cbChainId() external view returns (bytes32) {
    revert('unimplemented');
  }

  function nativeToken() external view returns (address) {
    revert('unimplemented');
  }

  function getProtocolConfig() external view returns (ProtocolConfig memory) {
    revert('unimplemented');
  }

  function getWormholeConfig() external view returns (WormholeConfig memory) {
    revert('unimplemented');
  }

  function getCctpConfig() external view returns (CctpConfig memory) {
    revert('unimplemented');
  }

  function hasWormhole() external view returns (bool) {
    revert('unimplemented');
  }

  function hasCctp() external view returns (bool) {
    revert('unimplemented');
  }

  function getWormholeMessageFee() external view returns (uint256) {
    revert('unimplemented');
  }

  function getChainStats() external view returns (ChainStats memory) {
    revert('unimplemented');
  }

  function getWormholeStats() external view returns (WormholeStats memory) {
    revert('unimplemented');
  }

  function getCctpStats() external view returns (CctpStats memory) {
    revert('unimplemented');
  }

  function getAllStats()
    external
    view
    returns (ChainStats memory chainStats, WormholeStats memory wormholeStats, CctpStats memory cctpStats)
  {
    revert('unimplemented');
  }

  function getProtocolOverview() external view returns (ProtocolOverview memory) {
    revert('unimplemented');
  }
}
