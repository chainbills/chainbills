// SPDX-License-Identifier: Apache 2
pragma solidity ^0.8.30;

import {console} from 'forge-std/Script.sol';
import {CbAdminScript} from '../base/CbAdminScript.sol';

/// Starts an ownership transfer of `DIAMOND` to `NEW_OWNER`. The transfer completes when `NEW_OWNER` runs
/// `AcceptOwnership`. Set `NEW_OWNER` to the zero address to cancel a pending transfer.
///
/// Required env: `DIAMOND`, `NEW_OWNER`.
contract TransferOwnership is CbAdminScript {
  function run() public {
    address newOwner = vm.envAddress('NEW_OWNER');

    vm.startBroadcast();
    _diamond().transferOwnership(newOwner);
    vm.stopBroadcast();

    console.log('Started ownership transfer to', newOwner);
  }
}
