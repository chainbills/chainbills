// SPDX-License-Identifier: Apache 2
pragma solidity ^0.8.30;

import {console} from 'forge-std/Script.sol';
import {CbAdminScript} from '../base/CbAdminScript.sol';

/// Stops new payments in `TOKEN` on `DIAMOND`. Existing balances stay withdrawable.
///
/// Required env: `DIAMOND`, `TOKEN`.
contract StopPaymentsForToken is CbAdminScript {
  function run() public {
    address token = vm.envAddress('TOKEN');

    vm.startBroadcast();
    _diamond().stopPaymentsForToken(token);
    vm.stopBroadcast();

    console.log('Stopped payments for token', token);
  }
}
