// SPDX-License-Identifier: Apache 2
pragma solidity ^0.8.30;

import {LibPause} from '../access/LibPause.sol';
import {ICbPayments} from '../interfaces/ICbPayments.sol';
import {CbCctpMessaging} from '../libraries/CbCctpMessaging.sol';
import {CbLedger} from '../libraries/CbLedger.sol';
import {CbPayloadCodec} from '../libraries/CbPayloadCodec.sol';
import {LibAddressFormat} from '../libraries/LibAddressFormat.sol';
import {LibRelayGuard} from '../libraries/LibRelayGuard.sol';
import {LibTokenTransfer} from '../libraries/LibTokenTransfer.sol';
import {LibConfigStorage} from '../storage/LibConfigStorage.sol';
import {LibForeignPayableStorage} from '../storage/LibForeignPayableStorage.sol';
import {LibMessagingStorage} from '../storage/LibMessagingStorage.sol';
import {LibPayableStorage} from '../storage/LibPayableStorage.sol';
import {LibTokenRegistryStorage} from '../storage/LibTokenRegistryStorage.sol';
import {LibUserStorage} from '../storage/LibUserStorage.sol';
import {
  FEATURE_AUTO_WITHDRAW,
  FEATURE_PAY,
  FEATURE_PAY_FOREIGN,
  FEATURE_RECEIVE_FOREIGN_PAYMENT,
  MAX_BPS,
  PAYMENT_ACTION_PAY,
  PAYMENT_PAYLOAD_TYPE,
  PAYLOAD_VERSION
} from '../types/CbConstants.sol';
import {
  CctpBurnMessage,
  ForeignChain,
  Payable,
  PayableForeign,
  PaymentPayload,
  TokenAndAmount,
  TokenAndAmountForeign,
  TokenConfig,
  TokenPaymentLimits
} from '../types/CbTypes.sol';
import {CbFacetBase} from './CbFacetBase.sol';

