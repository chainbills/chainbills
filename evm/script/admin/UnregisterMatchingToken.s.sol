// SPDX-License-Identifier: Apache 2
pragma solidity ^0.8.30;

import {console} from 'forge-std/Script.sol';
import {CbAdminScript} from '../base/CbAdminScript.sol';

/// Removes the match of `FOREIGN_TOKEN` on `FOREIGN_CB_CHAIN_ID` on `DIAMOND`.
///
/// Required env: `DIAMOND`, `FOREIGN_CB_CHAIN_ID`, `FOREIGN_TOKEN` (32-byte format).
contract UnregisterMatchingToken is CbAdminScript {
  function run() public {
    bytes32 foreignChainId = vm.envBytes32('FOREIGN_CB_CHAIN_ID');
    bytes32 foreignToken = vm.envBytes32('FOREIGN_TOKEN');

    vm.startBroadcast();
    _diamond().unregisterMatchingToken(foreignChainId, foreignToken);
    vm.stopBroadcast();

    console.log('Unregistered matching token');
    console.logBytes32(foreignToken);
  }
}
