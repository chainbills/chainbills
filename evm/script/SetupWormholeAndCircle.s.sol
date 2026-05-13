// SPDX-License-Identifier: Apache 2
pragma solidity ^0.8.30;

import {Script, console} from 'forge-std/Script.sol';
import {Chainbills} from 'src/Chainbills.sol';

/// @notice Script to configure Wormhole and Circle bridge addresses on Chainbills.
contract SetupWormholeAndCircle is Script {
  function run() public {
    address cbAddr = vm.envAddress('CB_ADDRESS');
    address wormhole = vm.envAddress('WORMHOLE_ADDRESS');
    address circleBridge = vm.envAddress('CIRCLE_BRIDGE_ADDRESS');
    uint16 wormholeChainId = uint16(vm.envUint('WORMHOLE_CHAIN_ID'));
    uint8 wormholeFinality = uint8(vm.envUint('WORMHOLE_FINALITY'));
    bytes32 cbChainId = vm.envBytes32('CB_CHAIN_ID');

    Chainbills chainbills = Chainbills(payable(cbAddr));

    uint256 ownerPrivateKey = vm.envUint('PRIVATE_KEY');
    vm.startBroadcast(ownerPrivateKey);

    console.log('Setting up Wormhole and Circle on Chainbills ...');
    chainbills.setupWormholeAndCircle(wormhole, circleBridge, wormholeChainId, wormholeFinality, cbChainId);
    console.log('Done. Wormhole Chain ID:', wormholeChainId);
    console.logBytes32(cbChainId);

    vm.stopBroadcast();
  }
}
