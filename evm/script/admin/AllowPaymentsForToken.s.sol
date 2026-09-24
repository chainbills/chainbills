// SPDX-License-Identifier: Apache 2
pragma solidity ^0.8.30;

import {console} from 'forge-std/Script.sol';
import {CbAdminScript} from '../base/CbAdminScript.sol';

/// Allows payments in `TOKEN` on `DIAMOND`.
///
/// Required env: `DIAMOND`, `TOKEN` (token address, or the diamond address for the native token).
contract AllowPaymentsForToken is CbAdminScript {
  function run() public {
    address token = vm.envAddress('TOKEN');

    vm.startBroadcast();
    _diamond().allowPaymentsForToken(token);
    vm.stopBroadcast();

    console.log('Allowed payments for token', token);
  }
}
