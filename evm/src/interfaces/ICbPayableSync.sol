// SPDX-License-Identifier: Apache 2
pragma solidity ^0.8.30;

import {TokenAndAmountForeign} from '../types/CbTypes.sol';
import {IMessageHandlerV2} from './circle/IMessageHandlerV2.sol';

/// Inbound payable updates from foreign chains.
/// @dev Submission functions require `RELAYER_ROLE` while relaying is restricted.
interface ICbPayableSync is IMessageHandlerV2 {
  /// Applies a payable update carried in a Wormhole VAA.
  /// @param encodedVaa Signed Wormhole VAA.
  function receivePayableUpdateViaWormhole(bytes calldata encodedVaa) external;

  /// Submits a CCTP data message carrying a payable update. Circle's transmitter verifies the attestation and calls
  /// back `handleReceiveFinalizedMessage` or `handleReceiveUnfinalizedMessage`, which applies the update.
  /// @param message CCTP V2 message.
  /// @param attestation Circle attestation.
  function receivePayableUpdateViaCctp(bytes calldata message, bytes calldata attestation) external;

  /// Applies foreign payable state directly. Caller must hold `PAYABLE_SYNC_ROLE`. Nonce ordering still applies.
  /// @param payableId Payable ID on the hosting chain.
  /// @param cbChainId CAIP-2 chain identifier of the hosting chain.
  /// @param nonce Update nonce; must exceed the last applied nonce.
  /// @param initiatedAt Timestamp of the update on the hosting chain.
  /// @param actionType 1 create/snapshot, 2 close, 3 reopen, 4 update allowed tokens and amounts.
  /// @param isClosed Closed status (applied for action types 1, 2, and 3).
  /// @param allowedTokensAndAmounts Allowed tokens and amounts (applied for action types 1 and 4).
  function adminSyncForeignPayable(
    bytes32 payableId,
    bytes32 cbChainId,
    uint64 nonce,
    uint64 initiatedAt,
    uint8 actionType,
    bool isClosed,
    TokenAndAmountForeign[] calldata allowedTokensAndAmounts
  ) external;
}
