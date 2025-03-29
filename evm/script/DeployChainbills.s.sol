// SPDX-License-Identifier: Apache 2
pragma solidity ^0.8.20;

import 'openzeppelin-foundry-upgrades/Upgrades.sol';
import 'src/Chainbills.sol';
import 'forge-std/Script.sol';

contract DeployChainbills is Script {
  function run() public {
    // TODO: Update these values when deploying to another EVM chain.

    // The wallet address into which withdrawal fees are paid.
    address feeCollector = vm.envAddress('FEE_COLLECTOR');
    // The address of the Wormhole Core Contract on Sepolia
    address wormhole = 0x4a8bc80Ed5a4067f1CCf107057b8270E0cC11A78;
    // The address of the Circle Bridge Contract on Sepolia
    address circleBridge = 0x9f3B8679c73C2Fef8b59B4f3444d4e156fb70AA5;
    // The chain ID of Sepolia
    uint16 chainId = 10002;
    // Finality for Wormhole Messages. 200 for Instant, 201 for Finalized.
    uint8 wormholeFinality = 200;

    uint256 ownerPrivateKey = vm.envUint('PRIVATE_KEY');
    vm.startBroadcast(ownerPrivateKey);

    address proxy = Upgrades.deployUUPSProxy(
      'Chainbills.sol', abi.encodeCall(Chainbills.initialize, (feeCollector))
    );

    console.log('Deployed Chainbills at: ', proxy);

    Chainbills cb = Chainbills(payable(proxy));
    cb.setupWormholeAndCircle(wormhole, circleBridge, chainId, wormholeFinality);
    console.log('Setup Wormhole and circle');

    cb.setPayablesLogic(address(new CbPayables()));
    console.log('Added Payables Logic to Chainbills');

    cb.setTransactionsLogic(address(new CbTransactions()));
    console.log('Added Transactions Logic to Chainbills');

    vm.stopBroadcast();
  }
}
