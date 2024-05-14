
// SPDX-License-Identifier: Unlicense
pragma solidity ^0.8.20;

import {Upgrades} from 'openzeppelin-foundry-upgrades/Upgrades.sol';
import {Chainbills} from 'src/Chainbills.sol';
import {Script, console} from 'forge-std/Script.sol';

contract DeployChainbills is Script {
  function run() public {
    // TODO: Update these values when deploying to another EVM chain.
    // The address of the Wormhole Core Contract on Sepolia
    address wormhole = 0x4a8bc80Ed5a4067f1CCf107057b8270E0cC11A78;
    // The address of the Wormhole TokenBridge on Sepolia
    address tokenBridge = 0xDB5492265f6038831E89f495670FF909aDe94bd9;
    // The chain ID of Sepolia
    uint16 chainId = 10002;
    // Finality for Wormhole Messages. 200 for Instant, 201 for Finalized.
    uint8 finality = 200;

    uint256 ownerPrivateKey = vm.envUint('PRIVATE_KEY');
    vm.startBroadcast(ownerPrivateKey);

    address proxy = Upgrades.deployTransparentProxy(
      'Chainbills.sol',
      vm.createWallet(ownerPrivateKey).addr,
      abi.encodeCall(
        Chainbills.initialize,
        (wormhole, tokenBridge, chainId, finality)
      )
    );

    console.log('Deployed Chainbills at: ', proxy);
    vm.stopBroadcast();
  }
}
