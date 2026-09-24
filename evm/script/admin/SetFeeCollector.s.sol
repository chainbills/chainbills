// SPDX-License-Identifier: Apache 2
pragma solidity ^0.8.30;

import {console} from 'forge-std/Script.sol';
import {CbAdminScript} from '../base/CbAdminScript.sol';

/// Sets the recipient of withdrawal fees on `DIAMOND`.
///
/// Required env: `DIAMOND`, `FEE_COLLECTOR`.
contract SetFeeCollector is CbAdminScript {
  function run() public {
    address feeCollector = vm.envAddress('FEE_COLLECTOR');

    vm.startBroadcast();
    _diamond().setFeeCollector(feeCollector);
    vm.stopBroadcast();

    console.log('Set fee collector to', feeCollector);
  }
}
