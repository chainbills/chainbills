// SPDX-License-Identifier: Apache 2
pragma solidity ^0.8.30;

import {ICbPayments} from '../interfaces/ICbPayments.sol';

/// Selectors routed to `CbPaymentsFacet`.
library CbPaymentsFacetSelectors {
  /// Returns every selector served by `CbPaymentsFacet`.
  /// @return sels Function selectors.
  function selectors() internal pure returns (bytes4[] memory sels) {
    sels = new bytes4[](3);
    sels[0] = ICbPayments.pay.selector;
    sels[1] = ICbPayments.payForeignViaCctp.selector;
    sels[2] = ICbPayments.receiveForeignPaymentViaCctp.selector;
  }
}
