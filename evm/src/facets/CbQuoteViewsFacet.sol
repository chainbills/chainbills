// SPDX-License-Identifier: Apache 2
pragma solidity ^0.8.30;

import {LibPause} from '../access/LibPause.sol';
import {ICbQuoteViews} from '../interfaces/ICbQuoteViews.sol';
import {LibFees} from '../libraries/LibFees.sol';
import {LibRelayGuard} from '../libraries/LibRelayGuard.sol';
import {LibTokenTransfer} from '../libraries/LibTokenTransfer.sol';
import {LibChainRegistryStorage} from '../storage/LibChainRegistryStorage.sol';
import {LibForeignPayableStorage} from '../storage/LibForeignPayableStorage.sol';
import {LibPayableStorage} from '../storage/LibPayableStorage.sol';
import {LibTokenRegistryStorage} from '../storage/LibTokenRegistryStorage.sol';
import {FEATURE_PAY, FEATURE_PAY_FOREIGN, FEATURE_WITHDRAW, MAX_BPS} from '../types/CbConstants.sol';
import {
  ForeignChain,
  Payable,
  PayableForeign,
  TokenAndAmount,
  TokenAndAmountForeign,
  TokenConfig,
  WithdrawalQuote
} from '../types/CbTypes.sol';
import {CbFacetBase} from './CbFacetBase.sol';

