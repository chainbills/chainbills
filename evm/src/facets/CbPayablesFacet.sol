// SPDX-License-Identifier: Apache 2
pragma solidity ^0.8.30;

import {LibAccessControl} from '../access/LibAccessControl.sol';
import {ICbPayables} from '../interfaces/ICbPayables.sol';
import {CbLedger} from '../libraries/CbLedger.sol';
import {CbPayableSync} from '../libraries/CbPayableSync.sol';
import {LibAddressFormat} from '../libraries/LibAddressFormat.sol';
import {LibRelayGuard} from '../libraries/LibRelayGuard.sol';
import {LibConfigStorage} from '../storage/LibConfigStorage.sol';
import {LibPayableStorage} from '../storage/LibPayableStorage.sol';
import {LibTokenRegistryStorage} from '../storage/LibTokenRegistryStorage.sol';
import {
  FEATURE_CREATE_PAYABLE,
  FEATURE_PUBLISH_PAYABLE,
  FEATURE_UPDATE_PAYABLE,
  PAYABLE_ACTION_CLOSE,
  PAYABLE_ACTION_CREATE,
  PAYABLE_ACTION_REOPEN,
  PAYABLE_ACTION_UPDATE_ALLOWED_TOKENS_AND_AMOUNTS
} from '../types/CbConstants.sol';
import {RELAYER_ROLE} from '../types/CbRoles.sol';
import {
  ActivityType,
  Payable,
  PayablePayload,
  TokenAndAmount,
  TokenAndAmountForeign,
  TokenConfig,
  TokenPaymentLimits
} from '../types/CbTypes.sol';
import {CbFacetBase} from './CbFacetBase.sol';

