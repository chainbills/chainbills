// SPDX-License-Identifier: Apache 2
pragma solidity ^0.8.30;

import {console} from 'forge-std/Script.sol';
import {CbForeignChainScript} from '../base/CbForeignChainScript.sol';
import {ForeignChainConfig} from '../../src/types/CbTypes.sol';
import {IChainbills} from '../../src/interfaces/IChainbills.sol';

/// Registers the foreign chain named by `TARGET_CHAIN` on `DIAMOND`. See `CbForeignChainScript` for how the
/// configuration is built and which env vars override its defaults.
///
/// Call `register(diamond, foreignChainId, config)` directly (no env reads) from tests or tooling, or call `run()`
/// which reads the required env vars and delegates.
///
/// Required env for `run()`: `DIAMOND`, `TARGET_CHAIN`, `FOREIGN_CB_CHAIN_ID`.
contract RegisterForeignChain is CbForeignChainScript {
  /// Reads env vars and calls `register`.
  function run() public {
    string memory targetChain = vm.envString('TARGET_CHAIN');
    address target = _diamondOf(targetChain);
    bytes32 foreignChainId = vm.envBytes32('FOREIGN_CB_CHAIN_ID');
    ForeignChainConfig memory config = _buildForeignChainConfig(target, _readScriptParams());

    register(vm.envAddress('DIAMOND'), foreignChainId, config);

    console.log('Registered foreign chain', targetChain);
    console.log('target diamond', target);
  }

  /// Registers `foreignChainId` with `config` on `diamond`. No env reads.
  function register(address diamond, bytes32 foreignChainId, ForeignChainConfig memory config) public {
    vm.startBroadcast();
    IChainbills(diamond).registerForeignChain(foreignChainId, config);
    vm.stopBroadcast();
  }
}
