// SPDX-License-Identifier: Apache 2
pragma solidity ^0.8.30;

import {EnumerableSet} from '@openzeppelin/contracts/utils/structs/EnumerableSet.sol';
import {ICbChainRegistry} from '../interfaces/ICbChainRegistry.sol';
import {LibChainRegistryStorage} from '../storage/LibChainRegistryStorage.sol';
import {LibConfigStorage} from '../storage/LibConfigStorage.sol';
import {CCTP_FINALITY_FAST, CCTP_FINALITY_FINALIZED, MAX_BPS} from '../types/CbConstants.sol';
import {CHAIN_MANAGER_ROLE} from '../types/CbRoles.sol';
import {
  ForeignChain,
  ForeignChainAddresses,
  ForeignChainConfig,
  ForeignChainFinality,
  ForeignChainLimits,
  ForeignChainProtocolIds,
  ForeignChainSwitches
} from '../types/CbTypes.sol';
import {CbFacetBase} from './CbFacetBase.sol';

/// Foreign chain registration and messaging settings.
/// @dev Every write validates the complete resulting configuration: protocol IDs are unique across chains, each
/// enabled path has the addresses it needs, outbound CCTP finality is 1000 or 2000, and inbound minimums are at most
/// 2000.
contract CbChainRegistryFacet is CbFacetBase, ICbChainRegistry {
  using EnumerableSet for EnumerableSet.Bytes32Set;

  /// @inheritdoc ICbChainRegistry
  function registerForeignChain(bytes32 cbChainId, ForeignChainConfig calldata config)
    external
    onlyRole(CHAIN_MANAGER_ROLE)
  {
    /* CHECKS */
    if (cbChainId == bytes32(0) || cbChainId == LibConfigStorage.layout().cbChainId) revert InvalidChainId();
    LibChainRegistryStorage.Layout storage registry = LibChainRegistryStorage.layout();
    ForeignChain storage chain = registry.chains[cbChainId];
    if (chain.isRegistered) revert ForeignChainAlreadyRegistered(cbChainId);

    /* STATE CHANGES */
    // Clear reverse lookups a previous registration may have left, then store the new configuration.
    _clearReverseLookups(registry, chain.config.protocolIds);
    delete chain.config;
    chain.cbChainId = cbChainId;
    chain.isRegistered = true;
    chain.registeredAt = block.timestamp;
    registry.registeredChainIds.add(cbChainId);
    emit ForeignChainRegistered(cbChainId);
    _store(cbChainId, config);
  }

  /// @inheritdoc ICbChainRegistry
  function updateForeignChain(bytes32 cbChainId, ForeignChainConfig calldata config)
    external
    onlyRole(CHAIN_MANAGER_ROLE)
  {
    _requireRegistered(cbChainId);
    _store(cbChainId, config);
  }

  /// @inheritdoc ICbChainRegistry
  function unregisterForeignChain(bytes32 cbChainId) external onlyRole(CHAIN_MANAGER_ROLE) {
    ForeignChain storage chain = _requireRegistered(cbChainId);
    LibChainRegistryStorage.Layout storage registry = LibChainRegistryStorage.layout();
    _clearReverseLookups(registry, chain.config.protocolIds);
    chain.isRegistered = false;
    registry.registeredChainIds.remove(cbChainId);
    emit ForeignChainUnregistered(cbChainId);
  }

  /// @inheritdoc ICbChainRegistry
  function setForeignChainProtocolIds(bytes32 cbChainId, ForeignChainProtocolIds calldata protocolIds)
    external
    onlyRole(CHAIN_MANAGER_ROLE)
  {
    ForeignChainConfig memory config = _requireRegistered(cbChainId).config;
    config.protocolIds = protocolIds;
    _store(cbChainId, config);
  }

  /// @inheritdoc ICbChainRegistry
  function setForeignChainAddresses(bytes32 cbChainId, ForeignChainAddresses calldata addresses)
    external
    onlyRole(CHAIN_MANAGER_ROLE)
  {
    ForeignChainConfig memory config = _requireRegistered(cbChainId).config;
    config.addresses = addresses;
    _store(cbChainId, config);
  }

  /// @inheritdoc ICbChainRegistry
  function setForeignChainSwitches(bytes32 cbChainId, ForeignChainSwitches calldata switches)
    external
    onlyRole(CHAIN_MANAGER_ROLE)
  {
    ForeignChainConfig memory config = _requireRegistered(cbChainId).config;
    config.switches = switches;
    _store(cbChainId, config);
  }

  /// @inheritdoc ICbChainRegistry
  function setForeignChainFinality(bytes32 cbChainId, ForeignChainFinality calldata finality)
    external
    onlyRole(CHAIN_MANAGER_ROLE)
  {
    ForeignChainConfig memory config = _requireRegistered(cbChainId).config;
    config.finality = finality;
    _store(cbChainId, config);
  }

  /// @inheritdoc ICbChainRegistry
  function setForeignChainLimits(bytes32 cbChainId, ForeignChainLimits calldata limits)
    external
    onlyRole(CHAIN_MANAGER_ROLE)
  {
    ForeignChainConfig memory config = _requireRegistered(cbChainId).config;
    config.limits = limits;
    _store(cbChainId, config);
  }

  // ---------------------------------------------------------------------------
  // Internal helpers
  // ---------------------------------------------------------------------------

  /// Returns the record of a registered chain, reverting when not registered.
  function _requireRegistered(bytes32 cbChainId) private view returns (ForeignChain storage chain) {
    chain = LibChainRegistryStorage.layout().chains[cbChainId];
    if (!chain.isRegistered) revert ForeignChainNotRegistered(cbChainId);
  }

  /// Validates `config` in full, moves reverse lookups to its protocol IDs, stores it, and emits every section.
  function _store(bytes32 cbChainId, ForeignChainConfig memory config) private {
    LibChainRegistryStorage.Layout storage registry = LibChainRegistryStorage.layout();
    ForeignChain storage chain = registry.chains[cbChainId];
    _validate(registry, cbChainId, config);

    // Point the reverse lookups at this chain's new protocol IDs.
    _clearReverseLookups(registry, chain.config.protocolIds);
    if (config.protocolIds.hasWormholeChainId) {
      registry.chainIdByWormholeChainId[config.protocolIds.wormholeChainId] = cbChainId;
    }
    if (config.protocolIds.hasCircleDomain) {
      registry.chainIdByCircleDomain[config.protocolIds.circleDomain] = cbChainId;
    }

    chain.config = config;
    emit ForeignChainProtocolIdsUpdated(cbChainId, config.protocolIds);
    emit ForeignChainAddressesUpdated(cbChainId, config.addresses);
    emit ForeignChainSwitchesUpdated(cbChainId, config.switches);
    emit ForeignChainFinalityUpdated(cbChainId, config.finality);
    emit ForeignChainLimitsUpdated(cbChainId, config.limits);
  }

  /// Removes the reverse lookups of `protocolIds` when they point at a chain.
  function _clearReverseLookups(LibChainRegistryStorage.Layout storage registry, ForeignChainProtocolIds memory ids)
    private
  {
    if (ids.hasWormholeChainId) delete registry.chainIdByWormholeChainId[ids.wormholeChainId];
    if (ids.hasCircleDomain) delete registry.chainIdByCircleDomain[ids.circleDomain];
  }

  /// Reverts when `config` is inconsistent for `cbChainId`.
  function _validate(
    LibChainRegistryStorage.Layout storage registry,
    bytes32 cbChainId,
    ForeignChainConfig memory config
  ) private view {
    ForeignChainProtocolIds memory ids = config.protocolIds;
    ForeignChainAddresses memory addresses = config.addresses;
    ForeignChainSwitches memory switches = config.switches;

    // Protocol IDs must be non-zero where Wormhole requires it and unique across registered chains.
    if (ids.hasWormholeChainId) {
      if (ids.wormholeChainId == 0) revert InvalidChainId();
      bytes32 owner = registry.chainIdByWormholeChainId[ids.wormholeChainId];
      if (owner != bytes32(0) && owner != cbChainId) revert WormholeChainIdTaken(ids.wormholeChainId, owner);
      if (addresses.wormholeEmitter == bytes32(0)) revert InvalidForeignChainAddress();
    }
    if (ids.hasCircleDomain) {
      bytes32 owner = registry.chainIdByCircleDomain[ids.circleDomain];
      if (owner != bytes32(0) && owner != cbChainId) revert CircleDomainTaken(ids.circleDomain, owner);
      if (
        addresses.cctpMessageSender == bytes32(0) || addresses.cctpBurnSender == bytes32(0)
          || addresses.cctpRecipient == bytes32(0) || addresses.cctpMintRecipient == bytes32(0)
      ) revert InvalidForeignChainAddress();
      _validateFinality(config.finality);
    }

    // CCTP-only paths need a Circle domain; inbound updates need at least one protocol.
    if (
      !ids.hasCircleDomain
        && (switches.isCctpUpdateEnabled || switches.isOutboundPaymentEnabled || switches.isInboundPaymentEnabled)
    ) revert InvalidForeignChainAddress();
    if (switches.isInboundUpdateEnabled && !ids.hasCircleDomain && !ids.hasWormholeChainId) {
      revert InvalidForeignChainAddress();
    }

    // The fee cap is a percentage.
    if (config.limits.maxOutboundCctpFeeBps > MAX_BPS) revert InvalidFeeBps(config.limits.maxOutboundCctpFeeBps);
  }

  /// Reverts unless outbound thresholds are 1000 or 2000 and inbound minimums are at most 2000.
  function _validateFinality(ForeignChainFinality memory finality) private pure {
    if (!_isOutboundThreshold(finality.outboundUpdateFinality)) {
      revert InvalidFinalityThreshold(finality.outboundUpdateFinality);
    }
    if (!_isOutboundThreshold(finality.outboundPaymentFinality)) {
      revert InvalidFinalityThreshold(finality.outboundPaymentFinality);
    }
    if (finality.minInboundUpdateFinality > CCTP_FINALITY_FINALIZED) {
      revert InvalidFinalityThreshold(finality.minInboundUpdateFinality);
    }
    if (finality.minInboundPaymentFinality > CCTP_FINALITY_FINALIZED) {
      revert InvalidFinalityThreshold(finality.minInboundPaymentFinality);
    }
  }

  /// Returns whether `threshold` is a CCTP V2 finality level.
  function _isOutboundThreshold(uint32 threshold) private pure returns (bool) {
    return threshold == CCTP_FINALITY_FAST || threshold == CCTP_FINALITY_FINALIZED;
  }
}
