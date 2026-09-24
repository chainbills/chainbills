// SPDX-License-Identifier: Apache 2
pragma solidity ^0.8.30;

import {console} from 'forge-std/Script.sol';
import {CbAdminScript} from '../base/CbAdminScript.sol';
import {ForeignChainLimits} from '../../src/types/CbTypes.sol';

/// Sets the outbound payment limits of the foreign chain `FOREIGN_CB_CHAIN_ID` on `DIAMOND`.
///
/// Required env: `DIAMOND`, `FOREIGN_CB_CHAIN_ID`. Optional: `MAX_OUTBOUND_CCTP_FEE_BPS` (uint16); when unset the
/// cap is cleared.
contract SetForeignChainLimits is CbAdminScript {
  function run() public {
    bytes32 foreignChainId = vm.envBytes32('FOREIGN_CB_CHAIN_ID');
    bool hasFeeCap = vm.envExists('MAX_OUTBOUND_CCTP_FEE_BPS');
    ForeignChainLimits memory limits = ForeignChainLimits({
      hasMaxOutboundCctpFeeBps: hasFeeCap,
      maxOutboundCctpFeeBps: hasFeeCap ? uint16(vm.envUint('MAX_OUTBOUND_CCTP_FEE_BPS')) : 0
    });

    vm.startBroadcast();
    _diamond().setForeignChainLimits(foreignChainId, limits);
    vm.stopBroadcast();

    console.log('Set limits for foreign chain');
    console.logBytes32(foreignChainId);
  }
}
