// SPDX-License-Identifier: Apache 2
pragma solidity ^0.8.30;

import {Payable, TokenAndAmount} from '../types/CbTypes.sol';

/// Payables hosted on this chain.
/// @dev Append new fields at the end only.
library LibPayableStorage {
  /// @custom:storage-location erc7201:chainbills.payables
  struct Layout {
    /// Every local payable, in creation order.
    bytes32[] payableIds;
    /// Payable records by ID.
    mapping(bytes32 payableId => Payable) payables;
    /// Allowed tokens and amounts of each payable.
    mapping(bytes32 payableId => TokenAndAmount[]) allowedTokensAndAmounts;
    /// Tokens ever credited to each payable, in first-credit order.
    mapping(bytes32 payableId => address[]) balanceTokens;
    /// Balance of each payable in each token.
    mapping(bytes32 payableId => mapping(address token => uint256)) balances;
    /// Payable payments received by each payable.
    mapping(bytes32 payableId => bytes32[]) payablePaymentIds;
    /// Payable payments received by each payable from each chain.
    mapping(bytes32 payableId => mapping(bytes32 cbChainId => bytes32[])) payableChainPaymentIds;
    /// Withdrawals from each payable.
    mapping(bytes32 payableId => bytes32[]) payableWithdrawalIds;
    /// Activities of each payable.
    mapping(bytes32 payableId => bytes32[]) payableActivityIds;
    /// Whether a token is in the payable's balance token list.
    mapping(bytes32 payableId => mapping(address token => bool)) isBalanceToken;
  }

  /// keccak256(abi.encode(uint256(keccak256('chainbills.payables')) - 1)) & ~bytes32(uint256(0xff))
  bytes32 internal constant STORAGE_SLOT = 0x50f19e9703d1f8b626d6ec937cbdfa0dd4fd4d23f17b7886a8cad1714810d600;

  /// Returns the storage pointer.
  /// @return $ Storage pointer.
  function layout() internal pure returns (Layout storage $) {
    bytes32 slot = STORAGE_SLOT;
    assembly {
      $.slot := slot
    }
  }
}
