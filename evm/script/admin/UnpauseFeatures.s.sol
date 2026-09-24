// SPDX-License-Identifier: Apache 2
pragma solidity ^0.8.30;

import {console} from 'forge-std/Script.sol';
import {CbFeatureScript} from '../base/CbFeatureScript.sol';

/// Unpauses `FEATURE_NAMES` on `DIAMOND`.
///
/// Required env: `DIAMOND`, `FEATURE_NAMES` (comma-separated `FEATURE_*` names from `CbConstants.sol` without the
/// `FEATURE_` prefix, e.g. `"PAY,PAY_FOREIGN"`).
contract UnpauseFeatures is CbFeatureScript {
  function run() public {
    string[] memory names = vm.envString('FEATURE_NAMES', ',');
    uint256 features = _features(names);

    vm.startBroadcast();
    _diamond().unpauseFeatures(features);
    vm.stopBroadcast();

    console.log('Unpaused features', features);
  }
}
