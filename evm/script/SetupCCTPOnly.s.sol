// SPDX-License-Identifier: Apache 2
pragma solidity ^0.8.30;

import {Script, console} from 'forge-std/Script.sol';
import {Chainbills} from 'src/Chainbills.sol';

/// @notice Setup script for configuring CCTP on chains that do not support Wormhole.
contract SetupCCTPOnly is Script {
  function run() public {
    address cbAddr = vm.envAddress('CB_ADDRESS');
    address circleTransmitter = vm.envAddress('CIRCLE_TRANSMITTER_ADDRESS');
    uint32 circleDomain = uint32(vm.envUint('CIRCLE_DOMAIN'));
    bytes32 cbChainId = vm.envBytes32('CB_CHAIN_ID');

    Chainbills chainbills = Chainbills(payable(cbAddr));

    uint256 ownerPrivateKey = vm.envUint('PRIVATE_KEY');
    vm.startBroadcast(ownerPrivateKey);

    console.log('Setting up CCTP-only on Chainbills ...');
    chainbills.setupCctpOnly(circleTransmitter, circleDomain, cbChainId);
    console.log('Done. Circle Domain:', circleDomain);
    console.logBytes32(cbChainId);

    vm.stopBroadcast();
  }

  // Blank Test Function to exclude this Script from test coverage reports.
  function test() public {}
}
