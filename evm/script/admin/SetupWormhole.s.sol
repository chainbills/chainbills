// SPDX-License-Identifier: Apache 2
pragma solidity ^0.8.30;

import {console} from 'forge-std/Script.sol';
import {CbAdminScript} from '../base/CbAdminScript.sol';

/// Wires Wormhole and enables it on `DIAMOND`.
///
/// Required env: `DIAMOND`, `WORMHOLE_ADDRESS`, `WORMHOLE_CHAIN_ID` (uint16; must equal the bridge's own
/// `chainId()`), `WORMHOLE_FINALITY` (uint8 consistency level).
contract SetupWormhole is CbAdminScript {
  function run() public {
    address wormhole = vm.envAddress('WORMHOLE_ADDRESS');
    uint16 wormholeChainId = uint16(vm.envUint('WORMHOLE_CHAIN_ID'));
    uint8 finality = uint8(vm.envUint('WORMHOLE_FINALITY'));

    vm.startBroadcast();
    _diamond().setupWormhole(wormhole, wormholeChainId, finality);
    vm.stopBroadcast();

    console.log('Configured Wormhole at', wormhole);
  }
}
