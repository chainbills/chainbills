// SPDX-License-Identifier: Apache 2
pragma solidity ^0.8.30;

import {TokenFeeConfig, TokenPaymentLimits} from '../types/CbTypes.sol';

/// Token support, limits, fees, and foreign token matching.
interface ICbTokenRegistry {
  /// Allows payments in `token`. Caller must hold `TOKEN_MANAGER_ROLE`.
  /// @param token Token address, or the diamond address for the native token.
  function allowPaymentsForToken(address token) external;

  /// Stops new payments in `token`. Existing balances stay withdrawable. Caller must hold `TOKEN_MANAGER_ROLE`.
  /// @param token Token address.
  function stopPaymentsForToken(address token) external;

  /// Allows or forbids incoming transfers of `token` that deliver less than pulled. Caller must hold `TOKEN_MANAGER_ROLE`.
  /// @param token Token address.
  /// @param isTransferTaxAllowed New policy.
  function setTokenTransferTaxAllowed(address token, bool isTransferTaxAllowed) external;

  /// Sets payment amount limits of `token`. Caller must hold `TOKEN_MANAGER_ROLE`.
  /// @param token Token address.
  /// @param limits New limits.
  function setTokenPaymentLimits(address token, TokenPaymentLimits calldata limits) external;

  /// Sets the full withdrawal fee configuration of `token`. Caller must hold `FEE_MANAGER_ROLE`.
  /// @param token Token address.
  /// @param fee New fee configuration.
  function setTokenFeeConfig(address token, TokenFeeConfig calldata fee) external;

  /// Overrides the withdrawal fee of `token`. Caller must hold `FEE_MANAGER_ROLE`.
  /// @param token Token address.
  /// @param feeBps Fee in basis points, at most 10_000. Zero makes withdrawals of the token free.
  function setTokenFeeBps(address token, uint16 feeBps) external;

  /// Removes the fee override of `token`, falling back to the global fee. Caller must hold `FEE_MANAGER_ROLE`.
  /// @param token Token address.
  function clearTokenFeeBps(address token) external;

  /// Caps the withdrawal fee of `token`. Caller must hold `FEE_MANAGER_ROLE`.
  /// @param token Token address.
  /// @param maxWithdrawalFee Largest fee per withdrawal. Zero makes withdrawals of the token free.
  function setTokenMaxWithdrawalFee(address token, uint256 maxWithdrawalFee) external;

  /// Removes the fee cap of `token`. Caller must hold `FEE_MANAGER_ROLE`.
  /// @param token Token address.
  function clearTokenMaxWithdrawalFee(address token) external;

  /// Maps `foreignToken` on `cbChainId` to `localToken`, replacing any previous match of either side.
  /// Caller must hold `TOKEN_MANAGER_ROLE`.
  /// @param cbChainId CAIP-2 chain identifier of a registered foreign chain.
  /// @param foreignToken Token on the foreign chain in 32-byte format.
  /// @param localToken Matching token on this chain.
  function registerMatchingToken(bytes32 cbChainId, bytes32 foreignToken, address localToken) external;

  /// Removes the match of `foreignToken` on `cbChainId`. Caller must hold `TOKEN_MANAGER_ROLE`.
  /// @param cbChainId CAIP-2 chain identifier.
  /// @param foreignToken Token on the foreign chain in 32-byte format.
  function unregisterMatchingToken(bytes32 cbChainId, bytes32 foreignToken) external;
}
