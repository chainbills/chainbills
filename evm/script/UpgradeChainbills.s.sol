// SPDX-License-Identifier: Apache 2
pragma solidity ^0.8.30;

import {Upgrades, Options} from 'openzeppelin-foundry-upgrades/Upgrades.sol';
import {Script, console} from 'forge-std/Script.sol';

/// @notice Upgrades the Chainbills proxy to a new implementation.
contract UpgradeChainbills is Script {
  function run() public {
    // Read the proxy address from the CB_ADDRESS environment variable
    address cbAddr = vm.envAddress('CB_ADDRESS');
    if (cbAddr == address(0)) revert('CB_ADDRESS not set');

    // Load the owner private key from the environment
    uint256 ownerPrivateKey = vm.envUint('PRIVATE_KEY');

    vm.startBroadcast(ownerPrivateKey);

    console.log('--- Upgrade Chainbills Config ---');
    console.log('Proxy Address:', cbAddr);
    console.log('Implementation: Chainbills.sol');
    console.log('---------------------------------');

    Options memory opts;
    // Comment out after copying over apprioprate "build-info" json from deploys/v??...
    opts.referenceBuildInfoDir = "prev-deploy";

    // Perform the upgrade using OpenZeppelin's foundry-upgrades library
    // This will deploy the new implementation and call upgradeTo on the proxy
    Upgrades.upgradeProxy(cbAddr, 'Chainbills.sol', '', opts);

    console.log('Successfully upgraded Chainbills proxy at:', cbAddr);

    vm.stopBroadcast();
  }

  // Blank Test Function to exclude this Script from test coverage reports.
  function test() public {}
}
