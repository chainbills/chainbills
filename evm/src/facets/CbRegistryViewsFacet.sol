// SPDX-License-Identifier: Apache 2
pragma solidity ^0.8.30;

import {ICbRegistryViews} from '../interfaces/ICbRegistryViews.sol';
import {ForeignChain, MatchingToken, TokenConfig, TokenDetails, TokenStats} from '../types/CbTypes.sol';
import {CbFacetBase} from './CbFacetBase.sol';

contract CbRegistryViewsFacet is CbFacetBase, ICbRegistryViews {
  function isForeignChainRegistered(bytes32 cbChainId) external view returns (bool) {
    revert('unimplemented');
  }

  function getForeignChain(bytes32 cbChainId) external view returns (ForeignChain memory) {
    revert('unimplemented');
  }

  function getForeignChainCount() external view returns (uint256) {
    revert('unimplemented');
  }

  function getForeignChainIdAt(uint256 index) external view returns (bytes32) {
    revert('unimplemented');
  }

  function getForeignChainIds() external view returns (bytes32[] memory) {
    revert('unimplemented');
  }

  function getForeignChains() external view returns (ForeignChain[] memory) {
    revert('unimplemented');
  }

  function getForeignChainIdByWormholeChainId(uint16 wormholeChainId) external view returns (bytes32) {
    revert('unimplemented');
  }

  function getForeignChainIdByCircleDomain(uint32 circleDomain) external view returns (bytes32) {
    revert('unimplemented');
  }

  function getTokenDetails(address token) external view returns (TokenDetails memory) {
    revert('unimplemented');
  }

  function getTokenDetailsBulk(address[] calldata tokens) external view returns (TokenDetails[] memory) {
    revert('unimplemented');
  }

  function getTokenConfig(address token) external view returns (TokenConfig memory) {
    revert('unimplemented');
  }

  function getTokenStats(address token) external view returns (TokenStats memory) {
    revert('unimplemented');
  }

  function isTokenSupported(address token) external view returns (bool) {
    revert('unimplemented');
  }

  function getRegisteredTokenCount() external view returns (uint256) {
    revert('unimplemented');
  }

  function getRegisteredTokenAt(uint256 index) external view returns (address) {
    revert('unimplemented');
  }

  function getRegisteredTokens(uint256 offset, uint256 limit) external view returns (address[] memory) {
    revert('unimplemented');
  }

  function getRegisteredTokenDetails(uint256 offset, uint256 limit) external view returns (TokenDetails[] memory) {
    revert('unimplemented');
  }

  function getSupportedTokens() external view returns (address[] memory) {
    revert('unimplemented');
  }

  function getEffectiveWithdrawalFeeBps(address token) external view returns (uint16) {
    revert('unimplemented');
  }

  function getMatchingLocalToken(bytes32 cbChainId, bytes32 foreignToken) external view returns (address) {
    revert('unimplemented');
  }

  function getMatchingForeignToken(address localToken, bytes32 cbChainId) external view returns (bytes32) {
    revert('unimplemented');
  }

  function getMatchingTokenCount(bytes32 cbChainId) external view returns (uint256) {
    revert('unimplemented');
  }

  function getMatchingTokens(bytes32 cbChainId) external view returns (MatchingToken[] memory) {
    revert('unimplemented');
  }
}
