// SPDX-License-Identifier: Apache 2
pragma solidity ^0.8.30;

import {ICbPayments} from '../interfaces/ICbPayments.sol';
import {CbFacetBase} from './CbFacetBase.sol';

contract CbPaymentsFacet is CbFacetBase, ICbPayments {
  function pay(bytes32 payableId, address token, uint256 amount, uint256 maxAmountIn)
    external
    payable
    returns (bytes32 userPaymentId, bytes32 payablePaymentId)
  {
    revert('unimplemented');
  }

  function payForeignViaCctp(bytes32 payableId, address token, uint256 amount, uint256 maxFee)
    external
    returns (bytes32 userPaymentId)
  {
    revert('unimplemented');
  }

  function receiveForeignPaymentViaCctp(bytes calldata burnMessage, bytes calldata attestation)
    external
    returns (bytes32 payablePaymentId)
  {
    revert('unimplemented');
  }
}
