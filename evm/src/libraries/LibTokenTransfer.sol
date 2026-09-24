// SPDX-License-Identifier: Apache 2
pragma solidity ^0.8.30;

import {IERC20} from '@openzeppelin/contracts/token/ERC20/IERC20.sol';
import {SafeERC20} from '@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol';
import {ICbErrors} from '../interfaces/ICbErrors.sol';

/// Token movements into and out of the diamond. The diamond's own address stands for the native token.
library LibTokenTransfer {
  using SafeERC20 for IERC20;

  /// Returns whether `token` denotes the native token.
  /// @param token Token address.
  /// @return True for the native token.
  function isNative(address token) internal view returns (bool) {
    return token == address(this);
  }

  /// Returns the diamond's balance of `token`.
  /// @param token Token address, or the diamond address for the native token.
  /// @return Balance.
  function balanceOfSelf(address token) internal view returns (uint256) {
    return isNative(token) ? address(this).balance : IERC20(token).balanceOf(address(this));
  }

  /// Pulls `amount` of ERC-20 `token` from `from` and returns what actually arrived.
  /// @param token ERC-20 token.
  /// @param from Payer.
  /// @param amount Amount to pull.
  /// @return received Increase of the diamond's balance.
  function pullMeasured(address token, address from, uint256 amount) internal returns (uint256 received) {
    uint256 balanceBefore = IERC20(token).balanceOf(address(this));
    IERC20(token).safeTransferFrom(from, address(this), amount);
    received = IERC20(token).balanceOf(address(this)) - balanceBefore;
  }

  /// Sends `amount` of `token` to `to`. Zero amounts are skipped.
  /// @param token Token address, or the diamond address for the native token.
  /// @param to Recipient.
  /// @param amount Amount to send.
  function push(address token, address to, uint256 amount) internal {
    if (amount == 0) return;
    if (isNative(token)) {
      (bool success,) = payable(to).call{value: amount}('');
      if (!success) revert ICbErrors.NativeTransferFailed(to, amount);
    } else {
      IERC20(token).safeTransfer(to, amount);
    }
  }
}
