use anchor_lang::prelude::error_code;

#[error_code]
pub enum ChainbillsError {
  #[msg("InvalidRemainingAccountsLength")]
  /// The length of remaining accounts in the context does not match the length
  /// of the allowed tokens and amounts vector.
  InvalidRemainingAccountsLength,

  #[msg("NonTokenDetailsAccountProvided")]
  /// A non-token details account was provided in the remaining accounts.
  NonTokenDetailsAccountProvided,

  #[msg("InvalidTokenDetailsAccount")]
  /// The token details account is invalid.
  InvalidTokenDetailsAccount,

  #[msg("UnsupportedToken")]
  /// The token is not supported.
  UnsupportedToken,

  #[msg("ZeroAmountSpecified")]
  /// The amount specified is zero.
  ZeroAmountSpecified,

  #[msg("PayableIsClosed")]
  /// The payable is closed, so it can accept payments.
  PayableIsClosed,

  #[msg("PayableIsAlreadyClosed")]
  /// The payable is already closed, so no need to close it again.
  PayableIsAlreadyClosed,

  #[msg("PayableIsNotClosed")]
  /// The payable is not closed, so no need to re-open it.
  PayableIsNotClosed,

  #[msg("MatchingTokenAndAmountNotFound")]
  /// No matching token and amount found for payment.
  MatchingTokenAndAmountNotFound,

  #[msg("NotYourPayable")]
  /// The payable is not owned by the caller.
  NotYourPayable,

  #[msg("InsufficientWithdrawAmount")]
  /// The specified withdrawal amount is greater than the available balance.
  InsufficientWithdrawAmount,

  #[msg("NoBalanceForWithdrawalToken")]
  /// No balance found for the specified withdrawal token.
  NoBalanceForWithdrawalToken,

  #[msg("OwnerUnauthorized")]
  /// The caller is not the owner of the program.
  OwnerUnauthorized,

  #[msg("InvalidWormholeBridge")]
  /// Specified Wormhole bridge data PDA is wrong.
  InvalidWormholeBridge,

  #[msg("InvalidForeignContract")]
  /// Specified foreign contract has a bad chain ID or zero address.
  InvalidForeignContract,

  #[msg("WrongFeeCollectorAddress")]
  /// The provided fee collector address is wrong.
  WrongFeeCollectorAddress,

  #[msg("InvalidWormholeConfig")]
  /// Specified Wormhole bridge data PDA is wrong.
  InvalidWormholeConfig,

  #[msg("InvalidWormholeFeeCollector")]
  /// Specified Wormhole fee collector PDA is wrong.
  InvalidWormholeFeeCollector,

  #[msg("InvalidWormholeEmitter")]
  /// Specified program's emitter PDA is wrong.
  InvalidWormholeEmitter,

  #[msg("InvalidWormholeSequence")]
  /// Specified emitter's sequence PDA is wrong.
  InvalidWormholeSequence,

  #[msg("InvalidPayloadPayableId")]
  /// Specified Payable ID doesn't match what's in the payload.
  InvalidPayloadPayableId,

  #[msg("InvalidPayloadAtaaLen")]
  /// Specified ATAA length doesn't match what's in the payload.
  InvalidPayloadAtaaLen,

  #[msg("InvalidPayloadActionType")]
  /// Specified action type in the payload is invalid.
  InvalidPayloadActionType,
}
