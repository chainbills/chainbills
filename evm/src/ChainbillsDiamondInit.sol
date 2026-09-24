// SPDX-License-Identifier: Apache 2
pragma solidity ^0.8.30;

import {IAccessControl} from '@openzeppelin/contracts/access/IAccessControl.sol';
import {IAccessControlEnumerable} from '@openzeppelin/contracts/access/extensions/IAccessControlEnumerable.sol';
import {IERC165} from '@openzeppelin/contracts/utils/introspection/IERC165.sol';
import {LibAccessControl} from './access/LibAccessControl.sol';
import {LibDiamond} from './diamond/LibDiamond.sol';
import {ICbErrors} from './interfaces/ICbErrors.sol';
import {ICbEvents} from './interfaces/ICbEvents.sol';
import {IMessageHandlerV2} from './interfaces/circle/IMessageHandlerV2.sol';
import {IDiamondCut} from './interfaces/diamond/IDiamondCut.sol';
import {IDiamondLoupe} from './interfaces/diamond/IDiamondLoupe.sol';
import {IERC173} from './interfaces/diamond/IERC173.sol';
import {LibConfigStorage} from './storage/LibConfigStorage.sol';
import {MAX_BPS} from './types/CbConstants.sol';
import {
  CHAIN_MANAGER_ROLE,
  CONFIG_MANAGER_ROLE,
  DEFAULT_ADMIN_ROLE,
  FEE_MANAGER_ROLE,
  PAUSER_ROLE,
  PAYABLE_SYNC_ROLE,
  RESCUER_ROLE,
  TOKEN_MANAGER_ROLE,
  UNPAUSER_ROLE
} from './types/CbRoles.sol';

/// One-time initializer run through the first diamond cut.
contract ChainbillsDiamondInit {
  /// Initialization parameters.
  struct InitParams {
    /// CAIP-2 chain identifier of this chain: keccak256("namespace:reference").
    bytes32 cbChainId;
    /// Receives `DEFAULT_ADMIN_ROLE` and every operational role except `RELAYER_ROLE`.
    address admin;
    /// Recipient of withdrawal fees.
    address feeCollector;
    /// Default withdrawal fee in basis points.
    uint16 withdrawalFeeBps;
    /// Maximum number of allowed tokens and amounts per payable.
    uint8 maxAllowedTokensAndAmounts;
  }

  /// Registers supported interfaces, stores the protocol settings, and grants the initial roles.
  /// @param params Initialization parameters.
  function init(InitParams calldata params) external {
    LibConfigStorage.Layout storage config = LibConfigStorage.layout();

    /* CHECKS */
    if (config.isInitialized) revert ICbErrors.AlreadyInitialized();
    if (params.cbChainId == bytes32(0)) revert ICbErrors.InvalidChainId();
    if (params.admin == address(0)) revert ICbErrors.InvalidAddress();
    if (params.feeCollector == address(0)) revert ICbErrors.InvalidFeeCollector();
    if (params.withdrawalFeeBps > MAX_BPS) revert ICbErrors.InvalidFeeBps(params.withdrawalFeeBps);
    if (params.maxAllowedTokensAndAmounts == 0) revert ICbErrors.InvalidMaxAllowedTokensAndAmounts();

    /* STATE CHANGES */
    // Advertise the implemented standard interfaces.
    LibDiamond.Layout storage diamond = LibDiamond.layout();
    diamond.supportedInterfaces[type(IERC165).interfaceId] = true;
    diamond.supportedInterfaces[type(IDiamondCut).interfaceId] = true;
    diamond.supportedInterfaces[type(IDiamondLoupe).interfaceId] = true;
    diamond.supportedInterfaces[type(IERC173).interfaceId] = true;
    diamond.supportedInterfaces[type(IAccessControl).interfaceId] = true;
    diamond.supportedInterfaces[type(IAccessControlEnumerable).interfaceId] = true;
    diamond.supportedInterfaces[type(IMessageHandlerV2).interfaceId] = true;

    // Store the protocol settings.
    config.isInitialized = true;
    config.cbChainId = params.cbChainId;
    config.feeCollector = params.feeCollector;
    config.withdrawalFeeBps = params.withdrawalFeeBps;
    config.maxAllowedTokensAndAmounts = params.maxAllowedTokensAndAmounts;

    // Grant the initial roles.
    LibAccessControl.grantRole(DEFAULT_ADMIN_ROLE, params.admin);
    LibAccessControl.grantRole(CONFIG_MANAGER_ROLE, params.admin);
    LibAccessControl.grantRole(CHAIN_MANAGER_ROLE, params.admin);
    LibAccessControl.grantRole(TOKEN_MANAGER_ROLE, params.admin);
    LibAccessControl.grantRole(FEE_MANAGER_ROLE, params.admin);
    LibAccessControl.grantRole(PAUSER_ROLE, params.admin);
    LibAccessControl.grantRole(UNPAUSER_ROLE, params.admin);
    LibAccessControl.grantRole(PAYABLE_SYNC_ROLE, params.admin);
    LibAccessControl.grantRole(RESCUER_ROLE, params.admin);

    emit ICbEvents.Initialized(params.cbChainId, params.admin);
    emit ICbEvents.FeeCollectorUpdated(params.feeCollector);
    emit ICbEvents.WithdrawalFeeBpsUpdated(params.withdrawalFeeBps);
    emit ICbEvents.MaxAllowedTokensAndAmountsUpdated(params.maxAllowedTokensAndAmounts);
  }
}
