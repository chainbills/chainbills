// SPDX-License-Identifier: Apache 2
pragma solidity ^0.8.30;

/// Host withdrawals and untracked balance rescue.
interface ICbWithdrawals {
  /// Withdraws `amount` of `token` from a payable to its host, minus the withdrawal fee.
  /// @param payableId Payable ID.
  /// @param token Token address, or the diamond address for the native token.
  /// @param amount Amount deducted from the payable balance.
  /// @return withdrawalId ID of the withdrawal.
  function withdraw(bytes32 payableId, address token, uint256 amount) external returns (bytes32 withdrawalId);

  /// Withdraws the full balance of `token` from a payable to its host, minus the withdrawal fee.
  /// @param payableId Payable ID.
  /// @param token Token address, or the diamond address for the native token.
  /// @return withdrawalId ID of the withdrawal.
  function withdrawAll(bytes32 payableId, address token) external returns (bytes32 withdrawalId);

  /// Sends the diamond's balance of `token` above the sum of all payable balances to `to`.
  /// Caller must hold `RESCUER_ROLE`.
  /// @param token Token address, or the diamond address for the native token.
  /// @param to Recipient.
  /// @return amount Amount sent.
  function rescueUntrackedBalance(address token, address to) external returns (uint256 amount);
}