/// Pre-flight checks and quotes.
contract CbQuoteViewsFacet is CbFacetBase, ICbQuoteViews {
  /// @inheritdoc ICbQuoteViews
  function quoteBroadcastFee() external view returns (uint256) {
    return LibRelayGuard.wormholeMessageFee();
  }

  /// @inheritdoc ICbQuoteViews
  function quotePublishPayableDetailsFee(bytes32 payableId) external view returns (uint256) {
    uint256 fee = LibRelayGuard.wormholeMessageFee();
    bool isClosed = LibPayableStorage.layout().payables[payableId].isClosed;
    return isClosed ? fee * 2 : fee;
  }

  /// @inheritdoc ICbQuoteViews
  function quoteWithdrawalFee(address token, uint256 amount) external view returns (WithdrawalQuote memory) {
    return LibFees.quote(token, amount);
  }

  /// @inheritdoc ICbQuoteViews
  function quoteWithdrawal(bytes32, address token, uint256 amount) external view returns (WithdrawalQuote memory) {
    return LibFees.quote(token, amount);
  }

  /// @inheritdoc ICbQuoteViews
  function canPay(bytes32 payableId, address token, uint256 amount) external view returns (bool, bytes4) {
    bytes4 pauseFailure = _pauseFailure(FEATURE_PAY);
    if (pauseFailure != bytes4(0)) return (false, pauseFailure);

    if (token == address(0)) return (false, InvalidTokenAddress.selector);
    TokenConfig storage config = LibTokenRegistryStorage.layout().configs[token];
    if (!config.isSupported) return (false, UnsupportedToken.selector);
    if (amount == 0) return (false, ZeroAmountSpecified.selector);
    if (config.limits.hasMinPaymentAmount && amount < config.limits.minPaymentAmount) {
      return (false, PaymentBelowMinimum.selector);
    }
    if (config.limits.hasMaxPaymentAmount && amount > config.limits.maxPaymentAmount) {
      return (false, PaymentAboveMaximum.selector);
    }

    Payable storage payable_ = LibPayableStorage.layout().payables[payableId];
    if (payable_.host == address(0)) return (false, InvalidPayableId.selector);
    if (payable_.isClosed) return (false, PayableIsClosed.selector);

    if (payable_.allowedTokensAndAmountsCount != 0) {
      TokenAndAmount[] storage allowed = LibPayableStorage.layout().allowedTokensAndAmounts[payableId];
      if (!_hasMatch(allowed, token, amount)) return (false, MatchingTokenAndAmountNotFound.selector);
    }

    return (true, bytes4(0));
  }

  /// @inheritdoc ICbQuoteViews
  function canPayForeign(bytes32 payableId, address token, uint256 amount, uint256 maxFee)
    external
    view
    returns (bool, bytes4)
  {
    bytes4 pauseFailure = _pauseFailure(FEATURE_PAY_FOREIGN);
    if (pauseFailure != bytes4(0)) return (false, pauseFailure);
    if (!LibRelayGuard.isCctpActive()) return (false, CctpNotEnabled.selector);
    if (token == address(this)) return (false, NativeTokenNotBridgeable.selector);
    if (token == address(0)) return (false, InvalidTokenAddress.selector);

    LibTokenRegistryStorage.Layout storage tokens = LibTokenRegistryStorage.layout();
    TokenConfig storage config = tokens.configs[token];
    if (!config.isSupported) return (false, UnsupportedToken.selector);
    if (amount == 0) return (false, ZeroAmountSpecified.selector);
    if (config.limits.hasMinPaymentAmount && amount < config.limits.minPaymentAmount) {
      return (false, PaymentBelowMinimum.selector);
    }
    if (config.limits.hasMaxPaymentAmount && amount > config.limits.maxPaymentAmount) {
      return (false, PaymentAboveMaximum.selector);
    }
    if (amount > type(uint64).max) return (false, AmountExceedsCrossChainLimit.selector);

    PayableForeign storage foreignPayable = LibForeignPayableStorage.layout().foreignPayables[payableId];
    if (foreignPayable.chainId == bytes32(0)) return (false, InvalidPayableId.selector);
    if (foreignPayable.isClosed) return (false, PayableIsClosed.selector);

    ForeignChain storage chain = LibChainRegistryStorage.layout().chains[foreignPayable.chainId];
    if (!chain.isRegistered) return (false, ForeignChainNotRegistered.selector);
    if (!chain.config.switches.isOutboundPaymentEnabled) return (false, OutboundPaymentsDisabled.selector);
    if (!chain.config.protocolIds.hasCircleDomain) return (false, ForeignChainHasNoCircleDomain.selector);

    if (chain.config.limits.hasMaxOutboundCctpFeeBps) {
      uint256 limit = (amount * chain.config.limits.maxOutboundCctpFeeBps) / MAX_BPS;
      if (maxFee > limit) return (false, CctpMaxFeeTooHigh.selector);
    }

    bytes32 foreignToken = tokens.foreignTokenByLocalToken[token][foreignPayable.chainId];
    if (foreignToken == bytes32(0)) return (false, MatchingTokenNotFound.selector);

    if (foreignPayable.allowedTokensAndAmountsCount != 0) {
      TokenAndAmountForeign[] storage allowed = LibForeignPayableStorage.layout().allowedTokensAndAmounts[payableId];
      if (!_hasForeignMatch(allowed, tokens, foreignPayable.chainId, token, amount)) {
        return (false, MatchingTokenAndAmountNotFound.selector);
      }
    }

    return (true, bytes4(0));
  }

  /// @inheritdoc ICbQuoteViews
  function canWithdraw(bytes32 payableId, address caller, address token, uint256 amount)
    external
    view
    returns (bool, bytes4)
  {
    bytes4 pauseFailure = _pauseFailure(FEATURE_WITHDRAW);
    if (pauseFailure != bytes4(0)) return (false, pauseFailure);

    LibPayableStorage.Layout storage $ = LibPayableStorage.layout();
    Payable storage payable_ = $.payables[payableId];
    if (payable_.host == address(0)) return (false, InvalidPayableId.selector);
    if (payable_.host != caller) return (false, NotYourPayable.selector);
    if (amount == 0) return (false, ZeroAmountSpecified.selector);
    if (!$.isBalanceToken[payableId][token]) return (false, NoBalanceForWithdrawalToken.selector);
    if ($.balances[payableId][token] < amount) return (false, InsufficientWithdrawAmount.selector);

    return (true, bytes4(0));
  }

  /// @inheritdoc ICbQuoteViews
  function getUntrackedBalance(address token) external view returns (uint256) {
    uint256 balance = LibTokenTransfer.balanceOfSelf(token);
    uint256 tracked = LibTokenRegistryStorage.layout().stats[token].totalPayableBalance;
    return balance > tracked ? balance - tracked : 0;
  }

  /// Returns the pause-related failure selector for `feature`, or zero when not paused.
  function _pauseFailure(uint256 feature) private view returns (bytes4) {
    LibPause.Layout storage $ = LibPause.layout();
    if ($.isPaused) return EnforcedPause.selector;
    if (($.pausedFeatures & feature) != 0) return FeaturePaused.selector;
    return bytes4(0);
  }

  /// Returns whether `allowed` contains an entry matching `token` and `amount`.
  function _hasMatch(TokenAndAmount[] storage allowed, address token, uint256 amount) private view returns (bool) {
    for (uint256 i; i < allowed.length; i++) {
      if (allowed[i].token == token && allowed[i].amount == amount) return true;
    }
    return false;
  }

  /// Returns whether `allowed` contains a foreign entry whose local match is `token` at `amount`.
  function _hasForeignMatch(
    TokenAndAmountForeign[] storage allowed,
    LibTokenRegistryStorage.Layout storage tokens,
    bytes32 cbChainId,
    address token,
    uint256 amount
  ) private view returns (bool) {
    for (uint256 i; i < allowed.length; i++) {
      if (tokens.localTokenByForeignToken[cbChainId][allowed[i].token] == token && uint256(allowed[i].amount) == amount)
      {
        return true;
      }
    }
    return false;
  }
}
