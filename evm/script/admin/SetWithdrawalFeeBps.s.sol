// SPDX-License-Identifier: Apache 2
pragma solidity ^0.8.30;

import {console} from 'forge-std/Script.sol';
import {CbAdminScript} from '../base/CbAdminScript.sol';

/// Sets the default withdrawal fee of `DIAMOND`.
///
/// Required env: `DIAMOND`, `WITHDRAWAL_FEE_BPS` (uint16, at most `10_000`).
contract SetWithdrawalFeeBps is CbAdminScript {
  function run() public {
    uint16 feeBps = uint16(vm.envUint('WITHDRAWAL_FEE_BPS'));

    vm.startBroadcast();
    _diamond().setWithdrawalFeeBps(feeBps);
    vm.stopBroadcast();

    console.log('Set withdrawal fee bps to', feeBps);
  }
}
