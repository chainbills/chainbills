// SPDX-License-Identifier: Apache 2
pragma solidity ^0.8.30;

import {console} from 'forge-std/Script.sol';
import {CbAdminScript} from '../base/CbAdminScript.sol';

/// Restricts or opens payable republishing on `DIAMOND`.
///
/// Required env: `DIAMOND`, `IS_PUBLISH_PAYABLE_RESTRICTED` (bool; true requires the host or `RELAYER_ROLE`).
contract SetPublishPayableRestricted is CbAdminScript {
  function run() public {
    bool isPublishPayableRestricted = vm.envBool('IS_PUBLISH_PAYABLE_RESTRICTED');

    vm.startBroadcast();
    _diamond().setPublishPayableRestricted(isPublishPayableRestricted);
    vm.stopBroadcast();

    console.log('Set publish payable restricted to', isPublishPayableRestricted);
  }
}
