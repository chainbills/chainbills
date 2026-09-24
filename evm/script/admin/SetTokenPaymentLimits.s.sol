// SPDX-License-Identifier: Apache 2
pragma solidity ^0.8.30;

import {console} from 'forge-std/Script.sol';
import {CbAdminScript} from '../base/CbAdminScript.sol';
import {TokenPaymentLimits} from '../../src/types/CbTypes.sol';

/// Sets the payment amount limits of `TOKEN` on `DIAMOND`.
///
/// Required env: `DIAMOND`, `TOKEN`. Optional: `MIN_PAYMENT_AMOUNT`, `MAX_PAYMENT_AMOUNT` (uint256, token's
/// smallest unit); either left unset leaves that bound unenforced.
contract SetTokenPaymentLimits is CbAdminScript {
  function run() public {
    address token = vm.envAddress('TOKEN');
    bool hasMin = vm.envExists('MIN_PAYMENT_AMOUNT');
    bool hasMax = vm.envExists('MAX_PAYMENT_AMOUNT');
    TokenPaymentLimits memory limits = TokenPaymentLimits({
      hasMinPaymentAmount: hasMin,
      minPaymentAmount: hasMin ? vm.envUint('MIN_PAYMENT_AMOUNT') : 0,
      hasMaxPaymentAmount: hasMax,
      maxPaymentAmount: hasMax ? vm.envUint('MAX_PAYMENT_AMOUNT') : 0
    });

    vm.startBroadcast();
    _diamond().setTokenPaymentLimits(token, limits);
    vm.stopBroadcast();

    console.log('Set payment limits for token', token);
  }
}
