// SPDX-License-Identifier: Apache 2
pragma solidity ^0.8.30;

import {console} from 'forge-std/Script.sol';
import {CbForeignChainScript} from '../base/CbForeignChainScript.sol';
import {ForeignChainConfig} from '../../src/types/CbTypes.sol';

/// Replaces the full configuration of the already-registered foreign chain named by `TARGET_CHAIN` on `DIAMOND`.
/// See `CbForeignChainScript` for how the configuration is built and which env vars override its defaults.
///
/// Required env: `DIAMOND`, `TARGET_CHAIN`, `FOREIGN_CB_CHAIN_ID` (loaded by `run.sh` from
/// `script/env/<TARGET_CHAIN>.env`).
contract UpdateForeignChain is CbForeignChainScript {
  function run() public {
    string memory targetChain = vm.envString('TARGET_CHAIN');
    address target = _diamondOf(targetChain);
    bytes32 foreignChainId = vm.envBytes32('FOREIGN_CB_CHAIN_ID');
    ForeignChainConfig memory config = _buildForeignChainConfig(target);

    vm.startBroadcast();
    _diamond().updateForeignChain(foreignChainId, config);
    vm.stopBroadcast();

    console.log('Updated foreign chain', targetChain);
    console.log('target diamond', target);
  }
}
