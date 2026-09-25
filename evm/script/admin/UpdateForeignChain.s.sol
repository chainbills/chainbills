// SPDX-License-Identifier: Apache 2
pragma solidity ^0.8.30;

import {console} from 'forge-std/Script.sol';
import {CbForeignChainScript} from '../base/CbForeignChainScript.sol';
import {ForeignChainConfig} from '../../src/types/CbTypes.sol';
import {IChainbills} from '../../src/interfaces/IChainbills.sol';

/// Replaces the full configuration of the already-registered foreign chain named by `TARGET_CHAIN` on `DIAMOND`.
/// See `CbForeignChainScript` for how the configuration is built and which env vars override its defaults.
///
/// Call `update(diamond, foreignChainId, config)` directly (no env reads) from tests or tooling, or call `run()`
/// which reads the required env vars and delegates.
///
/// Required env for `run()`: `DIAMOND`, `TARGET_CHAIN`, `FOREIGN_CB_CHAIN_ID`.
contract UpdateForeignChain is CbForeignChainScript {
  /// Reads env vars and calls `update`.
  function run() public {
    string memory targetChain = vm.envString('TARGET_CHAIN');
    address target = _diamondOf(targetChain);
    bytes32 foreignChainId = vm.envBytes32('FOREIGN_CB_CHAIN_ID');
    ForeignChainConfig memory config = _buildForeignChainConfig(target, _readScriptParams());

    update(vm.envAddress('DIAMOND'), foreignChainId, config);

    console.log('Updated foreign chain', targetChain);
    console.log('target diamond', target);
  }

  /// Replaces the config for `foreignChainId` on `diamond`. No env reads.
  function update(address diamond, bytes32 foreignChainId, ForeignChainConfig memory config) public {
    vm.startBroadcast();
    IChainbills(diamond).updateForeignChain(foreignChainId, config);
    vm.stopBroadcast();
  }
}
