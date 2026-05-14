// SPDX-License-Identifier: Apache 2
pragma solidity ^0.8.30;

import {Script, console} from 'forge-std/Script.sol';
import {Chainbills} from '../src/Chainbills.sol';

/// @notice Script to unregister a matching token for a foreign chain.
contract UnregisterMatchingToken is Script {
  function run() public {
    address cbAddr = vm.envAddress('CB_ADDRESS');
    bytes32 foreignCbChainId = vm.envBytes32('FOREIGN_CB_CHAIN_ID');
    string memory targetChain = vm.envString('TARGET_CHAIN'); // Needs to be passed or derived
    string memory tokenName = vm.envString('TOKEN_NAME');

    if (cbAddr == address(0)) revert('CB_ADDRESS not set');
    if (foreignCbChainId == bytes32(0)) revert('FOREIGN_CB_CHAIN_ID not set');

    // Read foreign token address from central JSON
    string memory root = vm.projectRoot();
    string memory path = string.concat(root, '/script/env/tokens.json');
    string memory json = vm.readFile(path);
    
    bytes memory data = vm.parseJson(json, string.concat('.', targetChain, '.', tokenName));
    address foreignTokenAddr = abi.decode(data, (address));

    // Handle "NATIVE" placeholder (though matching tokens are usually ERC20)
    if (keccak256(abi.encodePacked(tokenName)) == keccak256(abi.encodePacked("NATIVE"))) {
       // On foreign chain, NATIVE is represented by their CB_ADDRESS
       // But we need to get their CB_ADDRESS. For now, we'll assume the user passes it if needed.
       // However, FOREIGN_CB_ADDRESS is usually available in run.sh if TARGET_CHAIN is provided.
       foreignTokenAddr = vm.envAddress('FOREIGN_CB_ADDRESS');
    }

    // Wormhole format (left-padded with zeros)
    bytes32 foreignToken = bytes32(uint256(uint160(foreignTokenAddr)));

    Chainbills cb = Chainbills(payable(cbAddr));

    uint256 ownerPrivateKey = vm.envUint('PRIVATE_KEY');
    vm.startBroadcast(ownerPrivateKey);

    console.log('--- Unregister Matching Token Config ---');
    console.log('Target Chain:', targetChain);
    console.log('Foreign cbChainId:', vm.toString(foreignCbChainId));
    console.log('Token Name:', tokenName);
    console.log('Foreign Token Address:', foreignTokenAddr);
    console.log('----------------------------------------');

    cb.unregisterMatchingTokenForForeignChain(foreignCbChainId, foreignToken);
    console.log('Successfully unregistered matching token');

    vm.stopBroadcast();
  }
}
