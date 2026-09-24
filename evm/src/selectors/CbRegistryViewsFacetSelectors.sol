// SPDX-License-Identifier: Apache 2
pragma solidity ^0.8.30;

import {ICbRegistryViews} from '../interfaces/ICbRegistryViews.sol';

/// Selectors routed to `CbRegistryViewsFacet`.
library CbRegistryViewsFacetSelectors {
  /// Returns every selector served by `CbRegistryViewsFacet`.
  /// @return sels Function selectors.
  function selectors() internal pure returns (bytes4[] memory sels) {
    sels = new bytes4[](23);
    sels[0] = ICbRegistryViews.isForeignChainRegistered.selector;
    sels[1] = ICbRegistryViews.getForeignChain.selector;
    sels[2] = ICbRegistryViews.getForeignChainCount.selector;
    sels[3] = ICbRegistryViews.getForeignChainIdAt.selector;
    sels[4] = ICbRegistryViews.getForeignChainIds.selector;
    sels[5] = ICbRegistryViews.getForeignChains.selector;
    sels[6] = ICbRegistryViews.getForeignChainIdByWormholeChainId.selector;
    sels[7] = ICbRegistryViews.getForeignChainIdByCircleDomain.selector;
    sels[8] = ICbRegistryViews.getTokenDetails.selector;
    sels[9] = ICbRegistryViews.getTokenDetailsBulk.selector;
    sels[10] = ICbRegistryViews.getTokenConfig.selector;
    sels[11] = ICbRegistryViews.getTokenStats.selector;
    sels[12] = ICbRegistryViews.isTokenSupported.selector;
    sels[13] = ICbRegistryViews.getRegisteredTokenCount.selector;
    sels[14] = ICbRegistryViews.getRegisteredTokenAt.selector;
    sels[15] = ICbRegistryViews.getRegisteredTokens.selector;
    sels[16] = ICbRegistryViews.getRegisteredTokenDetails.selector;
    sels[17] = ICbRegistryViews.getSupportedTokens.selector;
    sels[18] = ICbRegistryViews.getEffectiveWithdrawalFeeBps.selector;
    sels[19] = ICbRegistryViews.getMatchingLocalToken.selector;
    sels[20] = ICbRegistryViews.getMatchingForeignToken.selector;
    sels[21] = ICbRegistryViews.getMatchingTokenCount.selector;
    sels[22] = ICbRegistryViews.getMatchingTokens.selector;
  }
}
