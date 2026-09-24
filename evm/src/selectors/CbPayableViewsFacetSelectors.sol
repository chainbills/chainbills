// SPDX-License-Identifier: Apache 2
pragma solidity ^0.8.30;

import {ICbPayableViews} from '../interfaces/ICbPayableViews.sol';

/// Selectors routed to `CbPayableViewsFacet`.
library CbPayableViewsFacetSelectors {
  /// Returns every selector served by `CbPayableViewsFacet`.
  /// @return sels Function selectors.
  function selectors() internal pure returns (bytes4[] memory sels) {
    sels = new bytes4[](40);
    sels[0] = ICbPayableViews.payableExists.selector;
    sels[1] = ICbPayableViews.isPayableHost.selector;
    sels[2] = ICbPayableViews.getPayable.selector;
    sels[3] = ICbPayableViews.getPayablesBulk.selector;
    sels[4] = ICbPayableViews.getPayableView.selector;
    sels[5] = ICbPayableViews.getPayableViewsBulk.selector;
    sels[6] = ICbPayableViews.getAllowedTokensAndAmounts.selector;
    sels[7] = ICbPayableViews.getBalances.selector;
    sels[8] = ICbPayableViews.getBalance.selector;
    sels[9] = ICbPayableViews.getBalanceTokens.selector;
    sels[10] = ICbPayableViews.getChainPayableCount.selector;
    sels[11] = ICbPayableViews.getChainPayableIdAt.selector;
    sels[12] = ICbPayableViews.getChainPayableIds.selector;
    sels[13] = ICbPayableViews.getChainPayableIdsDesc.selector;
    sels[14] = ICbPayableViews.getChainPayables.selector;
    sels[15] = ICbPayableViews.getChainPayablesDesc.selector;
    sels[16] = ICbPayableViews.getUserPayableCount.selector;
    sels[17] = ICbPayableViews.getUserPayableIdAt.selector;
    sels[18] = ICbPayableViews.getUserPayableIds.selector;
    sels[19] = ICbPayableViews.getUserPayableIdsDesc.selector;
    sels[20] = ICbPayableViews.getUserPayables.selector;
    sels[21] = ICbPayableViews.getUserPayablesDesc.selector;
    sels[22] = ICbPayableViews.foreignPayableExists.selector;
    sels[23] = ICbPayableViews.getForeignPayable.selector;
    sels[24] = ICbPayableViews.getForeignPayablesBulk.selector;
    sels[25] = ICbPayableViews.getForeignPayableView.selector;
    sels[26] = ICbPayableViews.getForeignPayableViewsBulk.selector;
    sels[27] = ICbPayableViews.getForeignPayableAllowedTokensAndAmounts.selector;
    sels[28] = ICbPayableViews.getChainForeignPayableCount.selector;
    sels[29] = ICbPayableViews.getChainForeignPayableIdAt.selector;
    sels[30] = ICbPayableViews.getChainForeignPayableIds.selector;
    sels[31] = ICbPayableViews.getChainForeignPayableIdsDesc.selector;
    sels[32] = ICbPayableViews.getChainForeignPayables.selector;
    sels[33] = ICbPayableViews.getChainForeignPayablesDesc.selector;
    sels[34] = ICbPayableViews.getForeignPayableCountByChain.selector;
    sels[35] = ICbPayableViews.getForeignPayableIdByChainAt.selector;
    sels[36] = ICbPayableViews.getForeignPayableIdsByChain.selector;
    sels[37] = ICbPayableViews.getForeignPayableIdsByChainDesc.selector;
    sels[38] = ICbPayableViews.getForeignPayablesByChain.selector;
    sels[39] = ICbPayableViews.getForeignPayablesByChainDesc.selector;
  }
}
