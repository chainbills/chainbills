// SPDX-License-Identifier: Apache 2
pragma solidity ^0.8.30;

import {Script, console} from 'forge-std/Script.sol';

/// Computes and displays the cbChainId (bytes32) for a given CAIP-2 string.
/// cbChainId = keccak256(abi.encodePacked("namespace:reference"))
///
/// Run WITHOUT --broadcast:
///   CAIP2=eip155:11155111 forge script script/ComputeCbChainId.s.sol -vvv
///
/// Common CAIP-2 strings:
///   eip155:1          Ethereum Mainnet
///   eip155:11155111   Ethereum Sepolia
///   eip155:4326      MegaETH Mainnet
///   eip155:5042002    Arc Testnet
contract ComputeCbChainId is Script {
  function run() public view {
    string memory caip2 = vm.envString('CAIP2');
    bytes32 cbChainId = keccak256(abi.encodePacked(caip2));
    console.log('CAIP-2 string :', caip2);
    console.log('cbChainId      :');
    console.logBytes32(cbChainId);
  }

  // Blank Test Function to exclude this Script from test coverage reports.
  function test() public {}
}
