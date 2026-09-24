// SPDX-License-Identifier: Apache 2
pragma solidity ^0.8.30;

import {ICbChainRegistry} from '../interfaces/ICbChainRegistry.sol';

/// Selectors routed to `CbChainRegistryFacet`.
library CbChainRegistryFacetSelectors {
  /// Returns every selector served by `CbChainRegistryFacet`.
  /// @return sels Function selectors.
  function selectors() internal pure returns (bytes4[] memory sels) {
    sels = new bytes4[](8);
    sels[0] = ICbChainRegistry.registerForeignChain.selector;
    sels[1] = ICbChainRegistry.updateForeignChain.selector;
    sels[2] = ICbChainRegistry.unregisterForeignChain.selector;
    sels[3] = ICbChainRegistry.setForeignChainProtocolIds.selector;
    sels[4] = ICbChainRegistry.setForeignChainAddresses.selector;
    sels[5] = ICbChainRegistry.setForeignChainSwitches.selector;
    sels[6] = ICbChainRegistry.setForeignChainFinality.selector;
    sels[7] = ICbChainRegistry.setForeignChainLimits.selector;
  }
}
