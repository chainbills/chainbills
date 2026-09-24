// SPDX-License-Identifier: Apache 2
pragma solidity ^0.8.30;

import {console} from 'forge-std/Script.sol';
import {CbAdminScript} from '../base/CbAdminScript.sol';
import {TokenFeeConfig} from '../../src/types/CbTypes.sol';

/// Sets the full withdrawal fee configuration of `TOKEN` on `DIAMOND`.
///
/// Required env: `DIAMOND`, `TOKEN`, `FEE_BPS` (uint16, at most `10_000`). Optional: `MAX_WITHDRAWAL_FEE`
/// (uint256, token's smallest unit); when unset the fee is uncapped.
contract SetTokenFeeConfig is CbAdminScript {
  function run() public {
    address token = vm.envAddress('TOKEN');
    bool hasCap = vm.envExists('MAX_WITHDRAWAL_FEE');
    TokenFeeConfig memory fee = TokenFeeConfig({
      hasFeeBpsOverride: true,
      feeBps: uint16(vm.envUint('FEE_BPS')),
      hasMaxWithdrawalFee: hasCap,
      maxWithdrawalFee: hasCap ? vm.envUint('MAX_WITHDRAWAL_FEE') : 0
    });

    vm.startBroadcast();
    _diamond().setTokenFeeConfig(token, fee);
    vm.stopBroadcast();

    console.log('Set fee config for token', token);
  }
}
