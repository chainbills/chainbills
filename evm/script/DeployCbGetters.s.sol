// SPDX-License-Identifier: Apache 2
pragma solidity ^0.8.30;

import {Script, console} from 'forge-std/Script.sol';
import {CbGetters} from '../src/CbGetters.sol';

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
