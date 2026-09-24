// SPDX-License-Identifier: Apache 2
pragma solidity ^0.8.30;

import {EnumerableSet} from '@openzeppelin/contracts/utils/structs/EnumerableSet.sol';
import {ICbTokenRegistry} from '../interfaces/ICbTokenRegistry.sol';
import {LibChainRegistryStorage} from '../storage/LibChainRegistryStorage.sol';
import {LibTokenRegistryStorage} from '../storage/LibTokenRegistryStorage.sol';
import {MAX_BPS} from '../types/CbConstants.sol';
import {FEE_MANAGER_ROLE, TOKEN_MANAGER_ROLE} from '../types/CbRoles.sol';
import {TokenConfig, TokenFeeConfig, TokenPaymentLimits} from '../types/CbTypes.sol';
import {CbFacetBase} from './CbFacetBase.sol';

/// Token support, limits, fees, and foreign token matching.
contract CbTokenRegistryFacet is CbFacetBase, ICbTokenRegistry {
  using EnumerableSet for EnumerableSet.AddressSet;
  using EnumerableSet for EnumerableSet.Bytes32Set;

  /// @inheritdoc ICbTokenRegistry
  function allowPaymentsForToken(address token) external onlyRole(TOKEN_MANAGER_ROLE) {
    _config(token).isSupported = true;
    emit TokenPaymentsAllowed(token);
  }

  /// @inheritdoc ICbTokenRegistry
  function stopPaymentsForToken(address token) external onlyRole(TOKEN_MANAGER_ROLE) {
    _config(token).isSupported = false;
    emit TokenPaymentsStopped(token);
  }

  /// @inheritdoc ICbTokenRegistry
  function setTokenTransferTaxAllowed(address token, bool isTransferTaxAllowed) external onlyRole(TOKEN_MANAGER_ROLE) {
    _config(token).isTransferTaxAllowed = isTransferTaxAllowed;
    emit TokenTransferTaxAllowanceUpdated(token, isTransferTaxAllowed);
  }

  /// @inheritdoc ICbTokenRegistry
  function setTokenPaymentLimits(address token, TokenPaymentLimits calldata limits)
    external
    onlyRole(TOKEN_MANAGER_ROLE)
  {
    if (limits.hasMinPaymentAmount && limits.hasMaxPaymentAmount && limits.minPaymentAmount > limits.maxPaymentAmount) {
      revert InvalidPaymentLimits();
    }
    _config(token).limits = limits;
    emit TokenPaymentLimitsUpdated(token, limits);
  }

  /// @inheritdoc ICbTokenRegistry
  function setTokenFeeConfig(address token, TokenFeeConfig calldata fee) external onlyRole(FEE_MANAGER_ROLE) {
    if (fee.feeBps > MAX_BPS) revert InvalidFeeBps(fee.feeBps);
    TokenConfig storage config = _config(token);
    config.fee = fee;
    emit TokenFeeConfigUpdated(token, config.fee);
  }

  /// @inheritdoc ICbTokenRegistry
  function setTokenFeeBps(address token, uint16 feeBps) external onlyRole(FEE_MANAGER_ROLE) {
    if (feeBps > MAX_BPS) revert InvalidFeeBps(feeBps);
    TokenConfig storage config = _config(token);
    config.fee.hasFeeBpsOverride = true;
    config.fee.feeBps = feeBps;
    emit TokenFeeConfigUpdated(token, config.fee);
  }

  /// @inheritdoc ICbTokenRegistry
  function clearTokenFeeBps(address token) external onlyRole(FEE_MANAGER_ROLE) {
    TokenConfig storage config = _config(token);
    config.fee.hasFeeBpsOverride = false;
    config.fee.feeBps = 0;
    emit TokenFeeConfigUpdated(token, config.fee);
  }

  /// @inheritdoc ICbTokenRegistry
  function setTokenMaxWithdrawalFee(address token, uint256 maxWithdrawalFee) external onlyRole(FEE_MANAGER_ROLE) {
    TokenConfig storage config = _config(token);
    config.fee.hasMaxWithdrawalFee = true;
    config.fee.maxWithdrawalFee = maxWithdrawalFee;
    emit TokenFeeConfigUpdated(token, config.fee);
  }

  /// @inheritdoc ICbTokenRegistry
  function clearTokenMaxWithdrawalFee(address token) external onlyRole(FEE_MANAGER_ROLE) {
    TokenConfig storage config = _config(token);
    config.fee.hasMaxWithdrawalFee = false;
    config.fee.maxWithdrawalFee = 0;
    emit TokenFeeConfigUpdated(token, config.fee);
  }

  /// @inheritdoc ICbTokenRegistry
  function registerMatchingToken(bytes32 cbChainId, bytes32 foreignToken, address localToken)
    external
    onlyRole(TOKEN_MANAGER_ROLE)
  {
    /* CHECKS */
    if (!LibChainRegistryStorage.layout().chains[cbChainId].isRegistered) revert ForeignChainNotRegistered(cbChainId);
    if (foreignToken == bytes32(0)) revert InvalidForeignToken();
    if (localToken == address(0)) revert InvalidTokenAddress();
    LibTokenRegistryStorage.Layout storage tokens = LibTokenRegistryStorage.layout();

    /* STATE CHANGES */
    // Drop the previous match of each side so the mapping stays one-to-one in both directions.
    address previousLocal = tokens.localTokenByForeignToken[cbChainId][foreignToken];
    if (previousLocal != address(0) && previousLocal != localToken) {
      delete tokens.foreignTokenByLocalToken[previousLocal][cbChainId];
      emit MatchingTokenUnregistered(cbChainId, foreignToken, previousLocal);
    }
    bytes32 previousForeign = tokens.foreignTokenByLocalToken[localToken][cbChainId];
    if (previousForeign != bytes32(0) && previousForeign != foreignToken) {
      delete tokens.localTokenByForeignToken[cbChainId][previousForeign];
      tokens.matchedForeignTokens[cbChainId].remove(previousForeign);
      emit MatchingTokenUnregistered(cbChainId, previousForeign, localToken);
    }

    // Store the new match.
    tokens.localTokenByForeignToken[cbChainId][foreignToken] = localToken;
    tokens.foreignTokenByLocalToken[localToken][cbChainId] = foreignToken;
    tokens.matchedForeignTokens[cbChainId].add(foreignToken);
    emit MatchingTokenRegistered(cbChainId, foreignToken, localToken);
  }

  /// @inheritdoc ICbTokenRegistry
  function unregisterMatchingToken(bytes32 cbChainId, bytes32 foreignToken) external onlyRole(TOKEN_MANAGER_ROLE) {
    LibTokenRegistryStorage.Layout storage tokens = LibTokenRegistryStorage.layout();
    address localToken = tokens.localTokenByForeignToken[cbChainId][foreignToken];
    if (localToken == address(0)) revert MatchingTokenNotFound(cbChainId, foreignToken);
    delete tokens.localTokenByForeignToken[cbChainId][foreignToken];
    delete tokens.foreignTokenByLocalToken[localToken][cbChainId];
    tokens.matchedForeignTokens[cbChainId].remove(foreignToken);
    emit MatchingTokenUnregistered(cbChainId, foreignToken, localToken);
  }

  /// Returns the configuration of `token`, registering the token on first use.
  function _config(address token) private returns (TokenConfig storage) {
    if (token == address(0)) revert InvalidTokenAddress();
    LibTokenRegistryStorage.Layout storage tokens = LibTokenRegistryStorage.layout();
    tokens.registeredTokens.add(token);
    return tokens.configs[token];
  }
}
