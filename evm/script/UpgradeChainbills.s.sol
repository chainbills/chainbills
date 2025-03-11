// SPDX-License-Identifier: Apache 2
pragma solidity ^0.8.20;

import 'openzeppelin-foundry-upgrades/Upgrades.sol';
import 'src/Chainbills.sol';
import 'forge-std/Script.sol';

contract UpgradeChainbills is Script {
  // TODO: Set the proxy's address before upgrading or on new deployments
  // to other chains
  address public proxy;

  function run() public {
    uint256 ownerPrivateKey = vm.envUint('PRIVATE_KEY');
    vm.startBroadcast(ownerPrivateKey);

    Upgrades.upgradeProxy(proxy, 'Chainbills.sol', '');

    console.log('Upgraded Chainbills to: ', proxy);
    vm.stopBroadcast();
  }
}
