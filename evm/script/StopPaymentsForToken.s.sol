// SPDX-License-Identifier: Apache 2
pragma solidity ^0.8.30;

import {Script, console} from 'forge-std/Script.sol';
import {Chainbills} from '../src/Chainbills.sol';

contract StopPaymentsForToken is Script {
  function run() public {
    address cbAddr = vm.envAddress('CB_ADDRESS');
    string memory chain = vm.envString('CHAIN_NAME'); // We'll need to pass this or derive it
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

    Chainbills cb = Chainbills(payable(cbAddr));

    uint256 ownerPrivateKey = vm.envUint('PRIVATE_KEY');
    vm.startBroadcast(ownerPrivateKey);

    console.log('Stopping payments for token:', tokenName, '(', tokenAddr, ')');
    cb.stopPaymentsForToken(tokenAddr);
    console.log('Successfully stopped payments for token');

    vm.stopBroadcast();
  }
}
