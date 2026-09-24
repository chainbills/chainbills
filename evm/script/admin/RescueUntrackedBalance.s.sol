// SPDX-License-Identifier: Apache 2
pragma solidity ^0.8.30;

import {console} from 'forge-std/Script.sol';
import {CbAdminScript} from '../base/CbAdminScript.sol';

/// Sends `DIAMOND`'s balance of `TOKEN` above the sum of all payable balances to `TO`.
///
/// Required env: `DIAMOND`, `TOKEN` (token address, or the diamond address for the native token), `TO`.
contract RescueUntrackedBalance is CbAdminScript {
  function run() public {
    address token = vm.envAddress('TOKEN');
    address to = vm.envAddress('TO');

    vm.startBroadcast();
    uint256 amount = _diamond().rescueUntrackedBalance(token, to);
    vm.stopBroadcast();

    console.log('Rescued', amount);
    console.log('of token', token);
    console.log('to', to);
  }
}
