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
    // outer: payableId(p), token(p), amount(p), maxAmountIn(p), userPaymentId(ret), payablePaymentId(ret),
    //        received, debited = 8 slots across all phases.
    uint256 received;
    uint256 debited;

    // Phase 1: checks. 8 outer + config, payablesStorage, payable_ = 11 simultaneous slots.
    {
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
    }

    // Phase 2: transfer. 8 outer + config(re-read for transfer-tax guard) = 9 simultaneous slots.
    {
      TokenConfig storage config = LibTokenRegistryStorage.layout().configs[token];
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
    }

    // Phase 3: state changes. 8 outer + cbChainId, payable_(re-read) = 10 simultaneous slots.
    // Deepest arg in the 6/7-arg record calls reaches DUP13 at most, within limits.
    {
      bytes32 cbChainId = LibConfigStorage.layout().cbChainId;
      Payable storage payable_ = LibPayableStorage.layout().payables[payableId];
      userPaymentId = CbLedger.recordUserPayment(msg.sender, payableId, cbChainId, token, amount, debited);
      payablePaymentId = CbLedger.recordPayablePayment(
        payableId, msg.sender.toBytes32(), cbChainId, token, amount, received, userPaymentId
      );
      _autoWithdrawIfNeeded(payable_, payableId, token, received);
    }
  }

  /// @inheritdoc ICbPayments
  function payForeignViaCctp(bytes32 payableId, address token, uint256 amount, uint256 maxFee)
    external
    nonReentrant
    whenNotPaused(FEATURE_PAY_FOREIGN)
    returns (bytes32 userPaymentId)
  {
    // outer: payableId(p), token(p), amount(p), maxFee(p), userPaymentId(ret),
    //        chainId, burnAmount, nonce, finality = 9 slots across all phases.
    bytes32 chainId;
    uint256 burnAmount;
    uint64 nonce;
    uint32 finality;

    // Phase 1a: payable + chain validation, capture chainId.
    // 9 outer + foreignPayables, foreignPayable, chain = 12 simultaneous slots.
    {
      LibRelayGuard.enforceCctpEnabled();
      if (LibTokenTransfer.isNative(token)) revert NativeTokenNotBridgeable();
      _sharedChecks(token, amount);
      if (amount > type(uint64).max) revert AmountExceedsCrossChainLimit();

      LibForeignPayableStorage.Layout storage foreignPayables = LibForeignPayableStorage.layout();
      PayableForeign storage foreignPayable = foreignPayables.foreignPayables[payableId];
      chainId = foreignPayable.chainId;
      if (chainId == bytes32(0)) revert InvalidPayableId();
      if (foreignPayable.isClosed) revert PayableIsClosed();

      ForeignChain storage chain = LibRelayGuard.registeredChain(chainId);
      if (!chain.config.switches.isOutboundPaymentEnabled) revert OutboundPaymentsDisabled(chainId);
      if (!chain.config.protocolIds.hasCircleDomain) revert ForeignChainHasNoCircleDomain(chainId);
      if (chain.config.limits.hasMaxOutboundCctpFeeBps) {
        uint256 limit = (amount * chain.config.limits.maxOutboundCctpFeeBps) / MAX_BPS;
        if (maxFee > limit) revert CctpMaxFeeTooHigh(maxFee, limit);
      }
    }

    // Phase 1b: token validation. foreignPayable and chain freed; 9 outer + foreignPayables, tokens = 11 total.
    // The 5-arg _requireAllowedForeignTokenAndAmount call's deepest arg reaches DUP14 at most.
    {
      LibForeignPayableStorage.Layout storage foreignPayables = LibForeignPayableStorage.layout();
      LibTokenRegistryStorage.Layout storage tokens = LibTokenRegistryStorage.layout();
      if (tokens.foreignTokenByLocalToken[token][chainId] == bytes32(0)) revert MatchingTokenNotFound(chainId, bytes32(0));
      if (foreignPayables.foreignPayables[payableId].allowedTokensAndAmountsCount != 0) {
        _requireAllowedForeignTokenAndAmount(
          foreignPayables.allowedTokensAndAmounts[payableId], tokens, chainId, token, amount
        );
      }
    }

    // Phase 2: transfer. 9 outer + received = 10 total.
    {
      burnAmount = amount + maxFee;
      uint256 received = LibTokenTransfer.pullMeasured(token, msg.sender, burnAmount);
      if (received != burnAmount) revert UnexpectedAmountReceived(received, burnAmount);
    }

    // Phase 3: state changes + message. 9 outer + payload = 10 total.
    {
      userPaymentId = CbLedger.recordUserPayment(msg.sender, payableId, chainId, token, amount, burnAmount);
      nonce = uint64(LibUserStorage.layout().users[msg.sender].paymentsCount);
      PaymentPayload memory payload = PaymentPayload({
        payloadType: PAYMENT_PAYLOAD_TYPE,
        version: PAYLOAD_VERSION,
        actionType: PAYMENT_ACTION_PAY,
        payableId: payableId,
        nonce: nonce,
        initiatedAt: uint64(block.timestamp),
        // forge-lint: disable-next-line(unsafe-typecast)
        amount: uint64(amount),
        payableChainToken: LibTokenRegistryStorage.layout().foreignTokenByLocalToken[token][chainId],
        payableChainId: chainId,
        payer: msg.sender.toBytes32(),
        payerChainToken: token.toBytes32(),
        payerChainId: LibConfigStorage.layout().cbChainId,
        payerPaymentId: userPaymentId
      });
      finality = CbCctpMessaging.burnWithPayment(chainId, token, amount, maxFee, CbPayloadCodec.encodePaymentPayload(payload));
    }

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
    // `bytes calldata` params each occupy 2 stack slots (offset + length).
    // outer: burnMessage(2), attestation(2), payablePaymentId(ret,1), payload(1), burn(1), src(1), token(1), minted(1)
    // = 10 slots across all phases.
    PaymentPayload memory payload;
    CctpBurnMessage memory burn;
    bytes32 src;
    address token;
    uint256 minted;

    // Phase 1: decode, validate payable, check and mark nonces.
    // 10 outer + payable_, messaging = 12 simultaneous slots.
    {
      (payload, burn, src) = CbCctpMessaging.verifyInboundPayment(burnMessage);
      Payable storage payable_ = LibPayableStorage.layout().payables[payload.payableId];
      if (payable_.host == address(0)) revert InvalidPayableId();
      LibMessagingStorage.Layout storage messaging = LibMessagingStorage.layout();
      if (messaging.isCctpBurnNonceConsumed[burn.header.sourceDomain][burn.header.nonce]) {
        revert CctpBurnNonceAlreadyConsumed(burn.header.sourceDomain, burn.header.nonce);
      }
      if (messaging.isPaymentNonceConsumed[src][payload.payer][payload.nonce]) {
        revert PaymentNonceAlreadyConsumed(src, payload.payer, payload.nonce);
      }
      messaging.isCctpBurnNonceConsumed[burn.header.sourceDomain][burn.header.nonce] = true;
      messaging.isPaymentNonceConsumed[src][payload.payer][payload.nonce] = true;
    }

    // Phase 2: receive minted tokens. 10 outer + balanceBefore = 11 simultaneous slots;
    // burnMessage sits at DUP12 during the receiveMessage call, well within limits.
    {
      token = payload.payableChainToken.toAddress();
      uint256 balanceBefore = LibTokenTransfer.balanceOfSelf(token);
      CbCctpMessaging.receiveMessage(burnMessage, attestation);
      minted = LibTokenTransfer.balanceOfSelf(token) - balanceBefore;
      if (minted < payload.amount) revert CircleMintedLessThanAmount(minted, payload.amount);
    }

    // Phase 3: record, emit, auto-withdraw. 10 outer + payable_(re-read) = 11 simultaneous slots.
    {
      payablePaymentId = CbLedger.recordPayablePayment(
        payload.payableId, payload.payer, src, token, payload.amount, minted, payload.payerPaymentId
      );
      LibMessagingStorage.layout().cctpStats.receivedCctpPaymentMessagesCount++;
      emit ReceivedForeignPaymentViaCctp(
        payload.payableId, src, payablePaymentId, burn.header.nonce, minted, burn.header.finalityThresholdExecuted
      );
      Payable storage payable_ = LibPayableStorage.layout().payables[payload.payableId];
      _autoWithdrawIfNeeded(payable_, payload.payableId, token, minted);
    }
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
