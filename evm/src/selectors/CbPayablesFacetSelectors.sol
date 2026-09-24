// SPDX-License-Identifier: Apache 2
pragma solidity ^0.8.30;

import {ICbPayables} from '../interfaces/ICbPayables.sol';

/// Selectors routed to `CbPayablesFacet`.
library CbPayablesFacetSelectors {
  /// Returns every selector served by `CbPayablesFacet`.
  /// @return sels Function selectors.
  function selectors() internal pure returns (bytes4[] memory sels) {
    sels = new bytes4[](6);
    sels[0] = ICbPayables.createPayable.selector;
    sels[1] = ICbPayables.closePayable.selector;
    sels[2] = ICbPayables.reopenPayable.selector;
    sels[3] = ICbPayables.updatePayableAllowedTokensAndAmounts.selector;
    sels[4] = ICbPayables.updatePayableAutoWithdraw.selector;
    sels[5] = ICbPayables.publishPayableDetails.selector;
  }
}
