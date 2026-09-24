// SPDX-License-Identifier: Apache 2
pragma solidity ^0.8.30;

import {EnumerableSet} from '@openzeppelin/contracts/utils/structs/EnumerableSet.sol';
import {ICbRegistryViews} from '../interfaces/ICbRegistryViews.sol';
import {CbPagination} from '../libraries/CbPagination.sol';
import {LibFees} from '../libraries/LibFees.sol';
import {LibChainRegistryStorage} from '../storage/LibChainRegistryStorage.sol';
import {LibTokenRegistryStorage} from '../storage/LibTokenRegistryStorage.sol';
import {ForeignChain, MatchingToken, TokenConfig, TokenDetails, TokenStats} from '../types/CbTypes.sol';
import {CbFacetBase} from './CbFacetBase.sol';

/// Foreign chain and token registry reads.
contract CbRegistryViewsFacet is CbFacetBase, ICbRegistryViews {
  using EnumerableSet for EnumerableSet.AddressSet;
  using EnumerableSet for EnumerableSet.Bytes32Set;

  // ---------------------------------------------------------------------------
  // Foreign chains
  // ---------------------------------------------------------------------------

  /// @inheritdoc ICbRegistryViews
  function isForeignChainRegistered(bytes32 cbChainId) external view returns (bool) {
    return LibChainRegistryStorage.layout().chains[cbChainId].isRegistered;
  }

  /// @inheritdoc ICbRegistryViews
  function getForeignChain(bytes32 cbChainId) external view returns (ForeignChain memory) {
    return LibChainRegistryStorage.layout().chains[cbChainId];
  }

  /// @inheritdoc ICbRegistryViews
  function getForeignChainCount() external view returns (uint256) {
    return LibChainRegistryStorage.layout().registeredChainIds.length();
  }

  /// @inheritdoc ICbRegistryViews
  function getForeignChainIdAt(uint256 index) external view returns (bytes32) {
    return LibChainRegistryStorage.layout().registeredChainIds.at(index);
  }

  /// @inheritdoc ICbRegistryViews
  function getForeignChainIds() external view returns (bytes32[] memory) {
    return LibChainRegistryStorage.layout().registeredChainIds.values();
  }

  /// @inheritdoc ICbRegistryViews
  function getForeignChains() external view returns (ForeignChain[] memory chains) {
    LibChainRegistryStorage.Layout storage $ = LibChainRegistryStorage.layout();
    bytes32[] memory ids = $.registeredChainIds.values();
    chains = new ForeignChain[](ids.length);
    for (uint256 i; i < ids.length; i++) {
      chains[i] = $.chains[ids[i]];
    }
  }

  /// @inheritdoc ICbRegistryViews
  function getForeignChainIdByWormholeChainId(uint16 wormholeChainId) external view returns (bytes32) {
    return LibChainRegistryStorage.layout().chainIdByWormholeChainId[wormholeChainId];
  }

  /// @inheritdoc ICbRegistryViews
  function getForeignChainIdByCircleDomain(uint32 circleDomain) external view returns (bytes32) {
    return LibChainRegistryStorage.layout().chainIdByCircleDomain[circleDomain];
  }

  // ---------------------------------------------------------------------------
  // Tokens
  // ---------------------------------------------------------------------------

  /// @inheritdoc ICbRegistryViews
  function getTokenDetails(address token) external view returns (TokenDetails memory) {
    return _tokenDetails(token);
  }

  /// @inheritdoc ICbRegistryViews
  function getTokenDetailsBulk(address[] calldata tokens) external view returns (TokenDetails[] memory details) {
    details = new TokenDetails[](tokens.length);
    for (uint256 i; i < tokens.length; i++) {
      details[i] = _tokenDetails(tokens[i]);
    }
  }

  /// @inheritdoc ICbRegistryViews
  function getTokenConfig(address token) external view returns (TokenConfig memory) {
    return LibTokenRegistryStorage.layout().configs[token];
  }

  /// @inheritdoc ICbRegistryViews
  function getTokenStats(address token) external view returns (TokenStats memory) {
    return LibTokenRegistryStorage.layout().stats[token];
  }

  /// @inheritdoc ICbRegistryViews
  function isTokenSupported(address token) external view returns (bool) {
    return LibTokenRegistryStorage.layout().configs[token].isSupported;
  }

  /// @inheritdoc ICbRegistryViews
  function getRegisteredTokenCount() external view returns (uint256) {
    return LibTokenRegistryStorage.layout().registeredTokens.length();
  }

  /// @inheritdoc ICbRegistryViews
  function getRegisteredTokenAt(uint256 index) external view returns (address) {
    return LibTokenRegistryStorage.layout().registeredTokens.at(index);
  }

  /// @inheritdoc ICbRegistryViews
  function getRegisteredTokens(uint256 offset, uint256 limit) external view returns (address[] memory tokens) {
    EnumerableSet.AddressSet storage registered = LibTokenRegistryStorage.layout().registeredTokens;
    (uint256 start, uint256 count) = CbPagination.ascendingBounds(registered.length(), offset, limit);
    tokens = new address[](count);
    for (uint256 i; i < count; i++) {
      tokens[i] = registered.at(start + i);
    }
  }

  /// @inheritdoc ICbRegistryViews
  function getRegisteredTokenDetails(uint256 offset, uint256 limit)
    external
    view
    returns (TokenDetails[] memory details)
  {
    EnumerableSet.AddressSet storage registered = LibTokenRegistryStorage.layout().registeredTokens;
    (uint256 start, uint256 count) = CbPagination.ascendingBounds(registered.length(), offset, limit);
    details = new TokenDetails[](count);
    for (uint256 i; i < count; i++) {
      details[i] = _tokenDetails(registered.at(start + i));
    }
  }

  /// @inheritdoc ICbRegistryViews
  function getSupportedTokens() external view returns (address[] memory tokens) {
    LibTokenRegistryStorage.Layout storage $ = LibTokenRegistryStorage.layout();
    uint256 total = $.registeredTokens.length();
    uint256 count;
    for (uint256 i; i < total; i++) {
      if ($.configs[$.registeredTokens.at(i)].isSupported) count++;
    }
    tokens = new address[](count);
    uint256 j;
    for (uint256 i; i < total; i++) {
      address token = $.registeredTokens.at(i);
      if ($.configs[token].isSupported) {
        tokens[j] = token;
        j++;
      }
    }
  }

  /// @inheritdoc ICbRegistryViews
  function getEffectiveWithdrawalFeeBps(address token) external view returns (uint16) {
    return LibFees.effectiveFeeBps(token);
  }

  // ---------------------------------------------------------------------------
  // Matching tokens
  // ---------------------------------------------------------------------------

  /// @inheritdoc ICbRegistryViews
  function getMatchingLocalToken(bytes32 cbChainId, bytes32 foreignToken) external view returns (address) {
    return LibTokenRegistryStorage.layout().localTokenByForeignToken[cbChainId][foreignToken];
  }

  /// @inheritdoc ICbRegistryViews
  function getMatchingForeignToken(address localToken, bytes32 cbChainId) external view returns (bytes32) {
    return LibTokenRegistryStorage.layout().foreignTokenByLocalToken[localToken][cbChainId];
  }

  /// @inheritdoc ICbRegistryViews
  function getMatchingTokenCount(bytes32 cbChainId) external view returns (uint256) {
    return LibTokenRegistryStorage.layout().matchedForeignTokens[cbChainId].length();
  }

  /// @inheritdoc ICbRegistryViews
  function getMatchingTokens(bytes32 cbChainId) external view returns (MatchingToken[] memory matches) {
    LibTokenRegistryStorage.Layout storage $ = LibTokenRegistryStorage.layout();
    bytes32[] memory foreignTokens = $.matchedForeignTokens[cbChainId].values();
    matches = new MatchingToken[](foreignTokens.length);
    for (uint256 i; i < foreignTokens.length; i++) {
      matches[i] = MatchingToken({
        foreignToken: foreignTokens[i], localToken: $.localTokenByForeignToken[cbChainId][foreignTokens[i]]
      });
    }
  }

  /// Builds the full view of `token`.
  function _tokenDetails(address token) private view returns (TokenDetails memory) {
    LibTokenRegistryStorage.Layout storage $ = LibTokenRegistryStorage.layout();
    return TokenDetails({
      token: token, isRegistered: $.registeredTokens.contains(token), config: $.configs[token], stats: $.stats[token]
    });
  }
}
