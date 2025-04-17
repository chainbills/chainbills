// SPDX-License-Identifier: Apache 2
pragma solidity ^0.8.20;

import 'openzeppelin-foundry-upgrades/Upgrades.sol';
import 'forge-std/Script.sol';
import 'src/Chainbills.sol';

contract UpdateMaxWithdrawalFees is Script {
  function run() public {
    address cbAddr = 0x92e67Bfe49466b18ccDF2A3A28B234AB68374c60;
    address token = cbAddr; // Using contract address for native token
    Chainbills chainbills = Chainbills(payable(cbAddr));
    uint256 maxWithdrawalFees = 1e17; // 0.1 ETH

    uint256 ownerPrivateKey = vm.envUint('PRIVATE_KEY');
    vm.startBroadcast(ownerPrivateKey);

    console.log('Updating Maximum Withdrawal Fees for Token in Chainbills ...');
    console.log('Token: Native ', token);
    chainbills.updateMaxWithdrawalFees(token, maxWithdrawalFees);
    console.log('Successfully Updated Maximum Withdrawal Fees for Token in Chainbills');

    vm.stopBroadcast();
  }
}
