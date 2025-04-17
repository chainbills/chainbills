// SPDX-License-Identifier: Apache 2
pragma solidity ^0.8.20;

/// Stores all thrown errors in Chainbills
contract CbErrors {
  error CircleMintingFailed();
  error CircleNonceMismatch();
  error CircleRecipientMismatch();
  error CircleSenderMismatch();
  error CircleSourceDomainMismatch();
  error CircleTargetDomainMismatch();
  error CircleTokenMismatch();
  error EmitterNotRegistered();
  error HasAlreadyConsumedMessage();
  error IncorrectPaymentValue();
  error IncorrectWormholeFees();
  error InsufficientPaymentValue();
  error InsufficientWithdrawAmount();
  error InsufficientWormholeFees();
  error InvalidActivityId();
  error InvalidChainId();
  error InvalidChainIdOrForeignToken();
  error InvalidCircleBridge();
  error InvalidCircleTokenMinter();
  error InvalidCircleTransmitter();
  error InvalidFeeCollector();
  error InvalidLocalCircleDomain();
  error InvalidPayablesLogic();
  error InvalidPayableId();
  error InvalidPayablePayloadActionType();
  error InvalidPaymentId();
  error InvalidPayload();
  error InvalidTransactionsLogic();
  error InvalidTokenAddress();
  error InvalidWalletAddress();
  error InvalidWithdrawalId();
  error InvalidWormholeAddress();
  error InvalidWormholeChainId();
  error InvalidWormholeEmitterAddress();
  error InvalidWormholeFinality();
  error MatchingTokenAndAmountNotFound();
  error NoBalanceForWithdrawalToken();
  error NotYourPayable();
  error OnlyChainbillsCanCall();
  error OnlyLogicContractsCanCall();
  error PayableIsAlreadyClosed();
  error PayableIsClosed();
  error PayableIsNotClosed();
  error UnsuccessfulFeesWithdrawal();
  error UnsuccessfulPayment();
  error UnsuccessfulWithdrawal();
  error UnsupportedToken();
  error ZeroAmountSpecified();
}
