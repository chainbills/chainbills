// SPDX-License-Identifier: Apache 2
pragma solidity ^0.8.30;

import {ICbWithdrawals} from '../interfaces/ICbWithdrawals.sol';

/// Selectors routed to `CbWithdrawalsFacet`.
library CbWithdrawalsFacetSelectors {
  /// Returns every selector served by `CbWithdrawalsFacet`.
  /// @return sels Function selectors.
  function selectors() internal pure returns (bytes4[] memory sels) {
    sels = new bytes4[](3);
    sels[0] = ICbWithdrawals.withdraw.selector;
    sels[1] = ICbWithdrawals.withdrawAll.selector;
    sels[2] = ICbWithdrawals.rescueUntrackedBalance.selector;
  }
}
