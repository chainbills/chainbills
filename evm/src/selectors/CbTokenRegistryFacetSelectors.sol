// SPDX-License-Identifier: Apache 2
pragma solidity ^0.8.30;

import {ICbTokenRegistry} from '../interfaces/ICbTokenRegistry.sol';

/// Selectors routed to `CbTokenRegistryFacet`.
library CbTokenRegistryFacetSelectors {
  /// Returns every selector served by `CbTokenRegistryFacet`.
  /// @return sels Function selectors.
  function selectors() internal pure returns (bytes4[] memory sels) {
    sels = new bytes4[](11);
    sels[0] = ICbTokenRegistry.allowPaymentsForToken.selector;
    sels[1] = ICbTokenRegistry.stopPaymentsForToken.selector;
    sels[2] = ICbTokenRegistry.setTokenTransferTaxAllowed.selector;
    sels[3] = ICbTokenRegistry.setTokenPaymentLimits.selector;
    sels[4] = ICbTokenRegistry.setTokenFeeConfig.selector;
    sels[5] = ICbTokenRegistry.setTokenFeeBps.selector;
    sels[6] = ICbTokenRegistry.clearTokenFeeBps.selector;
    sels[7] = ICbTokenRegistry.setTokenMaxWithdrawalFee.selector;
    sels[8] = ICbTokenRegistry.clearTokenMaxWithdrawalFee.selector;
    sels[9] = ICbTokenRegistry.registerMatchingToken.selector;
    sels[10] = ICbTokenRegistry.unregisterMatchingToken.selector;
  }
}
