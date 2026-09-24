// SPDX-License-Identifier: Apache 2
pragma solidity ^0.8.30;

import {ICbPaymentViews} from '../interfaces/ICbPaymentViews.sol';

/// Selectors routed to `CbPaymentViewsFacet`.
library CbPaymentViewsFacetSelectors {
  /// Returns every selector served by `CbPaymentViewsFacet`.
  /// @return sels Function selectors.
  function selectors() internal pure returns (bytes4[] memory sels) {
    sels = new bytes4[](34);
    sels[0] = ICbPaymentViews.getUserPayment.selector;
    sels[1] = ICbPaymentViews.getUserPaymentsBulk.selector;
    sels[2] = ICbPaymentViews.getChainUserPaymentCount.selector;
    sels[3] = ICbPaymentViews.getChainUserPaymentIdAt.selector;
    sels[4] = ICbPaymentViews.getChainUserPaymentIds.selector;
    sels[5] = ICbPaymentViews.getChainUserPaymentIdsDesc.selector;
    sels[6] = ICbPaymentViews.getChainUserPayments.selector;
    sels[7] = ICbPaymentViews.getChainUserPaymentsDesc.selector;
    sels[8] = ICbPaymentViews.getUserPaymentCount.selector;
    sels[9] = ICbPaymentViews.getUserPaymentIdAt.selector;
    sels[10] = ICbPaymentViews.getUserPaymentIds.selector;
    sels[11] = ICbPaymentViews.getUserPaymentIdsDesc.selector;
    sels[12] = ICbPaymentViews.getUserPayments.selector;
    sels[13] = ICbPaymentViews.getUserPaymentsDesc.selector;
    sels[14] = ICbPaymentViews.getPayablePayment.selector;
    sels[15] = ICbPaymentViews.getPayablePaymentsBulk.selector;
    sels[16] = ICbPaymentViews.getChainPayablePaymentCount.selector;
    sels[17] = ICbPaymentViews.getChainPayablePaymentIdAt.selector;
    sels[18] = ICbPaymentViews.getChainPayablePaymentIds.selector;
    sels[19] = ICbPaymentViews.getChainPayablePaymentIdsDesc.selector;
    sels[20] = ICbPaymentViews.getChainPayablePayments.selector;
    sels[21] = ICbPaymentViews.getChainPayablePaymentsDesc.selector;
    sels[22] = ICbPaymentViews.getPayablePaymentCount.selector;
    sels[23] = ICbPaymentViews.getPayablePaymentIdAt.selector;
    sels[24] = ICbPaymentViews.getPayablePaymentIds.selector;
    sels[25] = ICbPaymentViews.getPayablePaymentIdsDesc.selector;
    sels[26] = ICbPaymentViews.getPayablePayments.selector;
    sels[27] = ICbPaymentViews.getPayablePaymentsDesc.selector;
    sels[28] = ICbPaymentViews.getPayableChainPaymentCount.selector;
    sels[29] = ICbPaymentViews.getPayableChainPaymentIdAt.selector;
    sels[30] = ICbPaymentViews.getPayableChainPaymentIds.selector;
    sels[31] = ICbPaymentViews.getPayableChainPaymentIdsDesc.selector;
    sels[32] = ICbPaymentViews.getPayableChainPayments.selector;
    sels[33] = ICbPaymentViews.getPayableChainPaymentsDesc.selector;
  }
}
