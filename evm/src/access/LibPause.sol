// SPDX-License-Identifier: Apache 2
pragma solidity ^0.8.30;

import {ICbErrors} from '../interfaces/ICbErrors.sol';
import {ICbEvents} from '../interfaces/ICbEvents.sol';
import {ALL_FEATURES} from '../types/CbConstants.sol';

/// Global and per-feature pause switches.
/// @dev Features are bit flags defined in `CbConstants.sol`. A feature is blocked when the
/// protocol is paused globally or when its bit is set.
library LibPause {
  /// @custom:storage-location erc7201:chainbills.pause
  struct Layout {
    /// Global pause switch.
    bool isPaused;
    /// Bit set of individually paused features.
    uint256 pausedFeatures;
  }

  /// keccak256(abi.encode(uint256(keccak256('chainbills.pause')) - 1)) & ~bytes32(uint256(0xff))
  bytes32 internal constant STORAGE_SLOT = 0xa7f592d2e7ae3a5b3c8e0662d465e99f85a77ad4331b751924155ed2fb91c700;

  /// Returns the pause storage.
  /// @return $ Storage pointer.
  function layout() internal pure returns (Layout storage $) {
    bytes32 slot = STORAGE_SLOT;
    assembly {
      $.slot := slot
    }
  }

  /// Returns whether `feature` is blocked, globally or individually.
  /// @param feature Feature flag.
  /// @return True when blocked.
  function isFeaturePaused(uint256 feature) internal view returns (bool) {
    Layout storage $ = layout();
    return $.isPaused || ($.pausedFeatures & feature) != 0;
  }

  /// Reverts when `feature` is blocked.
  /// @param feature Feature flag.
  function enforceNotPaused(uint256 feature) internal view {
    Layout storage $ = layout();
    if ($.isPaused) revert ICbErrors.EnforcedPause();
    if (($.pausedFeatures & feature) != 0) revert ICbErrors.FeaturePaused(feature);
  }

  /// Pauses the protocol globally.
  function pause() internal {
    Layout storage $ = layout();
    if ($.isPaused) revert ICbErrors.EnforcedPause();
    $.isPaused = true;
    emit ICbEvents.Paused(msg.sender);
  }

  /// Lifts the global pause.
  function unpause() internal {
    Layout storage $ = layout();
    if (!$.isPaused) revert ICbErrors.ExpectedPause();
    $.isPaused = false;
    emit ICbEvents.Unpaused(msg.sender);
  }

  /// Pauses every feature in `features`.
  /// @param features Bit set of feature flags.
  function pauseFeatures(uint256 features) internal {
    _validateFeatures(features);
    Layout storage $ = layout();
    $.pausedFeatures |= features;
    emit ICbEvents.FeaturesPaused(features, $.pausedFeatures, msg.sender);
  }

  /// Unpauses every feature in `features`.
  /// @param features Bit set of feature flags.
  function unpauseFeatures(uint256 features) internal {
    _validateFeatures(features);
    Layout storage $ = layout();
    $.pausedFeatures &= ~features;
    emit ICbEvents.FeaturesUnpaused(features, $.pausedFeatures, msg.sender);
  }

  /// Reverts when `features` is empty or names undefined bits.
  /// @param features Bit set of feature flags.
  function _validateFeatures(uint256 features) private pure {
    if (features == 0 || (features & ~ALL_FEATURES) != 0) revert ICbErrors.InvalidFeatures(features);
  }
}
