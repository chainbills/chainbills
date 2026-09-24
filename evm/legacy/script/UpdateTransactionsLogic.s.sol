// SPDX-License-Identifier: Apache 2
pragma solidity ^0.8.30;

import {Script, console} from 'forge-std/Script.sol';
import {Chainbills} from 'src/Chainbills.sol';
import {CbTransactions} from 'src/CbTransactions.sol';

/// Updates the transactions logic contract on an already-deployed Chainbills proxy.
/// This is NOT a proxy upgrade — it only replaces the CbTransactions delegate target.
/// Run via: ./script/run.sh <chain> UpdateTransactionsLogic
contract UpdateTransactionsLogic is Script {
  function run() external {
    address proxy = vm.envAddress('CB_ADDRESS');
    uint256 pk = vm.envUint('PRIVATE_KEY');

    vm.startBroadcast(pk);
    address newLogic = address(new CbTransactions());
    console.log('New CbTransactions:', newLogic);
    Chainbills(payable(proxy)).setTransactionsLogic(newLogic);
    vm.stopBroadcast();
  }

  // Blank Test Function to exclude this Script from test coverage reports.
  function test() public {}
}
