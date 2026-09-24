// SPDX-License-Identifier: Apache 2
pragma solidity ^0.8.30;

import {ICbPayables} from '../interfaces/ICbPayables.sol';
import {TokenAndAmount} from '../types/CbTypes.sol';
import {CbFacetBase} from './CbFacetBase.sol';

contract CbPayablesFacet is CbFacetBase, ICbPayables {
  function createPayable(TokenAndAmount[] calldata allowedTokensAndAmounts, bool isAutoWithdraw)
    external
    payable
    returns (bytes32 payableId, uint64 wormholeSequence)
  {
    revert('unimplemented');
  }

  function closePayable(bytes32 payableId) external payable returns (uint64 wormholeSequence) {
    revert('unimplemented');
  }

  function reopenPayable(bytes32 payableId) external payable returns (uint64 wormholeSequence) {
    revert('unimplemented');
  }

  function updatePayableAllowedTokensAndAmounts(bytes32 payableId, TokenAndAmount[] calldata allowedTokensAndAmounts)
    external
    payable
    returns (uint64 wormholeSequence)
  {
    revert('unimplemented');
  }

  function updatePayableAutoWithdraw(bytes32 payableId, bool isAutoWithdraw) external {
    revert('unimplemented');
  }

  function publishPayableDetails(bytes32 payableId) external payable returns (uint64 wormholeSequence) {
    revert('unimplemented');
  }
}
