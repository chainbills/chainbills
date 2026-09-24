// SPDX-License-Identifier: Apache 2
pragma solidity ^0.8.30;

import {ICbCoreViews} from '../interfaces/ICbCoreViews.sol';

/// Selectors routed to `CbCoreViewsFacet`.
library CbCoreViewsFacetSelectors {
  /// Returns every selector served by `CbCoreViewsFacet`.
  /// @return sels Function selectors.
  function selectors() internal pure returns (bytes4[] memory sels) {
    sels = new bytes4[](14);
    sels[0] = ICbCoreViews.isInitialized.selector;
    sels[1] = ICbCoreViews.cbChainId.selector;
    sels[2] = ICbCoreViews.nativeToken.selector;
    sels[3] = ICbCoreViews.getProtocolConfig.selector;
    sels[4] = ICbCoreViews.getWormholeConfig.selector;
    sels[5] = ICbCoreViews.getCctpConfig.selector;
    sels[6] = ICbCoreViews.hasWormhole.selector;
    sels[7] = ICbCoreViews.hasCctp.selector;
    sels[8] = ICbCoreViews.getWormholeMessageFee.selector;
    sels[9] = ICbCoreViews.getChainStats.selector;
    sels[10] = ICbCoreViews.getWormholeStats.selector;
    sels[11] = ICbCoreViews.getCctpStats.selector;
    sels[12] = ICbCoreViews.getAllStats.selector;
    sels[13] = ICbCoreViews.getProtocolOverview.selector;
  }
}
