// SPDX-License-Identifier: Apache 2
pragma solidity ^0.8.30;

import {ICbCrossChainViews} from '../interfaces/ICbCrossChainViews.sol';

/// Selectors routed to `CbCrossChainViewsFacet`.
library CbCrossChainViewsFacetSelectors {
  /// Returns every selector served by `CbCrossChainViewsFacet`.
  /// @return sels Function selectors.
  function selectors() internal pure returns (bytes4[] memory sels) {
    sels = new bytes4[](13);
    sels[0] = ICbCrossChainViews.isWormholeMessageConsumed.selector;
    sels[1] = ICbCrossChainViews.getConsumedWormholeMessageCount.selector;
    sels[2] = ICbCrossChainViews.getConsumedWormholeMessages.selector;
    sels[3] = ICbCrossChainViews.getConsumedWormholeMessagesDesc.selector;
    sels[4] = ICbCrossChainViews.getConsumedWormholeMessageCountByChain.selector;
    sels[5] = ICbCrossChainViews.getConsumedWormholeMessagesByChain.selector;
    sels[6] = ICbCrossChainViews.getConsumedWormholeMessagesByChainDesc.selector;
    sels[7] = ICbCrossChainViews.isCctpBurnNonceConsumed.selector;
    sels[8] = ICbCrossChainViews.isCctpDataNonceConsumed.selector;
    sels[9] = ICbCrossChainViews.isPaymentNonceConsumed.selector;
    sels[10] = ICbCrossChainViews.getForeignPayableUpdateNonce.selector;
    sels[11] = ICbCrossChainViews.getLastPayableUpdateNonce.selector;
    sels[12] = ICbCrossChainViews.getNextPaymentNonce.selector;
  }
}
