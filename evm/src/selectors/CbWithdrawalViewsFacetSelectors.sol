// SPDX-License-Identifier: Apache 2
pragma solidity ^0.8.30;

import {ICbWithdrawalViews} from '../interfaces/ICbWithdrawalViews.sol';

/// Selectors routed to `CbWithdrawalViewsFacet`.
library CbWithdrawalViewsFacetSelectors {
  /// Returns every selector served by `CbWithdrawalViewsFacet`.
  /// @return sels Function selectors.
  function selectors() internal pure returns (bytes4[] memory sels) {
    sels = new bytes4[](20);
    sels[0] = ICbWithdrawalViews.getWithdrawal.selector;
    sels[1] = ICbWithdrawalViews.getWithdrawalsBulk.selector;
    sels[2] = ICbWithdrawalViews.getChainWithdrawalCount.selector;
    sels[3] = ICbWithdrawalViews.getChainWithdrawalIdAt.selector;
    sels[4] = ICbWithdrawalViews.getChainWithdrawalIds.selector;
    sels[5] = ICbWithdrawalViews.getChainWithdrawalIdsDesc.selector;
    sels[6] = ICbWithdrawalViews.getChainWithdrawals.selector;
    sels[7] = ICbWithdrawalViews.getChainWithdrawalsDesc.selector;
    sels[8] = ICbWithdrawalViews.getUserWithdrawalCount.selector;
    sels[9] = ICbWithdrawalViews.getUserWithdrawalIdAt.selector;
    sels[10] = ICbWithdrawalViews.getUserWithdrawalIds.selector;
    sels[11] = ICbWithdrawalViews.getUserWithdrawalIdsDesc.selector;
    sels[12] = ICbWithdrawalViews.getUserWithdrawals.selector;
    sels[13] = ICbWithdrawalViews.getUserWithdrawalsDesc.selector;
    sels[14] = ICbWithdrawalViews.getPayableWithdrawalCount.selector;
    sels[15] = ICbWithdrawalViews.getPayableWithdrawalIdAt.selector;
    sels[16] = ICbWithdrawalViews.getPayableWithdrawalIds.selector;
    sels[17] = ICbWithdrawalViews.getPayableWithdrawalIdsDesc.selector;
    sels[18] = ICbWithdrawalViews.getPayableWithdrawals.selector;
    sels[19] = ICbWithdrawalViews.getPayableWithdrawalsDesc.selector;
  }
}
