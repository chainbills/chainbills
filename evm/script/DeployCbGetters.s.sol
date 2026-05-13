// SPDX-License-Identifier: Apache 2
pragma solidity ^0.8.20;

import 'forge-std/Script.sol';
import '../src/CbGetters.sol';

contract DeployCbGetters is Script {
  function run() public {
    address cb = vm.envAddress('CB_ADDRESS');

    uint256 ownerPrivateKey = vm.envUint('PRIVATE_KEY');
    vm.startBroadcast(ownerPrivateKey);

    address getters = address(new CbGetters(cb));
    console.log('Deployed CbGetters at: ', getters);

    vm.stopBroadcast();
  }
}
