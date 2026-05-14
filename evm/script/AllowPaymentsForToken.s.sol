// SPDX-License-Identifier: Apache 2
pragma solidity ^0.8.30;

import {Script, console} from 'forge-std/Script.sol';
import {Chainbills} from '../src/Chainbills.sol';

/// @notice Script to allow a token to be used for payments in Chainbills.
contract AllowPaymentsForToken is Script {
  function run() public {
    address cbAddr = vm.envAddress('CB_ADDRESS');
    string memory chain = vm.envString('CHAIN_NAME');
    string memory tokenName = vm.envString('TOKEN_NAME');

    if (cbAddr == address(0)) revert('CB_ADDRESS not set');

    // Read token address from central JSON
    string memory root = vm.projectRoot();
    string memory path = string.concat(root, '/script/env/tokens.json');
    string memory json = vm.readFile(path);
    
    bytes memory data = vm.parseJson(json, string.concat('.', chain, '.', tokenName));
    address tokenAddr = abi.decode(data, (address));

    // Handle "NATIVE" placeholder
    if (tokenAddr == address(0) || keccak256(abi.encodePacked(tokenName)) == keccak256(abi.encodePacked("NATIVE"))) {
      tokenAddr = cbAddr;
    }

    Chainbills chainbills = Chainbills(payable(cbAddr));

    uint256 ownerPrivateKey = vm.envUint('PRIVATE_KEY');
    vm.startBroadcast(ownerPrivateKey);

    console.log('--- Allow Payments Config ---');
    console.log('Chain:', chain);
    console.log('Token Name:', tokenName);
    console.log('Token Address:', tokenAddr);
    console.log('Chainbills:', cbAddr);
    console.log('-----------------------------');

    chainbills.allowPaymentsForToken(tokenAddr);
    console.log('Successfully allowed payments for token');

    vm.stopBroadcast();
  }

  // Blank Test Function to exclude this Script from test coverage reports.
  function test() public {}
}
