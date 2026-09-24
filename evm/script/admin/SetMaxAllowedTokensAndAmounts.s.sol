// SPDX-License-Identifier: Apache 2
pragma solidity ^0.8.30;

import {console} from 'forge-std/Script.sol';
import {CbAdminScript} from '../base/CbAdminScript.sol';

/// Sets the maximum number of allowed tokens and amounts per payable on `DIAMOND`.
///
/// Required env: `DIAMOND`, `MAX_ALLOWED_TOKENS_AND_AMOUNTS` (uint8, at least `1`).
contract SetMaxAllowedTokensAndAmounts is CbAdminScript {
  function run() public {
    uint8 max = uint8(vm.envUint('MAX_ALLOWED_TOKENS_AND_AMOUNTS'));

    vm.startBroadcast();
    _diamond().setMaxAllowedTokensAndAmounts(max);
    vm.stopBroadcast();

    console.log('Set max allowed tokens and amounts to', max);
  }
}
