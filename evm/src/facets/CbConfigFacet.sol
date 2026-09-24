// SPDX-License-Identifier: Apache 2
pragma solidity ^0.8.30;

import {IWormhole} from 'wormhole/interfaces/IWormhole.sol';
import {ICbConfig} from '../interfaces/ICbConfig.sol';
import {IMessageTransmitterV2} from '../interfaces/circle/IMessageTransmitterV2.sol';
import {ITokenMessengerV2} from '../interfaces/circle/ITokenMessengerV2.sol';
import {LibConfigStorage} from '../storage/LibConfigStorage.sol';
import {MAX_BPS} from '../types/CbConstants.sol';
import {CONFIG_MANAGER_ROLE, FEE_MANAGER_ROLE} from '../types/CbRoles.sol';
import {CbFacetBase} from './CbFacetBase.sol';

/// Protocol-wide settings and messaging wiring.
contract CbConfigFacet is CbFacetBase, ICbConfig {
  /// @inheritdoc ICbConfig
  function setFeeCollector(address feeCollector) external onlyRole(FEE_MANAGER_ROLE) {
    if (feeCollector == address(0)) revert InvalidFeeCollector();
    LibConfigStorage.layout().feeCollector = feeCollector;
    emit FeeCollectorUpdated(feeCollector);
  }

  /// @inheritdoc ICbConfig
  function setWithdrawalFeeBps(uint16 feeBps) external onlyRole(FEE_MANAGER_ROLE) {
    if (feeBps > MAX_BPS) revert InvalidFeeBps(feeBps);
    LibConfigStorage.layout().withdrawalFeeBps = feeBps;
    emit WithdrawalFeeBpsUpdated(feeBps);
  }

  /// @inheritdoc ICbConfig
  function setMaxAllowedTokensAndAmounts(uint8 maxAllowedTokensAndAmounts) external onlyRole(CONFIG_MANAGER_ROLE) {
    if (maxAllowedTokensAndAmounts == 0) revert InvalidMaxAllowedTokensAndAmounts();
    LibConfigStorage.layout().maxAllowedTokensAndAmounts = maxAllowedTokensAndAmounts;
    emit MaxAllowedTokensAndAmountsUpdated(maxAllowedTokensAndAmounts);
  }

  /// @inheritdoc ICbConfig
  function setRelayerRestricted(bool isRelayerRestricted) external onlyRole(CONFIG_MANAGER_ROLE) {
    LibConfigStorage.layout().isRelayerRestricted = isRelayerRestricted;
    emit RelayerRestrictionUpdated(isRelayerRestricted);
  }

  /// @inheritdoc ICbConfig
  function setPublishPayableRestricted(bool isPublishPayableRestricted) external onlyRole(CONFIG_MANAGER_ROLE) {
    LibConfigStorage.layout().isPublishPayableRestricted = isPublishPayableRestricted;
    emit PublishPayableRestrictionUpdated(isPublishPayableRestricted);
  }

  /// @inheritdoc ICbConfig
  function setupWormhole(address wormhole, uint16 wormholeChainId, uint8 finality)
    external
    onlyRole(CONFIG_MANAGER_ROLE)
  {
    /* CHECKS */
    // Require a deployed core bridge that reports the given chain ID, and a non-zero consistency level.
    if (wormhole.code.length == 0 || wormholeChainId == 0 || finality == 0) revert InvalidWormholeConfig();
    if (IWormhole(wormhole).chainId() != wormholeChainId) revert InvalidWormholeConfig();

    /* STATE CHANGES */
    LibConfigStorage.Layout storage config = LibConfigStorage.layout();
    config.wormhole = wormhole;
    config.wormholeChainId = wormholeChainId;
    config.wormholeFinality = finality;
    config.isWormholeEnabled = true;
    emit WormholeConfigured(wormhole, wormholeChainId, finality);
    emit WormholeEnabledUpdated(true);
  }

  /// @inheritdoc ICbConfig
  function setWormholeEnabled(bool isEnabled) external onlyRole(CONFIG_MANAGER_ROLE) {
    LibConfigStorage.Layout storage config = LibConfigStorage.layout();
    if (isEnabled && config.wormhole == address(0)) revert WormholeNotEnabled();
    config.isWormholeEnabled = isEnabled;
    emit WormholeEnabledUpdated(isEnabled);
  }

  /// @inheritdoc ICbConfig
  function setWormholeFinality(uint8 finality) external onlyRole(CONFIG_MANAGER_ROLE) {
    if (finality == 0) revert InvalidWormholeConfig();
    LibConfigStorage.layout().wormholeFinality = finality;
    emit WormholeFinalityUpdated(finality);
  }

  /// @inheritdoc ICbConfig
  function setupCctp(address tokenMessenger) external onlyRole(CONFIG_MANAGER_ROLE) {
    /* CHECKS */
    // Read the transmitter, minter, and domain from Circle's own wiring.
    if (tokenMessenger.code.length == 0) revert InvalidCctpConfig();
    address messageTransmitter = ITokenMessengerV2(tokenMessenger).localMessageTransmitter();
    address tokenMinter = ITokenMessengerV2(tokenMessenger).localMinter();
    if (messageTransmitter.code.length == 0 || tokenMinter.code.length == 0) revert InvalidCctpConfig();
    uint32 domain = IMessageTransmitterV2(messageTransmitter).localDomain();

    /* STATE CHANGES */
    LibConfigStorage.Layout storage config = LibConfigStorage.layout();
    config.cctpTokenMessenger = tokenMessenger;
    config.cctpMessageTransmitter = messageTransmitter;
    config.cctpTokenMinter = tokenMinter;
    config.cctpDomain = domain;
    config.isCctpEnabled = true;
    emit CctpConfigured(tokenMessenger, messageTransmitter, tokenMinter, domain);
    emit CctpEnabledUpdated(true);
  }

  /// @inheritdoc ICbConfig
  function setCctpEnabled(bool isEnabled) external onlyRole(CONFIG_MANAGER_ROLE) {
    LibConfigStorage.Layout storage config = LibConfigStorage.layout();
    if (isEnabled && config.cctpMessageTransmitter == address(0)) revert CctpNotEnabled();
    config.isCctpEnabled = isEnabled;
    emit CctpEnabledUpdated(isEnabled);
  }
}
