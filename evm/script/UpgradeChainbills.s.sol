// SPDX-License-Identifier: Unlicense
pragma solidity ^0.8.20;

import {Upgrades, Options} from 'openzeppelin-foundry-upgrades/Upgrades.sol';
import {Chainbills} from 'src/Chainbills.sol';
import {Script, console} from 'forge-std/Script.sol';

contract UpgradeChainbills is Script {
  // TODO: Set the proxy's address before upgrading or on new deployments
  // to other chains
  address public proxy = 0x32a406E7dB2604ed81859Fce0e6a6589dA1b69E1;

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
