// SPDX-License-Identifier: Apache 2
pragma solidity ^0.8.30;

import {console} from 'forge-std/Script.sol';
import {CbAdminScript} from '../base/CbAdminScript.sol';
import {ForeignChainFinality} from '../../src/types/CbTypes.sol';

/// Sets the CCTP finality settings of the foreign chain `FOREIGN_CB_CHAIN_ID` on `DIAMOND`.
///
/// Required env: `DIAMOND`, `FOREIGN_CB_CHAIN_ID`, `FINALITY_OUTBOUND_UPDATE`, `FINALITY_OUTBOUND_PAYMENT`,
/// `FINALITY_MIN_INBOUND_UPDATE`, `FINALITY_MIN_INBOUND_PAYMENT` (uint32; `1000` fast, `2000` finalized).
contract SetForeignChainFinality is CbAdminScript {
  function run() public {
    bytes32 foreignChainId = vm.envBytes32('FOREIGN_CB_CHAIN_ID');
    ForeignChainFinality memory finality = ForeignChainFinality({
      outboundUpdateFinality: uint32(vm.envUint('FINALITY_OUTBOUND_UPDATE')),
      outboundPaymentFinality: uint32(vm.envUint('FINALITY_OUTBOUND_PAYMENT')),
      minInboundUpdateFinality: uint32(vm.envUint('FINALITY_MIN_INBOUND_UPDATE')),
      minInboundPaymentFinality: uint32(vm.envUint('FINALITY_MIN_INBOUND_PAYMENT'))
    });

    vm.startBroadcast();
    _diamond().setForeignChainFinality(foreignChainId, finality);
    vm.stopBroadcast();

    console.log('Set finality for foreign chain');
    console.logBytes32(foreignChainId);
  }
}
