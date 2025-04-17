// SPDX-License-Identifier: Apache 2
pragma solidity ^0.8.20;

import 'openzeppelin-foundry-upgrades/Upgrades.sol';
import 'forge-std/Script.sol';
import 'src/Chainbills.sol';

contract AllowPaymentsForToken is Script {
  function run() public {
    address cbAddr = 0x92e67Bfe49466b18ccDF2A3A28B234AB68374c60;
    address token = cbAddr; // Using contract address for native token
    Chainbills chainbills = Chainbills(payable(cbAddr));

    uint256 ownerPrivateKey = vm.envUint('PRIVATE_KEY');
    vm.startBroadcast(ownerPrivateKey);

    console.log('Allowing Payments for Token in Chainbills ...');
    console.log('Token: Native ', token);
    chainbills.allowPaymentsForToken(token);
    console.log('Successfully Allowed Payments for Token in Chainbills');

    vm.stopBroadcast();
  }
}
