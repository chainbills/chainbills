// SPDX-License-Identifier: Apache 2
pragma solidity ^0.8.30;

import {console} from 'forge-std/Script.sol';
import {CbAdminScript} from '../base/CbAdminScript.sol';

/// Lifts the global pause on `DIAMOND`.
///
/// Required env: `DIAMOND`.
contract Unpause is CbAdminScript {
  function run() public {
    vm.startBroadcast();
    _diamond().unpause();
    vm.stopBroadcast();

    console.log('Unpaused', address(_diamond()));
  }
}
