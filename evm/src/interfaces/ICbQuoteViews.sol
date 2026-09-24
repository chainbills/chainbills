// SPDX-License-Identifier: Apache 2
pragma solidity ^0.8.30;

import {WithdrawalQuote} from '../types/CbTypes.sol';

/// Pre-flight checks and quotes. Each `can...` function returns `(true, 0)` when the action would succeed on its
/// checks, or `(false, selector)` with the selector of the custom error the action would revert with.
interface ICbQuoteViews {
  /// Returns the `msg.value` required by `createPayable`, `closePayable`, `reopenPayable`, and
  /// `updatePayableAllowedTokensAndAmounts`.
  function quoteBroadcastFee() external view returns (uint256);

  /// Returns the `msg.value` required by `publishPayableDetails(payableId)`: one broadcast for an open payable, two
  /// (a snapshot followed by a close) for a closed one.
  function quotePublishPayableDetailsFee(bytes32 payableId) external view returns (uint256);

  /// Returns the fee breakdown of withdrawing `amount` of `token`.
  function quoteWithdrawalFee(address token, uint256 amount) external view returns (WithdrawalQuote memory);

  /// Returns the fee breakdown of withdrawing `amount` of `token` from `payableId`, checking the balance.
  function quoteWithdrawal(bytes32 payableId, address token, uint256 amount)
    external
    view
    returns (WithdrawalQuote memory);

  /// Checks a same-chain payment of `amount` of `token` to `payableId`.
  function canPay(bytes32 payableId, address token, uint256 amount) external view returns (bool, bytes4);

  /// Checks a cross-chain payment of `amount` of `token` with `maxFee` to foreign payable `payableId`.
  function canPayForeign(bytes32 payableId, address token, uint256 amount, uint256 maxFee)
    external
    view
    returns (bool, bytes4);

  /// Checks a withdrawal of `amount` of `token` from `payableId` by `caller`.
  function canWithdraw(bytes32 payableId, address caller, address token, uint256 amount)
    external
    view
    returns (bool, bytes4);

  /// Returns the diamond's balance of `token` above the sum of all payable balances.
  function getUntrackedBalance(address token) external view returns (uint256);
}
