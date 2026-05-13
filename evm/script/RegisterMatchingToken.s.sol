// SPDX-License-Identifier: Apache 2
pragma solidity ^0.8.30;

import {Script, console} from 'forge-std/Script.sol';
import {Chainbills} from 'src/Chainbills.sol';

/// Registers a matching token pair between this chain and a foreign chain.
/// Typically used to link USDC addresses across chains.
///
/// Required env vars:
///   CB_ADDRESS           - this chain's Chainbills proxy address
///   FOREIGN_CB_CHAIN_ID  - cbChainId (bytes32) of the foreign chain
///   FOREIGN_TOKEN        - token address on the foreign chain (as bytes32, left-padded)
///   LOCAL_TOKEN          - corresponding token address on this chain
contract RegisterMatchingToken is Script {
  function run() public {
    address cbAddr = vm.envAddress('CB_ADDRESS');
    bytes32 foreignCbChainId = vm.envBytes32('FOREIGN_CB_CHAIN_ID');
    bytes32 foreignToken = vm.envBytes32('FOREIGN_TOKEN');
    address localToken = vm.envAddress('LOCAL_TOKEN');

    Chainbills chainbills = Chainbills(payable(cbAddr));

    uint256 ownerPrivateKey = vm.envUint('PRIVATE_KEY');
    vm.startBroadcast(ownerPrivateKey);

    console.log('Registering matching token for foreign chain ...');
    console.log('Local token :', localToken);
    console.logBytes32(foreignToken);
    chainbills.registerMatchingTokenForForeignChain(foreignCbChainId, foreignToken, localToken);
    console.log('Done.');

    vm.stopBroadcast();
  }
}
