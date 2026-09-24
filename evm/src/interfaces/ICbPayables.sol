// SPDX-License-Identifier: Apache 2
pragma solidity ^0.8.30;

import {TokenAndAmount} from '../types/CbTypes.sol';

/// Host-side payable management. Every state change is broadcast to foreign chains.
/// @dev Broadcasting functions are payable: when Wormhole is enabled, `msg.value` must equal the
/// Wormhole message fee; otherwise it must be zero.
interface ICbPayables {
  /// Creates a payable hosted by the caller.
  /// @param allowedTokensAndAmounts Accepted tokens and exact amounts. Empty accepts any supported token and amount.
  /// @param isAutoWithdraw Whether each payment is withdrawn to the host immediately.
  /// @return payableId ID of the new payable.
  /// @return wormholeSequence Sequence of the published Wormhole message, or zero.
  function createPayable(TokenAndAmount[] calldata allowedTokensAndAmounts, bool isAutoWithdraw)
    external
    payable
    returns (bytes32 payableId, uint64 wormholeSequence);

  /// Stops a payable from accepting payments. Only the host can call this.
  /// @param payableId Payable ID.
  /// @return wormholeSequence Sequence of the published Wormhole message, or zero.
  function closePayable(bytes32 payableId) external payable returns (uint64 wormholeSequence);

  /// Lets a closed payable accept payments again. Only the host can call this.
  /// @param payableId Payable ID.
  /// @return wormholeSequence Sequence of the published Wormhole message, or zero.
  function reopenPayable(bytes32 payableId) external payable returns (uint64 wormholeSequence);

  /// Replaces the allowed tokens and amounts of a payable. Only the host can call this.
  /// @param payableId Payable ID.
  /// @param allowedTokensAndAmounts New allowed tokens and amounts. Empty accepts any supported token and amount.
  /// @return wormholeSequence Sequence of the published Wormhole message, or zero.
  function updatePayableAllowedTokensAndAmounts(bytes32 payableId, TokenAndAmount[] calldata allowedTokensAndAmounts)
    external
    payable
    returns (uint64 wormholeSequence);

  /// Turns automatic withdrawal on or off. Only the host can call this. Not broadcast.
  /// @param payableId Payable ID.
  /// @param isAutoWithdraw New setting.
  function updatePayableAutoWithdraw(bytes32 payableId, bool isAutoWithdraw) external;

  /// Rebroadcasts the full state of a payable (for chains registered after the payable changed). A closed payable is
  /// broadcast as a snapshot followed by a close, so `msg.value` covers two Wormhole messages.
  /// @param payableId Payable ID.
  /// @return wormholeSequence Sequence of the last published Wormhole message, or zero.
  /// @dev Open to anyone unless publishing is restricted, in which case the host or a `RELAYER_ROLE` holder.
  function publishPayableDetails(bytes32 payableId) external payable returns (uint64 wormholeSequence);
}
