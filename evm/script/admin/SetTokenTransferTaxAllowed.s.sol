// SPDX-License-Identifier: Apache 2
pragma solidity ^0.8.30;

import {console} from 'forge-std/Script.sol';
import {CbAdminScript} from '../base/CbAdminScript.sol';

/// Allows or forbids incoming transfers of `TOKEN` that deliver less than pulled, on `DIAMOND`.
///
/// Required env: `DIAMOND`, `TOKEN`, `IS_TRANSFER_TAX_ALLOWED` (bool).
contract SetTokenTransferTaxAllowed is CbAdminScript {
  function run() public {
    address token = vm.envAddress('TOKEN');
    bool isTransferTaxAllowed = vm.envBool('IS_TRANSFER_TAX_ALLOWED');

    vm.startBroadcast();
    _diamond().setTokenTransferTaxAllowed(token, isTransferTaxAllowed);
    vm.stopBroadcast();

    console.log('Set transfer-tax-allowed for token', token);
    console.log('to', isTransferTaxAllowed);
  }
}
