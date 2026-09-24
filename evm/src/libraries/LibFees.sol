// SPDX-License-Identifier: Apache 2
pragma solidity ^0.8.30;

import {LibConfigStorage} from '../storage/LibConfigStorage.sol';
import {LibTokenRegistryStorage} from '../storage/LibTokenRegistryStorage.sol';
import {MAX_BPS} from '../types/CbConstants.sol';
import {TokenFeeConfig, WithdrawalQuote} from '../types/CbTypes.sol';

/// Withdrawal fee computation.
/// @dev The token's basis-point override applies when set, otherwise the global fee. The token's cap applies only
/// when set; an unset cap leaves the percentage uncapped.
library LibFees {
  /// Returns the basis points that apply to withdrawals of `token`.
  /// @param token Token address.
  /// @return Fee in basis points.
  function effectiveFeeBps(address token) internal view returns (uint16) {
    TokenFeeConfig storage fee = LibTokenRegistryStorage.layout().configs[token].fee;
    return fee.hasFeeBpsOverride ? fee.feeBps : LibConfigStorage.layout().withdrawalFeeBps;
  }

  /// Returns the fee breakdown of withdrawing `amount` of `token`.
  /// @param token Token address.
  /// @param amount Amount deducted from the payable balance.
  /// @return result Fee breakdown.
  function quote(address token, uint256 amount) internal view returns (WithdrawalQuote memory result) {
    TokenFeeConfig storage fee = LibTokenRegistryStorage.layout().configs[token].fee;
    result.amount = amount;
    result.feeBps = effectiveFeeBps(token);
    result.fee = (amount * result.feeBps) / MAX_BPS;
    if (fee.hasMaxWithdrawalFee && result.fee > fee.maxWithdrawalFee) {
      result.fee = fee.maxWithdrawalFee;
      result.isFeeCapped = true;
    }
    result.net = amount - result.fee;
  }
}
