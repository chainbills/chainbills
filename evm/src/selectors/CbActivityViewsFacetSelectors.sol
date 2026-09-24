// SPDX-License-Identifier: Apache 2
pragma solidity ^0.8.30;

import {ICbActivityViews} from '../interfaces/ICbActivityViews.sol';

/// Selectors routed to `CbActivityViewsFacet`.
library CbActivityViewsFacetSelectors {
  /// Returns every selector served by `CbActivityViewsFacet`.
  /// @return sels Function selectors.
  function selectors() internal pure returns (bytes4[] memory sels) {
    sels = new bytes4[](31);
    sels[0] = ICbActivityViews.getActivity.selector;
    sels[1] = ICbActivityViews.getActivitiesBulk.selector;
    sels[2] = ICbActivityViews.getChainActivityCount.selector;
    sels[3] = ICbActivityViews.getChainActivityIdAt.selector;
    sels[4] = ICbActivityViews.getChainActivityIds.selector;
    sels[5] = ICbActivityViews.getChainActivityIdsDesc.selector;
    sels[6] = ICbActivityViews.getChainActivities.selector;
    sels[7] = ICbActivityViews.getChainActivitiesDesc.selector;
    sels[8] = ICbActivityViews.getUserActivityCount.selector;
    sels[9] = ICbActivityViews.getUserActivityIdAt.selector;
    sels[10] = ICbActivityViews.getUserActivityIds.selector;
    sels[11] = ICbActivityViews.getUserActivityIdsDesc.selector;
    sels[12] = ICbActivityViews.getUserActivities.selector;
    sels[13] = ICbActivityViews.getUserActivitiesDesc.selector;
    sels[14] = ICbActivityViews.getPayableActivityCount.selector;
    sels[15] = ICbActivityViews.getPayableActivityIdAt.selector;
    sels[16] = ICbActivityViews.getPayableActivityIds.selector;
    sels[17] = ICbActivityViews.getPayableActivityIdsDesc.selector;
    sels[18] = ICbActivityViews.getPayableActivities.selector;
    sels[19] = ICbActivityViews.getPayableActivitiesDesc.selector;
    sels[20] = ICbActivityViews.getUserActivitiesByType.selector;
    sels[21] = ICbActivityViews.getPayableActivitiesByType.selector;
    sels[22] = ICbActivityViews.isUserInitialized.selector;
    sels[23] = ICbActivityViews.getUser.selector;
    sels[24] = ICbActivityViews.getUsersBulk.selector;
    sels[25] = ICbActivityViews.getChainUserCount.selector;
    sels[26] = ICbActivityViews.getChainUserAt.selector;
    sels[27] = ICbActivityViews.getChainUserAddresses.selector;
    sels[28] = ICbActivityViews.getChainUserAddressesDesc.selector;
    sels[29] = ICbActivityViews.getChainUsers.selector;
    sels[30] = ICbActivityViews.getChainUsersDesc.selector;
  }
}
