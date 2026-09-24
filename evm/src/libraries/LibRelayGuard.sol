// SPDX-License-Identifier: Apache 2
pragma solidity ^0.8.30;

import {IWormhole} from 'wormhole/interfaces/IWormhole.sol';
import {ICbErrors} from '../interfaces/ICbErrors.sol';
import {LibChainRegistryStorage} from '../storage/LibChainRegistryStorage.sol';
import {LibConfigStorage} from '../storage/LibConfigStorage.sol';
import {ForeignChain} from '../types/CbTypes.sol';

/// Shared checks on messaging configuration and foreign chains.
library LibRelayGuard {
  /// Reverts unless Wormhole is configured and enabled.
  function enforceWormholeEnabled() internal view {
    LibConfigStorage.Layout storage config = LibConfigStorage.layout();
    if (!config.isWormholeEnabled || config.wormhole == address(0)) revert ICbErrors.WormholeNotEnabled();
  }

  /// Reverts unless CCTP is configured and enabled.
  function enforceCctpEnabled() internal view {
    LibConfigStorage.Layout storage config = LibConfigStorage.layout();
    if (!config.isCctpEnabled || config.cctpMessageTransmitter == address(0)) revert ICbErrors.CctpNotEnabled();
  }

  /// Returns whether Wormhole is configured and enabled.
  /// @return True when active.
  function isWormholeActive() internal view returns (bool) {
    LibConfigStorage.Layout storage config = LibConfigStorage.layout();
    return config.isWormholeEnabled && config.wormhole != address(0);
  }

  /// Returns whether CCTP is configured and enabled.
  /// @return True when active.
  function isCctpActive() internal view returns (bool) {
    LibConfigStorage.Layout storage config = LibConfigStorage.layout();
    return config.isCctpEnabled && config.cctpMessageTransmitter != address(0);
  }

  /// Returns the record of a registered foreign chain. Reverts when not registered.
  /// @param cbChainId CAIP-2 chain identifier.
  /// @return chain Storage pointer to the record.
  function registeredChain(bytes32 cbChainId) internal view returns (ForeignChain storage chain) {
    chain = LibChainRegistryStorage.layout().chains[cbChainId];
    if (!chain.isRegistered) revert ICbErrors.ForeignChainNotRegistered(cbChainId);
  }

  /// Returns the registered foreign chain with Circle domain `circleDomain`. Reverts when unknown.
  /// @param circleDomain Circle domain.
  /// @return cbChainId CAIP-2 chain identifier.
  /// @return chain Storage pointer to the record.
  function chainByCircleDomain(uint32 circleDomain)
    internal
    view
    returns (bytes32 cbChainId, ForeignChain storage chain)
  {
    LibChainRegistryStorage.Layout storage registry = LibChainRegistryStorage.layout();
    cbChainId = registry.chainIdByCircleDomain[circleDomain];
    chain = registry.chains[cbChainId];
    if (
      cbChainId == bytes32(0) || !chain.isRegistered || !chain.config.protocolIds.hasCircleDomain
        || chain.config.protocolIds.circleDomain != circleDomain
    ) revert ICbErrors.UnknownCircleDomain(circleDomain);
  }

  /// Returns the registered foreign chain with Wormhole chain ID `wormholeChainId`. Reverts when unknown.
  /// @param wormholeChainId Wormhole chain ID.
  /// @return cbChainId CAIP-2 chain identifier.
  /// @return chain Storage pointer to the record.
  function chainByWormholeChainId(uint16 wormholeChainId)
    internal
    view
    returns (bytes32 cbChainId, ForeignChain storage chain)
  {
    LibChainRegistryStorage.Layout storage registry = LibChainRegistryStorage.layout();
    cbChainId = registry.chainIdByWormholeChainId[wormholeChainId];
    chain = registry.chains[cbChainId];
    if (
      cbChainId == bytes32(0) || !chain.isRegistered || !chain.config.protocolIds.hasWormholeChainId
        || chain.config.protocolIds.wormholeChainId != wormholeChainId
    ) revert ICbErrors.UnknownWormholeChain(wormholeChainId);
  }

  /// Returns the Wormhole message fee, or zero when Wormhole is not active.
  /// @return Fee in native wei.
  function wormholeMessageFee() internal view returns (uint256) {
    if (!isWormholeActive()) return 0;
    return IWormhole(LibConfigStorage.layout().wormhole).messageFee();
  }

  /// Reverts unless `msg.value` equals the Wormhole message fee (zero when Wormhole is not active).
  /// @return fee Fee to forward to Wormhole.
  function enforceExactBroadcastFee() internal view returns (uint256 fee) {
    fee = wormholeMessageFee();
    if (msg.value != fee) revert ICbErrors.IncorrectWormholeFee(msg.value, fee);
  }
}
