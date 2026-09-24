// SPDX-License-Identifier: Apache 2
pragma solidity ^0.8.30;

import {console} from 'forge-std/Script.sol';
import {CbAdminScript} from '../base/CbAdminScript.sol';

/// Wires CCTP V2 from `TOKEN_MESSENGER` and enables it on `DIAMOND`. Transmitter, minter, and domain are read from
/// Circle.
///
/// Required env: `DIAMOND`, `TOKEN_MESSENGER`.
contract SetupCctp is CbAdminScript {
  function run() public {
    address tokenMessenger = vm.envAddress('TOKEN_MESSENGER');

    vm.startBroadcast();
    _diamond().setupCctp(tokenMessenger);
    vm.stopBroadcast();

    console.log('Configured CCTP with TokenMessenger', tokenMessenger);
  }
}
