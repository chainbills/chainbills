// SPDX-License-Identifier: Apache 2
pragma solidity ^0.8.30;

import {console} from 'forge-std/Script.sol';
import {CbAdminScript} from '../base/CbAdminScript.sol';

/// Restricts or opens inbound message submission on `DIAMOND`.
///
/// Required env: `DIAMOND`, `IS_RELAYER_RESTRICTED` (bool; true requires `RELAYER_ROLE`).
contract SetRelayerRestricted is CbAdminScript {
  function run() public {
    bool isRelayerRestricted = vm.envBool('IS_RELAYER_RESTRICTED');

    vm.startBroadcast();
    _diamond().setRelayerRestricted(isRelayerRestricted);
    vm.stopBroadcast();

    console.log('Set relayer restricted to', isRelayerRestricted);
  }
}
