// SPDX-License-Identifier: Apache 2
pragma solidity ^0.8.30;

import {console} from 'forge-std/Script.sol';
import {CbAdminScript} from '../base/CbAdminScript.sol';
import {ForeignChainSwitches} from '../../src/types/CbTypes.sol';

/// Sets the direction switches of the foreign chain `FOREIGN_CB_CHAIN_ID` on `DIAMOND`.
///
/// Required env: `DIAMOND`, `FOREIGN_CB_CHAIN_ID`, `SWITCH_CCTP_UPDATE`, `SWITCH_INBOUND_UPDATE`,
/// `SWITCH_OUTBOUND_PAYMENT`, `SWITCH_INBOUND_PAYMENT` (bool).
contract SetForeignChainSwitches is CbAdminScript {
  function run() public {
    bytes32 foreignChainId = vm.envBytes32('FOREIGN_CB_CHAIN_ID');
    ForeignChainSwitches memory switches = ForeignChainSwitches({
      isCctpUpdateEnabled: vm.envBool('SWITCH_CCTP_UPDATE'),
      isInboundUpdateEnabled: vm.envBool('SWITCH_INBOUND_UPDATE'),
      isOutboundPaymentEnabled: vm.envBool('SWITCH_OUTBOUND_PAYMENT'),
      isInboundPaymentEnabled: vm.envBool('SWITCH_INBOUND_PAYMENT')
    });

    vm.startBroadcast();
    _diamond().setForeignChainSwitches(foreignChainId, switches);
    vm.stopBroadcast();

    console.log('Set switches for foreign chain');
    console.logBytes32(foreignChainId);
  }
}
