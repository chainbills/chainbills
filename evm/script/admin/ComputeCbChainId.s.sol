// SPDX-License-Identifier: Apache 2
pragma solidity ^0.8.30;

import {Script, console} from 'forge-std/Script.sol';

/// Prints `keccak256(CAIP2)`, the `cbChainId` a chain identifies itself by. Reads no diamond and broadcasts
/// nothing.
///
/// Required env: `CAIP2` (e.g. `"eip155:5042"`).
contract ComputeCbChainId is Script {
  function run() public view {
    string memory caip2 = vm.envString('CAIP2');
    bytes32 cbChainId = keccak256(bytes(caip2));
    console.log('CAIP2', caip2);
    console.logBytes32(cbChainId);
  }
}
