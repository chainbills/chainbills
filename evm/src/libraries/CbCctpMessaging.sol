// SPDX-License-Identifier: Apache 2
pragma solidity ^0.8.30;

import {IERC20} from '@openzeppelin/contracts/token/ERC20/IERC20.sol';
import {SafeERC20} from '@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol';
import {BytesParsing} from 'wormhole/libraries/BytesParsing.sol';
import {ICbErrors} from '../interfaces/ICbErrors.sol';
import {IMessageTransmitterV2} from '../interfaces/circle/IMessageTransmitterV2.sol';
import {ITokenMessengerV2} from '../interfaces/circle/ITokenMessengerV2.sol';
import {ITokenMinterV2} from '../interfaces/circle/ITokenMinterV2.sol';
import {LibConfigStorage} from '../storage/LibConfigStorage.sol';
import {LibMessagingStorage} from '../storage/LibMessagingStorage.sol';
import {CctpPayableUpdateEmission} from '../types/CbTypes.sol';
import {
  CCTP_BURN_AMOUNT_OFFSET,
  CCTP_BURN_TOKEN_OFFSET,
  CCTP_DESTINATION_CALLER_OFFSET,
  CCTP_DESTINATION_DOMAIN_OFFSET,
  CCTP_EXPIRATION_BLOCK_OFFSET,
  CCTP_FEE_EXECUTED_OFFSET,
  CCTP_FINALITY_THRESHOLD_EXECUTED_OFFSET,
  CCTP_HOOK_DATA_OFFSET,
  CCTP_MAX_FEE_OFFSET,
  CCTP_MESSAGE_BODY_OFFSET,
  CCTP_MESSAGE_SENDER_OFFSET,
  CCTP_MIN_FINALITY_THRESHOLD_OFFSET,
  CCTP_MINT_RECIPIENT_OFFSET,
  CCTP_NONCE_OFFSET,
  CCTP_RECIPIENT_OFFSET,
  CCTP_SENDER_OFFSET,
  CCTP_SOURCE_DOMAIN_OFFSET
} from '../types/CbConstants.sol';
import {CctpBurnMessage, CctpMessageHeader, ForeignChain, PaymentPayload} from '../types/CbTypes.sol';
import {CbPayloadCodec} from './CbPayloadCodec.sol';
import {LibAddressFormat} from './LibAddressFormat.sol';
import {LibRelayGuard} from './LibRelayGuard.sol';

