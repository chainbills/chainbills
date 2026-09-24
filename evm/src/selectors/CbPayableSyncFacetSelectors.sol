// SPDX-License-Identifier: Apache 2
pragma solidity ^0.8.30;

import {ICbPayableSync} from '../interfaces/ICbPayableSync.sol';
import {IMessageHandlerV2} from '../interfaces/circle/IMessageHandlerV2.sol';

/// Selectors routed to `CbPayableSyncFacet`.
library CbPayableSyncFacetSelectors {
  /// Returns every selector served by `CbPayableSyncFacet`.
  /// @return sels Function selectors.
  function selectors() internal pure returns (bytes4[] memory sels) {
    sels = new bytes4[](5);
    sels[0] = ICbPayableSync.receivePayableUpdateViaWormhole.selector;
    sels[1] = ICbPayableSync.receivePayableUpdateViaCctp.selector;
    sels[2] = ICbPayableSync.adminSyncForeignPayable.selector;
    sels[3] = IMessageHandlerV2.handleReceiveFinalizedMessage.selector;
    sels[4] = IMessageHandlerV2.handleReceiveUnfinalizedMessage.selector;
  }
}
