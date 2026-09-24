// SPDX-License-Identifier: Apache 2
pragma solidity ^0.8.30;

import {ForeignChain, MatchingToken, TokenConfig, TokenDetails, TokenStats} from '../types/CbTypes.sol';

/// Foreign chain and token registry reads.
interface ICbRegistryViews {
  // ---------------------------------------------------------------------------
  // Foreign chains
  // ---------------------------------------------------------------------------

  /// Returns whether `cbChainId` is a registered foreign chain.
  function isForeignChainRegistered(bytes32 cbChainId) external view returns (bool);

  /// Returns the record of `cbChainId` (registered or previously registered).
  function getForeignChain(bytes32 cbChainId) external view returns (ForeignChain memory);

  /// Returns the number of registered foreign chains.
  function getForeignChainCount() external view returns (uint256);

  /// Returns the registered foreign chain at `index`.
  function getForeignChainIdAt(uint256 index) external view returns (bytes32);

  /// Returns every registered foreign chain identifier.
  function getForeignChainIds() external view returns (bytes32[] memory);

  /// Returns every registered foreign chain record.
  function getForeignChains() external view returns (ForeignChain[] memory);

  /// Returns the registered foreign chain with Wormhole chain ID `wormholeChainId`, or zero.
  function getForeignChainIdByWormholeChainId(uint16 wormholeChainId) external view returns (bytes32);

  /// Returns the registered foreign chain with Circle domain `circleDomain`, or zero.
  function getForeignChainIdByCircleDomain(uint32 circleDomain) external view returns (bytes32);

  // ---------------------------------------------------------------------------
  // Tokens
  // ---------------------------------------------------------------------------

  /// Returns configuration and totals of `token`.
  function getTokenDetails(address token) external view returns (TokenDetails memory);

  /// Returns configuration and totals of each token in `tokens`.
  function getTokenDetailsBulk(address[] calldata tokens) external view returns (TokenDetails[] memory);

  /// Returns the configuration of `token`.
  function getTokenConfig(address token) external view returns (TokenConfig memory);

  /// Returns the totals of `token`.
  function getTokenStats(address token) external view returns (TokenStats memory);

  /// Returns whether `token` is supported for payments.
  function isTokenSupported(address token) external view returns (bool);

  /// Returns the number of tokens an admin has configured.
  function getRegisteredTokenCount() external view returns (uint256);

  /// Returns the configured token at `index`.
  function getRegisteredTokenAt(uint256 index) external view returns (address);

  /// Returns configured tokens from `offset`, at most `limit`.
  function getRegisteredTokens(uint256 offset, uint256 limit) external view returns (address[] memory);

  /// Returns details of configured tokens from `offset`, at most `limit`.
  function getRegisteredTokenDetails(uint256 offset, uint256 limit) external view returns (TokenDetails[] memory);

  /// Returns every token currently supported for payments.
  function getSupportedTokens() external view returns (address[] memory);

  /// Returns the withdrawal fee in basis points that applies to `token` (override or global).
  function getEffectiveWithdrawalFeeBps(address token) external view returns (uint16);

  // ---------------------------------------------------------------------------
  // Matching tokens
  // ---------------------------------------------------------------------------

  /// Returns the local token matching `foreignToken` on `cbChainId`, or zero.
  function getMatchingLocalToken(bytes32 cbChainId, bytes32 foreignToken) external view returns (address);

  /// Returns the token on `cbChainId` matching `localToken`, or zero.
  function getMatchingForeignToken(address localToken, bytes32 cbChainId) external view returns (bytes32);

  /// Returns the number of matched foreign tokens on `cbChainId`.
  function getMatchingTokenCount(bytes32 cbChainId) external view returns (uint256);

  /// Returns every matched token pair on `cbChainId`.
  function getMatchingTokens(bytes32 cbChainId) external view returns (MatchingToken[] memory);
}
