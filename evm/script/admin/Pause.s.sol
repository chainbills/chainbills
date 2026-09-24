// SPDX-License-Identifier: Apache 2
pragma solidity ^0.8.30;

import {console} from 'forge-std/Script.sol';
import {CbAdminScript} from '../base/CbAdminScript.sol';

/// Pauses every feature of `DIAMOND`.
///
/// Required env: `DIAMOND`.
contract Pause is CbAdminScript {
  function run() public {
    vm.startBroadcast();
    _diamond().pause();
    vm.stopBroadcast();

    console.log('Paused', address(_diamond()));
  }
}
