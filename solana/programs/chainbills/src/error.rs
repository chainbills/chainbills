use anchor_lang::prelude::error_code;

#[error_code]
pub enum ChainbillsError {
  #[msg("MaxPayableTokensCapacityReached")]
  /// The maximum capacity of payable tokens has been reached.
  MaxPayableTokensCapacityReached,

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
}
