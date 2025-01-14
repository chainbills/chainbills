// SPDX-License-Identifier: Unlicense
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
    // The chain ID of Sepolia
    uint16 chainId = 10002;
    // Finality for Wormhole Messages. 200 for Instant, 201 for Finalized.
    uint8 wormholeFinality = 200;

    uint256 ownerPrivateKey = vm.envUint('PRIVATE_KEY');
    vm.startBroadcast(ownerPrivateKey);

    address proxy = Upgrades.deployUUPSProxy(
      'Chainbills.sol',
      abi.encodeCall(
        Chainbills.initialize,
        (feeCollector, wormhole, chainId, wormholeFinality)
      )
    );

    console.log('Deployed Chainbills at: ', proxy);
    vm.stopBroadcast();
  }
}
