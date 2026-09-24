// SPDX-License-Identifier: Apache 2
pragma solidity ^0.8.30;

import {ICbQuoteViews} from '../interfaces/ICbQuoteViews.sol';

/// Selectors routed to `CbQuoteViewsFacet`.
library CbQuoteViewsFacetSelectors {
  /// Returns every selector served by `CbQuoteViewsFacet`.
  /// @return sels Function selectors.
  function selectors() internal pure returns (bytes4[] memory sels) {
    sels = new bytes4[](8);
    sels[0] = ICbQuoteViews.quoteBroadcastFee.selector;
    sels[1] = ICbQuoteViews.quotePublishPayableDetailsFee.selector;
    sels[2] = ICbQuoteViews.quoteWithdrawalFee.selector;
    sels[3] = ICbQuoteViews.quoteWithdrawal.selector;
    sels[4] = ICbQuoteViews.canPay.selector;
    sels[5] = ICbQuoteViews.canPayForeign.selector;
    sels[6] = ICbQuoteViews.canWithdraw.selector;
    sels[7] = ICbQuoteViews.getUntrackedBalance.selector;
  }
}