/// Same-chain and cross-chain payments.
contract CbPaymentsFacet is CbFacetBase, ICbPayments {
  using LibAddressFormat for address;
  using LibAddressFormat for bytes32;

  /// @inheritdoc ICbPayments
  function pay(bytes32 payableId, address token, uint256 amount, uint256 maxAmountIn)
    external
    payable
    nonReentrant
    whenNotPaused(FEATURE_PAY)
    returns (bytes32 userPaymentId, bytes32 payablePaymentId)
  {
    /* CHECKS */
    TokenConfig storage config = _sharedChecks(token, amount);
    LibPayableStorage.Layout storage payablesStorage = LibPayableStorage.layout();
    Payable storage payable_ = payablesStorage.payables[payableId];
    if (payable_.host == address(0)) revert InvalidPayableId();
    if (payable_.isClosed) revert PayableIsClosed();
    if (payable_.allowedTokensAndAmountsCount != 0) {
      _requireAllowedTokenAndAmount(payablesStorage.allowedTokensAndAmounts[payableId], token, amount);
    }
    if (maxAmountIn < amount) revert InvalidMaxAmountIn(maxAmountIn, amount);
    if (maxAmountIn > amount && !config.isTransferTaxAllowed) revert TransferTaxNotAllowed(token);

    /* TRANSFER */
    uint256 received;
    uint256 debited;
    if (LibTokenTransfer.isNative(token)) {
      if (msg.value != amount || maxAmountIn != amount) revert IncorrectNativeValue(msg.value, amount);
      received = amount;
      debited = amount;
    } else {
      if (msg.value != 0) revert IncorrectNativeValue(msg.value, 0);
      received = LibTokenTransfer.pullMeasured(token, msg.sender, maxAmountIn);
      if (received < amount) revert TransferTaxExceededBuffer(received, amount);
      if (!config.isTransferTaxAllowed && received != maxAmountIn) {
        revert UnexpectedAmountReceived(received, maxAmountIn);
      }
      debited = maxAmountIn;
    }

    /* STATE CHANGES */
    bytes32 cbChainId = LibConfigStorage.layout().cbChainId;
    userPaymentId = CbLedger.recordUserPayment(msg.sender, payableId, cbChainId, token, amount, debited);
    payablePaymentId = CbLedger.recordPayablePayment(
      payableId, msg.sender.toBytes32(), cbChainId, token, amount, received, userPaymentId
    );
    _autoWithdrawIfNeeded(payable_, payableId, token, received);
  }

  /// @inheritdoc ICbPayments
  function payForeignViaCctp(bytes32 payableId, address token, uint256 amount, uint256 maxFee)
    external
    nonReentrant
    whenNotPaused(FEATURE_PAY_FOREIGN)
    returns (bytes32 userPaymentId)
  {
    /* CHECKS */
    LibRelayGuard.enforceCctpEnabled();
    if (LibTokenTransfer.isNative(token)) revert NativeTokenNotBridgeable();
    _sharedChecks(token, amount);
    if (amount > type(uint64).max) revert AmountExceedsCrossChainLimit();

    LibForeignPayableStorage.Layout storage foreignPayables = LibForeignPayableStorage.layout();
    PayableForeign storage foreignPayable = foreignPayables.foreignPayables[payableId];
    bytes32 chainId = foreignPayable.chainId;
    if (chainId == bytes32(0)) revert InvalidPayableId();
    if (foreignPayable.isClosed) revert PayableIsClosed();

    ForeignChain storage chain = LibRelayGuard.registeredChain(chainId);
    if (!chain.config.switches.isOutboundPaymentEnabled) revert OutboundPaymentsDisabled(chainId);
    if (!chain.config.protocolIds.hasCircleDomain) revert ForeignChainHasNoCircleDomain(chainId);
    if (chain.config.limits.hasMaxOutboundCctpFeeBps) {
      uint256 limit = (amount * chain.config.limits.maxOutboundCctpFeeBps) / MAX_BPS;
      if (maxFee > limit) revert CctpMaxFeeTooHigh(maxFee, limit);
    }

    LibTokenRegistryStorage.Layout storage tokens = LibTokenRegistryStorage.layout();
    bytes32 foreignToken = tokens.foreignTokenByLocalToken[token][chainId];
    if (foreignToken == bytes32(0)) revert MatchingTokenNotFound(chainId, bytes32(0));
    if (foreignPayable.allowedTokensAndAmountsCount != 0) {
      _requireAllowedForeignTokenAndAmount(
        foreignPayables.allowedTokensAndAmounts[payableId], tokens, chainId, token, amount
      );
    }

    /* TRANSFER */
    uint256 burnAmount = amount + maxFee;
    uint256 received = LibTokenTransfer.pullMeasured(token, msg.sender, burnAmount);
    if (received != burnAmount) revert UnexpectedAmountReceived(received, burnAmount);

    /* STATE CHANGES */
    LibConfigStorage.Layout storage config = LibConfigStorage.layout();
    userPaymentId = CbLedger.recordUserPayment(msg.sender, payableId, chainId, token, amount, burnAmount);
    uint64 nonce = uint64(LibUserStorage.layout().users[msg.sender].paymentsCount);
    PaymentPayload memory payload = PaymentPayload({
      payloadType: PAYMENT_PAYLOAD_TYPE,
      version: PAYLOAD_VERSION,
      actionType: PAYMENT_ACTION_PAY,
      payableId: payableId,
      nonce: nonce,
      initiatedAt: uint64(block.timestamp),
      amount: uint64(amount),
      payableChainToken: foreignToken,
      payableChainId: chainId,
      payer: msg.sender.toBytes32(),
      payerChainToken: token.toBytes32(),
      payerChainId: config.cbChainId,
      payerPaymentId: userPaymentId
    });

    /* MESSAGE */
    uint32 finality =
      CbCctpMessaging.burnWithPayment(chainId, token, amount, maxFee, CbPayloadCodec.encodePaymentPayload(payload));
    emit SentForeignPaymentViaCctp(payableId, chainId, userPaymentId, nonce, burnAmount, maxFee, finality);
  }

  /// @inheritdoc ICbPayments
  function receiveForeignPaymentViaCctp(bytes calldata burnMessage, bytes calldata attestation)
    external
    nonReentrant
    whenNotPaused(FEATURE_RECEIVE_FOREIGN_PAYMENT)
    onlyPermittedRelayer
    returns (bytes32 payablePaymentId)
  {
    /* CHECKS */
    (PaymentPayload memory payload, CctpBurnMessage memory burn, bytes32 src) =
      CbCctpMessaging.verifyInboundPayment(burnMessage);
    bytes32 payableId = payload.payableId;
    Payable storage payable_ = LibPayableStorage.layout().payables[payableId];
    if (payable_.host == address(0)) revert InvalidPayableId();

    LibMessagingStorage.Layout storage messaging = LibMessagingStorage.layout();
    uint32 sourceDomain = burn.header.sourceDomain;
    bytes32 burnNonce = burn.header.nonce;
    if (messaging.isCctpBurnNonceConsumed[sourceDomain][burnNonce]) {
      revert CctpBurnNonceAlreadyConsumed(sourceDomain, burnNonce);
    }
    if (messaging.isPaymentNonceConsumed[src][payload.payer][payload.nonce]) {
      revert PaymentNonceAlreadyConsumed(src, payload.payer, payload.nonce);
    }

    /* STATE CHANGES */
    messaging.isCctpBurnNonceConsumed[sourceDomain][burnNonce] = true;
    messaging.isPaymentNonceConsumed[src][payload.payer][payload.nonce] = true;

    /* TRANSFER */
    address token = payload.payableChainToken.toAddress();
    uint256 balanceBefore = LibTokenTransfer.balanceOfSelf(token);
    CbCctpMessaging.receiveMessage(burnMessage, attestation);
    uint256 minted = LibTokenTransfer.balanceOfSelf(token) - balanceBefore;
    if (minted < payload.amount) revert CircleMintedLessThanAmount(minted, payload.amount);

    /* STATE CHANGES */
    payablePaymentId = CbLedger.recordPayablePayment(
      payableId, payload.payer, src, token, payload.amount, minted, payload.payerPaymentId
    );
    messaging.cctpStats.receivedCctpPaymentMessagesCount++;
    emit ReceivedForeignPaymentViaCctp(
      payableId, src, payablePaymentId, burnNonce, minted, burn.header.finalityThresholdExecuted
    );
    _autoWithdrawIfNeeded(payable_, payableId, token, minted);
  }

  // ---------------------------------------------------------------------------
  // Internal helpers
  // ---------------------------------------------------------------------------

  /// Runs the checks shared by every payment path: token supported and within its payment limits.
  function _sharedChecks(address token, uint256 amount) private view returns (TokenConfig storage config) {
    if (token == address(0)) revert InvalidTokenAddress();
    config = LibTokenRegistryStorage.layout().configs[token];
    if (!config.isSupported) revert UnsupportedToken(token);
    if (amount == 0) revert ZeroAmountSpecified();
    TokenPaymentLimits storage limits = config.limits;
    if (limits.hasMinPaymentAmount && amount < limits.minPaymentAmount) {
      revert PaymentBelowMinimum(amount, limits.minPaymentAmount);
    }
    if (limits.hasMaxPaymentAmount && amount > limits.maxPaymentAmount) {
      revert PaymentAboveMaximum(amount, limits.maxPaymentAmount);
    }
  }

  /// Reverts unless (`token`, `amount`) is one of the payable's allowed tokens and amounts.
  function _requireAllowedTokenAndAmount(TokenAndAmount[] storage allowed, address token, uint256 amount) private view {
    uint256 length = allowed.length;
    for (uint256 i; i < length; i++) {
      if (allowed[i].token == token && allowed[i].amount == amount) return;
    }
    revert MatchingTokenAndAmountNotFound();
  }

  /// Reverts unless one allowed entry's local match equals `token` with a matching `amount`.
  function _requireAllowedForeignTokenAndAmount(
    TokenAndAmountForeign[] storage allowed,
    LibTokenRegistryStorage.Layout storage tokens,
    bytes32 chainId,
    address token,
    uint256 amount
  ) private view {
    uint256 length = allowed.length;
    for (uint256 i; i < length; i++) {
      if (tokens.localTokenByForeignToken[chainId][allowed[i].token] == token && allowed[i].amount == amount) {
        return;
      }
    }
    revert MatchingTokenAndAmountNotFound();
  }

  /// Withdraws `amount` of `token` to the host when the payable auto-withdraws, or emits a skip when the feature is
  /// paused.
  function _autoWithdrawIfNeeded(Payable storage payable_, bytes32 payableId, address token, uint256 amount) private {
    if (!payable_.isAutoWithdraw) return;
    if (LibPause.isFeaturePaused(FEATURE_AUTO_WITHDRAW)) {
      emit AutoWithdrawSkipped(payableId, token, amount);
    } else {
      CbLedger.withdraw(payableId, token, amount);
    }
  }
}
