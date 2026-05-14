// SPDX-License-Identifier: Apache 2
pragma solidity ^0.8.30;

import {Script, console} from 'forge-std/Script.sol';
import {Chainbills} from '../src/Chainbills.sol';

contract GrantAdminRole is Script {
  function run() public {
    address cbAddr = vm.envAddress('CB_ADDRESS');
    address adminWallet = vm.envAddress('ADMIN_WALLET');

    if (cbAddr == address(0)) revert('CB_ADDRESS not set');
    if (adminWallet == address(0)) revert('ADMIN_WALLET not set');

    Chainbills cb = Chainbills(payable(cbAddr));

    uint256 ownerPrivateKey = vm.envUint('PRIVATE_KEY');
    vm.startBroadcast(ownerPrivateKey);

    console.log('Granting ADMIN_ROLE to:', adminWallet);
    cb.grantAdminRole(adminWallet);
    console.log('Successfully granted ADMIN_ROLE');

    vm.stopBroadcast();
  }
}