/// Host-side payable management.
contract CbPayablesFacet is CbFacetBase, ICbPayables {
  using LibAddressFormat for address;

  /// @inheritdoc ICbPayables
  function createPayable(TokenAndAmount[] calldata allowedTokensAndAmounts, bool isAutoWithdraw)
    external
    payable
    nonReentrant
    whenNotPaused(FEATURE_CREATE_PAYABLE)
    returns (bytes32 payableId, uint64 wormholeSequence)
  {
    /* CHECKS */
    uint256 fee = LibRelayGuard.enforceExactBroadcastFee();
    _validateAllowedTokensAndAmounts(allowedTokensAndAmounts);

    /* STATE CHANGES */
    payableId = CbLedger.recordPayableCreation(msg.sender, isAutoWithdraw);
    _storeAllowedTokensAndAmounts(payableId, allowedTokensAndAmounts);

    /* BROADCAST */
    PayablePayload memory payload;
    payload.actionType = PAYABLE_ACTION_CREATE;
    payload.payableId = payableId;
    payload.initiatedAt = uint64(block.timestamp);
    payload.isClosed = false;
    payload.allowedTokensAndAmounts = _toForeignList(allowedTokensAndAmounts);
    wormholeSequence = CbPayableSync.broadcast(payload, fee);
  }

  /// @inheritdoc ICbPayables
  function closePayable(bytes32 payableId)
    external
    payable
    nonReentrant
    whenNotPaused(FEATURE_UPDATE_PAYABLE)
    returns (uint64 wormholeSequence)
  {
    /* CHECKS */
    Payable storage payable_ = _requireHost(payableId);
    if (payable_.isClosed) revert PayableIsAlreadyClosed();
    uint256 fee = LibRelayGuard.enforceExactBroadcastFee();

    /* STATE CHANGES */
    payable_.isClosed = true;
    CbLedger.recordPayableUpdate(payableId, ActivityType.ClosedPayable);
    emit ClosedPayable(payableId, msg.sender);

    /* BROADCAST */
    PayablePayload memory payload;
    payload.actionType = PAYABLE_ACTION_CLOSE;
    payload.payableId = payableId;
    payload.initiatedAt = uint64(block.timestamp);
    payload.isClosed = true;
    wormholeSequence = CbPayableSync.broadcast(payload, fee);
  }

  /// @inheritdoc ICbPayables
  function reopenPayable(bytes32 payableId)
    external
    payable
    nonReentrant
    whenNotPaused(FEATURE_UPDATE_PAYABLE)
    returns (uint64 wormholeSequence)
  {
    /* CHECKS */
    Payable storage payable_ = _requireHost(payableId);
    if (!payable_.isClosed) revert PayableIsNotClosed();
    uint256 fee = LibRelayGuard.enforceExactBroadcastFee();

    /* STATE CHANGES */
    payable_.isClosed = false;
    CbLedger.recordPayableUpdate(payableId, ActivityType.ReopenedPayable);
    emit ReopenedPayable(payableId, msg.sender);

    /* BROADCAST */
    PayablePayload memory payload;
    payload.actionType = PAYABLE_ACTION_REOPEN;
    payload.payableId = payableId;
    payload.initiatedAt = uint64(block.timestamp);
    payload.isClosed = false;
    wormholeSequence = CbPayableSync.broadcast(payload, fee);
  }

  /// @inheritdoc ICbPayables
  function updatePayableAllowedTokensAndAmounts(bytes32 payableId, TokenAndAmount[] calldata allowedTokensAndAmounts)
    external
    payable
    nonReentrant
    whenNotPaused(FEATURE_UPDATE_PAYABLE)
    returns (uint64 wormholeSequence)
  {
    /* CHECKS */
    _requireHost(payableId);
    uint256 fee = LibRelayGuard.enforceExactBroadcastFee();
    _validateAllowedTokensAndAmounts(allowedTokensAndAmounts);

    /* STATE CHANGES */
    delete LibPayableStorage.layout().allowedTokensAndAmounts[payableId];
    _storeAllowedTokensAndAmounts(payableId, allowedTokensAndAmounts);
    CbLedger.recordPayableUpdate(payableId, ActivityType.UpdatedPayableAllowedTokensAndAmounts);
    emit UpdatedPayableAllowedTokensAndAmounts(payableId, msg.sender);

    /* BROADCAST */
    PayablePayload memory payload;
    payload.actionType = PAYABLE_ACTION_UPDATE_ALLOWED_TOKENS_AND_AMOUNTS;
    payload.payableId = payableId;
    payload.initiatedAt = uint64(block.timestamp);
    payload.allowedTokensAndAmounts = _toForeignList(allowedTokensAndAmounts);
    wormholeSequence = CbPayableSync.broadcast(payload, fee);
  }

  /// @inheritdoc ICbPayables
  function updatePayableAutoWithdraw(bytes32 payableId, bool isAutoWithdraw)
    external
    nonReentrant
    whenNotPaused(FEATURE_UPDATE_PAYABLE)
  {
    /* CHECKS */
    Payable storage payable_ = _requireHost(payableId);

    /* STATE CHANGES */
    payable_.isAutoWithdraw = isAutoWithdraw;
    CbLedger.recordPayableUpdate(payableId, ActivityType.UpdatedPayableAutoWithdrawStatus);
    emit UpdatedPayableAutoWithdrawStatus(payableId, msg.sender, isAutoWithdraw);
  }

  /// @inheritdoc ICbPayables
  function publishPayableDetails(bytes32 payableId)
    external
    payable
    nonReentrant
    whenNotPaused(FEATURE_PUBLISH_PAYABLE)
    returns (uint64 wormholeSequence)
  {
    /* CHECKS */
    LibPayableStorage.Layout storage payables = LibPayableStorage.layout();
    Payable storage payable_ = payables.payables[payableId];
    if (payable_.host == address(0)) revert InvalidPayableId();
    if (LibConfigStorage.layout().isPublishPayableRestricted) {
      if (msg.sender != payable_.host && !LibAccessControl.hasRole(RELAYER_ROLE, msg.sender)) {
        revert PublishPayableRestricted(msg.sender);
      }
    }
    uint256 unitFee = LibRelayGuard.wormholeMessageFee();
    uint256 expected = payable_.isClosed ? unitFee * 2 : unitFee;
    if (msg.value != expected) revert IncorrectWormholeFee(msg.value, expected);

    /* BROADCAST */
    // The create wire format carries no closed flag, so a closed payable is a snapshot followed by a close.
    PayablePayload memory snapshot;
    snapshot.actionType = PAYABLE_ACTION_CREATE;
    snapshot.payableId = payableId;
    snapshot.initiatedAt = uint64(block.timestamp);
    snapshot.allowedTokensAndAmounts = _toForeignList(payables.allowedTokensAndAmounts[payableId]);
    wormholeSequence = CbPayableSync.broadcast(snapshot, unitFee);

    if (payable_.isClosed) {
      PayablePayload memory closePayload;
      closePayload.actionType = PAYABLE_ACTION_CLOSE;
      closePayload.payableId = payableId;
      closePayload.initiatedAt = uint64(block.timestamp);
      closePayload.isClosed = true;
      wormholeSequence = CbPayableSync.broadcast(closePayload, unitFee);
    }
  }

  // ---------------------------------------------------------------------------
  // Internal helpers
  // ---------------------------------------------------------------------------

  /// Returns the payable's record, requiring it exists and the caller is its host.
  function _requireHost(bytes32 payableId) private view returns (Payable storage payable_) {
    payable_ = LibPayableStorage.layout().payables[payableId];
    if (payable_.host == address(0)) revert InvalidPayableId();
    if (payable_.host != msg.sender) revert NotYourPayable();
  }

  /// Appends `list` to the payable's stored allowed tokens and amounts and sets the count.
  function _storeAllowedTokensAndAmounts(bytes32 payableId, TokenAndAmount[] calldata list) private {
    LibPayableStorage.Layout storage payables = LibPayableStorage.layout();
    TokenAndAmount[] storage stored = payables.allowedTokensAndAmounts[payableId];
    for (uint256 i; i < list.length; i++) {
      stored.push(list[i]);
    }
    payables.payables[payableId].allowedTokensAndAmountsCount = uint8(list.length);
  }

  /// Converts a local allowed-tokens list to its cross-chain wire representation.
  function _toForeignList(TokenAndAmount[] memory list) private view returns (TokenAndAmountForeign[] memory foreign) {
    foreign = new TokenAndAmountForeign[](list.length);
    for (uint256 i; i < list.length; i++) {
      foreign[i] = TokenAndAmountForeign({token: list[i].token.toBytes32(), amount: uint64(list[i].amount)});
    }
  }

  /// Validates an allowed-tokens list for creation or update: within the configured maximum, every token supported
  /// and non-zero with a non-zero amount fitting the cross-chain limit and the token's payment bounds, and no
  /// duplicate (token, amount) pair.
  function _validateAllowedTokensAndAmounts(TokenAndAmount[] calldata list) private view {
    uint256 max = LibConfigStorage.layout().maxAllowedTokensAndAmounts;
    if (list.length > max) revert TooManyAllowedTokensAndAmounts(list.length, max);
    LibTokenRegistryStorage.Layout storage tokens = LibTokenRegistryStorage.layout();
    for (uint256 i; i < list.length; i++) {
      address token = list[i].token;
      uint256 amount = list[i].amount;
      if (token == address(0)) revert InvalidTokenAddress();
      TokenConfig storage config = tokens.configs[token];
      if (!config.isSupported) revert UnsupportedToken(token);
      if (amount == 0) revert ZeroAmountSpecified();
      if (amount > type(uint64).max) revert AmountExceedsCrossChainLimit();
      TokenPaymentLimits storage limits = config.limits;
      if (limits.hasMinPaymentAmount && amount < limits.minPaymentAmount) {
        revert PaymentBelowMinimum(amount, limits.minPaymentAmount);
      }
      if (limits.hasMaxPaymentAmount && amount > limits.maxPaymentAmount) {
        revert PaymentAboveMaximum(amount, limits.maxPaymentAmount);
      }
      for (uint256 j; j < i; j++) {
        if (list[j].token == token && list[j].amount == amount) revert DuplicateTokenAndAmount();
      }
    }
  }
}
