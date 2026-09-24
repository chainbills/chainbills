// SPDX-License-Identifier: Apache 2
pragma solidity ^0.8.30;

import {LibAccessControl} from '../access/LibAccessControl.sol';
import {LibPause} from '../access/LibPause.sol';
import {LibReentrancyGuard} from '../access/LibReentrancyGuard.sol';
import {ICbErrors} from '../interfaces/ICbErrors.sol';
import {ICbEvents} from '../interfaces/ICbEvents.sol';
import {LibConfigStorage} from '../storage/LibConfigStorage.sol';
import {RELAYER_ROLE} from '../types/CbRoles.sol';

/// Shared modifiers for Chainbills facets. Holds no state.
abstract contract CbFacetBase is ICbErrors, ICbEvents {
  /// Blocks reentry into any guarded function of the diamond.
  modifier nonReentrant() {
    LibReentrancyGuard.enter();
    _;
    LibReentrancyGuard.exit();
  }

  /// Reverts when `feature` is paused globally or individually.
  /// @param feature Feature flag from `CbConstants.sol`.
  modifier whenNotPaused(uint256 feature) {
    LibPause.enforceNotPaused(feature);
    _;
  }

  /// Reverts unless the caller holds `role`.
  /// @param role Role identifier.
  modifier onlyRole(bytes32 role) {
    LibAccessControl.enforceRole(role);
    _;
  }

  /// Reverts when relaying is restricted and the caller lacks `RELAYER_ROLE`.
  modifier onlyPermittedRelayer() {
    if (LibConfigStorage.layout().isRelayerRestricted && !LibAccessControl.hasRole(RELAYER_ROLE, msg.sender)) {
      revert RelayerOnly(msg.sender);
    }
    _;
  }
}
