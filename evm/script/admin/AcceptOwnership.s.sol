// SPDX-License-Identifier: Apache 2
pragma solidity ^0.8.30;

import {console} from 'forge-std/Script.sol';
import {CbAdminScript} from '../base/CbAdminScript.sol';

/// Completes a pending ownership transfer of `DIAMOND`. Only the pending owner can call this; the broadcasting
/// key must be theirs.
///
/// Required env: `DIAMOND`.
contract AcceptOwnership is CbAdminScript {
  function run() public {
    vm.startBroadcast();
    _diamond().acceptOwnership();
    vm.stopBroadcast();

    console.log('Accepted ownership of', address(_diamond()));
  }
}
