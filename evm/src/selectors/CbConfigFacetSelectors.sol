// SPDX-License-Identifier: Apache 2
pragma solidity ^0.8.30;

import {ICbConfig} from '../interfaces/ICbConfig.sol';

/// Selectors routed to `CbConfigFacet`.
library CbConfigFacetSelectors {
  /// Returns every selector served by `CbConfigFacet`.
  /// @return sels Function selectors.
  function selectors() internal pure returns (bytes4[] memory sels) {
    sels = new bytes4[](10);
    sels[0] = ICbConfig.setFeeCollector.selector;
    sels[1] = ICbConfig.setWithdrawalFeeBps.selector;
    sels[2] = ICbConfig.setMaxAllowedTokensAndAmounts.selector;
    sels[3] = ICbConfig.setRelayerRestricted.selector;
    sels[4] = ICbConfig.setPublishPayableRestricted.selector;
    sels[5] = ICbConfig.setupWormhole.selector;
    sels[6] = ICbConfig.setWormholeEnabled.selector;
    sels[7] = ICbConfig.setWormholeFinality.selector;
    sels[8] = ICbConfig.setupCctp.selector;
    sels[9] = ICbConfig.setCctpEnabled.selector;
  }
}
