// SPDX-License-Identifier: Apache 2
pragma solidity ^0.8.20;

import 'openzeppelin-foundry-upgrades/Upgrades.sol';
import 'forge-std/Script.sol';
import 'src/Chainbills.sol';

contract DeployChainbills is Script {
  function run() public {
    address feeCollector = vm.envAddress('FEE_COLLECTOR');
    uint16 feePercent = 200; // 200 is 2%. Zeros are for decimals

    uint256 ownerPrivateKey = vm.envUint('PRIVATE_KEY');
    vm.startBroadcast(ownerPrivateKey);

    address proxy = Upgrades.deployUUPSProxy(
      'Chainbills.sol',
      abi.encodeCall(Chainbills.initialize, (feeCollector, feePercent))
    );

    console.log('Deployed Chainbills at: ', proxy);

    Chainbills cb = Chainbills(payable(proxy));

    cb.setPayablesLogic(address(new CbPayables()));
    console.log('Added Payables Logic to Chainbills');

    cb.setTransactionsLogic(address(new CbTransactions()));
    console.log('Added Transactions Logic to Chainbills');

    vm.stopBroadcast();
  }
}
