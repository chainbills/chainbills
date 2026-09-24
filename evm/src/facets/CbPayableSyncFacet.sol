// SPDX-License-Identifier: Apache 2
pragma solidity ^0.8.30;

import {ICbPayableSync} from '../interfaces/ICbPayableSync.sol';
import {TokenAndAmountForeign} from '../types/CbTypes.sol';
import {CbFacetBase} from './CbFacetBase.sol';

contract CbPayableSyncFacet is CbFacetBase, ICbPayableSync {
  function receivePayableUpdateViaWormhole(bytes calldata encodedVaa) external {
    revert('unimplemented');
  }

  function receivePayableUpdateViaCctp(bytes calldata message, bytes calldata attestation) external {
    revert('unimplemented');
  }

  function adminSyncForeignPayable(
    bytes32 payableId,
    bytes32 cbChainId,
    uint64 nonce,
    uint64 initiatedAt,
    uint8 actionType,
    bool isClosed,
    TokenAndAmountForeign[] calldata allowedTokensAndAmounts
  ) external {
    revert('unimplemented');
  }

  function handleReceiveFinalizedMessage(
    uint32 sourceDomain,
    bytes32 sender,
    uint32 finalityThresholdExecuted,
    bytes calldata messageBody
  ) external returns (bool) {
    revert('unimplemented');
  }

  function handleReceiveUnfinalizedMessage(
    uint32 sourceDomain,
    bytes32 sender,
    uint32 finalityThresholdExecuted,
    bytes calldata messageBody
  ) external returns (bool) {
    revert('unimplemented');
  }
}
