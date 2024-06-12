// SPDX-License-Identifier: Unlicense
pragma solidity ^0.8.20;

import {Upgrades, Options} from 'openzeppelin-foundry-upgrades/Upgrades.sol';
import {Chainbills} from 'src/Chainbills.sol';
import {Script, console} from 'forge-std/Script.sol';

contract UpgradeChainbills is Script {
  // TODO: Set the proxy's address before upgrading or on new deployments
  // to other chains
  address public proxy = 0x89F1051407799805eac5aE9A40240dbCaaB55b98;

  function run() public {
    uint256 ownerPrivateKey = vm.envUint('PRIVATE_KEY');
    vm.startBroadcast(ownerPrivateKey);

    // TODO: Ensure that skipping checks is solely for allowing re-update
    // of same contract
    Options memory opts;
    opts.unsafeSkipAllChecks = true;
    Upgrades.upgradeProxy(proxy, 'Chainbills.sol', '', opts);

    console.log('Upgraded Chainbills to: ', proxy);
    vm.stopBroadcast();
  }
}