/// Circle CCTP V2 message parsing, sending, burning, and inbound payment verification. Linked library.
library CbCctpMessaging {
  using BytesParsing for bytes;
  using LibAddressFormat for address;
  using LibAddressFormat for bytes32;
  using SafeERC20 for IERC20;

  // ---------------------------------------------------------------------------
  // Parsing
  // ---------------------------------------------------------------------------

  /// Parses the header of a CCTP V2 message.
  /// @param message CCTP V2 message.
  /// @return header Parsed header.
  function parseMessageHeader(bytes memory message) public pure returns (CctpMessageHeader memory header) {
    if (message.length < CCTP_MESSAGE_BODY_OFFSET) revert ICbErrors.InvalidCctpMessageLength(message.length);
    (header.version,) = message.asUint32(0);
    (header.sourceDomain,) = message.asUint32(CCTP_SOURCE_DOMAIN_OFFSET);
    (header.destinationDomain,) = message.asUint32(CCTP_DESTINATION_DOMAIN_OFFSET);
    (header.nonce,) = message.asBytes32(CCTP_NONCE_OFFSET);
    (header.sender,) = message.asBytes32(CCTP_SENDER_OFFSET);
    (header.recipient,) = message.asBytes32(CCTP_RECIPIENT_OFFSET);
    (header.destinationCaller,) = message.asBytes32(CCTP_DESTINATION_CALLER_OFFSET);
    (header.minFinalityThreshold,) = message.asUint32(CCTP_MIN_FINALITY_THRESHOLD_OFFSET);
    (header.finalityThresholdExecuted,) = message.asUint32(CCTP_FINALITY_THRESHOLD_EXECUTED_OFFSET);
  }

  /// Parses a CCTP V2 burn message (header and burn body).
  /// @param message CCTP V2 burn message.
  /// @return burn Parsed burn message.
  function parseBurnMessage(bytes memory message) public pure returns (CctpBurnMessage memory burn) {
    uint256 body = CCTP_MESSAGE_BODY_OFFSET;
    if (message.length < body + CCTP_HOOK_DATA_OFFSET) revert ICbErrors.InvalidCctpMessageLength(message.length);
    burn.header = parseMessageHeader(message);
    (burn.burnToken,) = message.asBytes32(body + CCTP_BURN_TOKEN_OFFSET);
    (burn.mintRecipient,) = message.asBytes32(body + CCTP_MINT_RECIPIENT_OFFSET);
    (burn.amount,) = message.asUint256(body + CCTP_BURN_AMOUNT_OFFSET);
    (burn.messageSender,) = message.asBytes32(body + CCTP_MESSAGE_SENDER_OFFSET);
    (burn.maxFee,) = message.asUint256(body + CCTP_MAX_FEE_OFFSET);
    (burn.feeExecuted,) = message.asUint256(body + CCTP_FEE_EXECUTED_OFFSET);
    (burn.expirationBlock,) = message.asUint256(body + CCTP_EXPIRATION_BLOCK_OFFSET);
    (burn.hookData,) = message.slice(body + CCTP_HOOK_DATA_OFFSET, message.length - body - CCTP_HOOK_DATA_OFFSET);
  }

  // ---------------------------------------------------------------------------
  // Sending
  // ---------------------------------------------------------------------------

  /// Sends `messageBody` to a registered foreign chain as a CCTP data message using the chain's payable update
  /// settings, and records the emission so an off-chain relayer can walk `emittedCctpPayableUpdates` by index
  /// (via `getEmittedCctpPayableUpdateMessages(offset, limit)`) instead of scanning event logs.
  /// @param cbChainId CAIP-2 chain identifier of a registered foreign chain with a Circle domain.
  /// @param payableId Payable being broadcast; recorded for relayer correlation.
  /// @param chainbillsNonce Chainbills payload nonce (matches the Nonce header in `messageBody`).
  /// @param messageBody Message body.
  function sendPayableUpdate(bytes32 cbChainId, bytes32 payableId, uint64 chainbillsNonce, bytes memory messageBody)
    public
  {
    ForeignChain storage chain = LibRelayGuard.registeredChain(cbChainId);
    if (!chain.config.protocolIds.hasCircleDomain) revert ICbErrors.ForeignChainHasNoCircleDomain(cbChainId);
    IMessageTransmitterV2(LibConfigStorage.layout().cctpMessageTransmitter)
      .sendMessage(
        chain.config.protocolIds.circleDomain,
        chain.config.addresses.cctpRecipient,
        chain.config.addresses.cctpDestinationCaller,
        chain.config.finality.outboundUpdateFinality,
        messageBody
      );
    LibMessagingStorage.Layout storage messaging = LibMessagingStorage.layout();
    messaging.cctpStats.emittedCctpPayableUpdateMessagesCount++;
    messaging.emittedCctpPayableUpdates.push(
      CctpPayableUpdateEmission({
        payableId: payableId,
        destChainId: cbChainId,
        chainbillsNonce: chainbillsNonce,
        messageBodyHash: keccak256(messageBody)
      })
    );
  }

  /// Burns `amount + maxFee` of `token` held by the diamond for minting on a registered foreign chain, carrying
  /// `hookData` in the burn message.
  /// @param cbChainId CAIP-2 chain identifier of the destination chain.
  /// @param token Local CCTP token.
  /// @param amount Payment amount.
  /// @param maxFee Largest fee Circle may take.
  /// @param hookData Encoded payment payload.
  /// @return minFinalityThreshold Finality requested for the burn.
  function burnWithPayment(bytes32 cbChainId, address token, uint256 amount, uint256 maxFee, bytes memory hookData)
    public
    returns (uint32 minFinalityThreshold)
  {
    ForeignChain storage chain = LibRelayGuard.registeredChain(cbChainId);
    if (!chain.config.protocolIds.hasCircleDomain) revert ICbErrors.ForeignChainHasNoCircleDomain(cbChainId);
    address tokenMessenger = LibConfigStorage.layout().cctpTokenMessenger;
    uint256 burnAmount = amount + maxFee;
    minFinalityThreshold = chain.config.finality.outboundPaymentFinality;

    // Approve exactly the burn amount and burn with the payment payload as hook data.
    IERC20(token).forceApprove(tokenMessenger, burnAmount);
    ITokenMessengerV2(tokenMessenger)
      .depositForBurnWithHook(
        burnAmount,
        chain.config.protocolIds.circleDomain,
        chain.config.addresses.cctpMintRecipient,
        token,
        chain.config.addresses.cctpDestinationCaller,
        maxFee,
        minFinalityThreshold,
        hookData
      );
    LibMessagingStorage.layout().cctpStats.emittedCctpPaymentMessagesCount++;
  }

  // ---------------------------------------------------------------------------
  // Receiving
  // ---------------------------------------------------------------------------

  /// Submits a CCTP message and attestation to Circle's transmitter.
  /// @param message CCTP V2 message.
  /// @param attestation Circle attestation.
  function receiveMessage(bytes calldata message, bytes calldata attestation) public {
    bool isSuccess =
      IMessageTransmitterV2(LibConfigStorage.layout().cctpMessageTransmitter).receiveMessage(message, attestation);
    if (!isSuccess) revert ICbErrors.CircleMessageReceivingFailed();
  }

  /// Verifies an inbound payment burn before it is received and returns the payment payload in its hook data.
  /// @param burnMessage CCTP V2 burn message.
  /// @return payload Payment payload.
  /// @return burn Parsed burn message.
  /// @return srcCbChainId CAIP-2 chain identifier of the payer's chain.
  /// @dev Checks this chain as destination and destination caller and mint recipient, the registered burn sender
  /// and inbound switch and minimum finality of the source chain, the payload route, and the token mapping. Circle's
  /// attestation, checked on receipt, binds all of these together with the hook data.
  function verifyInboundPayment(bytes calldata burnMessage)
    public
    view
    returns (PaymentPayload memory payload, CctpBurnMessage memory burn, bytes32 srcCbChainId)
  {
    LibRelayGuard.enforceCctpEnabled();
    LibConfigStorage.Layout storage config = LibConfigStorage.layout();
    burn = parseBurnMessage(burnMessage);
    bytes32 self = address(this).toBytes32();

    // Require this chain as destination and this diamond as the only caller and the mint recipient.
    if (burn.header.destinationDomain != config.cctpDomain) {
      revert ICbErrors.CircleDestinationDomainMismatch(burn.header.destinationDomain);
    }
    if (burn.header.destinationCaller != self) revert ICbErrors.CircleRecipientMismatch(burn.header.destinationCaller);
    if (burn.mintRecipient != self) revert ICbErrors.CircleRecipientMismatch(burn.mintRecipient);

    // Require a registered source chain that accepts inbound payments, its registered burn sender, and enough
    // finality.
    ForeignChain storage chain;
    (srcCbChainId, chain) = LibRelayGuard.chainByCircleDomain(burn.header.sourceDomain);
    if (!chain.config.switches.isInboundPaymentEnabled) revert ICbErrors.InboundPaymentsDisabled(srcCbChainId);
    if (burn.messageSender != chain.config.addresses.cctpBurnSender) {
      revert ICbErrors.CircleSenderMismatch(burn.messageSender);
    }
    uint32 minimumFinality = chain.config.finality.minInboundPaymentFinality;
    if (burn.header.finalityThresholdExecuted < minimumFinality) {
      revert ICbErrors.InsufficientFinality(burn.header.finalityThresholdExecuted, minimumFinality);
    }

    // Decode the payment payload from the hook data and require it to describe this exact route.
    payload = CbPayloadCodec.decodePaymentPayload(burn.hookData);
    if (payload.payerChainId != srcCbChainId || payload.payableChainId != config.cbChainId) {
      revert ICbErrors.PaymentChainMismatch();
    }
    if (payload.amount == 0) revert ICbErrors.ZeroAmountSpecified();

    // Require the burned token to be the payer's token and to mint the payload's token on this chain.
    if (burn.burnToken != payload.payerChainToken) {
      revert ICbErrors.CircleTokenMismatch(burn.burnToken, payload.payerChainToken);
    }
    address localToken = ITokenMinterV2(config.cctpTokenMinter).getLocalToken(burn.header.sourceDomain, burn.burnToken);
    if (localToken == address(0) || localToken.toBytes32() != payload.payableChainToken) {
      revert ICbErrors.CircleTokenMismatch(burn.burnToken, payload.payableChainToken);
    }
    if (burn.amount < payload.amount) revert ICbErrors.CircleMintedLessThanAmount(burn.amount, payload.amount);
  }
}
