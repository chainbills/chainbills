// SPDX-License-Identifier: Apache 2
pragma solidity ^0.8.30;

import {console} from 'forge-std/Script.sol';
import {CbAdminScript} from '../base/CbAdminScript.sol';

/// Unregisters the foreign chain `FOREIGN_CB_CHAIN_ID` on `DIAMOND`. Mirrored payables and nonces are kept.
///
/// Required env: `DIAMOND`, `FOREIGN_CB_CHAIN_ID` (loaded by `run.sh` from `script/env/<target-chain>.env` when a
/// target chain is given).
contract UnregisterForeignChain is CbAdminScript {
  function run() public {
    bytes32 foreignChainId = vm.envBytes32('FOREIGN_CB_CHAIN_ID');

    vm.startBroadcast();
    _diamond().unregisterForeignChain(foreignChainId);
    vm.stopBroadcast();

    console.log('Unregistered foreign chain');
    console.logBytes32(foreignChainId);
  }
}
