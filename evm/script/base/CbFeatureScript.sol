// SPDX-License-Identifier: Apache 2
pragma solidity ^0.8.30;

import {CbAdminScript} from './CbAdminScript.sol';
import {
  FEATURE_AUTO_WITHDRAW,
  FEATURE_CREATE_PAYABLE,
  FEATURE_PAY,
  FEATURE_PAY_FOREIGN,
  FEATURE_PUBLISH_PAYABLE,
  FEATURE_RECEIVE_FOREIGN_PAYMENT,
  FEATURE_RECEIVE_PAYABLE_UPDATE,
  FEATURE_UPDATE_PAYABLE,
  FEATURE_WITHDRAW
} from '../../src/types/CbConstants.sol';

/// Shared feature-name lookup for `PauseFeatures` and `UnpauseFeatures`.
abstract contract CbFeatureScript is CbAdminScript {
  /// Resolves `names` (each one of the `FEATURE_*` flag names in `CbConstants.sol`, without the `FEATURE_`
  /// prefix, e.g. `"PAY"`, `"PAY_FOREIGN"`) to their bitwise union.
  function _features(string[] memory names) internal pure returns (uint256 features) {
    for (uint256 i; i < names.length; i++) {
      features |= _feature(names[i]);
    }
  }

  function _feature(string memory name) internal pure returns (uint256) {
    bytes32 nameHash = keccak256(bytes(name));
    if (nameHash == keccak256('CREATE_PAYABLE')) return FEATURE_CREATE_PAYABLE;
    if (nameHash == keccak256('UPDATE_PAYABLE')) return FEATURE_UPDATE_PAYABLE;
    if (nameHash == keccak256('PUBLISH_PAYABLE')) return FEATURE_PUBLISH_PAYABLE;
    if (nameHash == keccak256('PAY')) return FEATURE_PAY;
    if (nameHash == keccak256('PAY_FOREIGN')) return FEATURE_PAY_FOREIGN;
    if (nameHash == keccak256('RECEIVE_FOREIGN_PAYMENT')) return FEATURE_RECEIVE_FOREIGN_PAYMENT;
    if (nameHash == keccak256('RECEIVE_PAYABLE_UPDATE')) return FEATURE_RECEIVE_PAYABLE_UPDATE;
    if (nameHash == keccak256('WITHDRAW')) return FEATURE_WITHDRAW;
    if (nameHash == keccak256('AUTO_WITHDRAW')) return FEATURE_AUTO_WITHDRAW;
    revert(string.concat('CbFeatureScript: unknown feature ', name));
  }
}
