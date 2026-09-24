// SPDX-License-Identifier: Apache 2
pragma solidity ^0.8.30;

import {console} from 'forge-std/Script.sol';
import {CbAdminScript} from '../base/CbAdminScript.sol';

/// Maps `FOREIGN_TOKEN` on `FOREIGN_CB_CHAIN_ID` to `LOCAL_TOKEN` on `DIAMOND`, replacing any previous match of
/// either side.
///
/// Required env: `DIAMOND`, `FOREIGN_CB_CHAIN_ID`, `FOREIGN_TOKEN` (32-byte format; loaded by `run.sh` from the
/// target chain's `USDC_ADDRESS`), `LOCAL_TOKEN`.
contract RegisterMatchingToken is CbAdminScript {
  function run() public {
    bytes32 foreignChainId = vm.envBytes32('FOREIGN_CB_CHAIN_ID');
    bytes32 foreignToken = vm.envBytes32('FOREIGN_TOKEN');
    address localToken = vm.envAddress('LOCAL_TOKEN');

    vm.startBroadcast();
    _diamond().registerMatchingToken(foreignChainId, foreignToken, localToken);
    vm.stopBroadcast();

    console.log('Registered matching token', localToken);
  }
}
