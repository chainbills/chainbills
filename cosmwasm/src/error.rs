use cw_utils::PaymentError;
use sylvia::cw_std::StdError;
use thiserror::Error;

#[derive(Error, Debug, PartialEq)]
pub enum ChainbillsError {
  #[error("{0}")]
  Std(#[from] StdError),

  #[error("Payment error: {0}")]
  NativePayment(#[from] PaymentError),

  #[error("Unauthorized")]
  Unauthorized {},

  #[error("Invalid Token")]
  InvalidToken {},

  #[error("Zero Amount Specified")]
  ZeroAmountSpecified {},

  #[error("Invalid User Payable Count")]
  InvalidUserPayableCount {},

  #[error("Invalid Payable ID")]
  InvalidPayableId {},

  #[error("Payable is Closed")]
  PayableIsClosed {},

  #[error("Payable Is Already Closed")]
  PayableIsAlreadyClosed {},

  #[error("Payable Is Not Closed")]
  PayableIsNotClosed {},

  #[error("Matching Token and Amount Not Found")]
  MatchingTokenAndAmountNotFound {},

  #[error("Invalid Native Token Payment")]
  InvalidNativeTokenPayment {},

  #[error("Invalid User Payment Count")]
  InvalidUserPaymentCount {},

  #[error("Invalid Payable Payment Count")]
  InvalidPayablePaymentCount {},

  #[error("Invalid Payment ID")]
  InvalidPaymentId {},

  #[error("Invalid User Withdrawal Count")]
  InvalidUserWithdrawalCount {},

  #[error("Invalid Payable Withdrawal Count")]
  InvalidPayableWithdrawalCount {},

  #[error("Invalid Withdrawal ID")]
  InvalidWithdrawalId {},

  #[error("Not Your Payable")]
  NotYourPayable {},

  #[error("No Balance For Withdrawal Token")]
  NoBalanceForWithdrawalToken {},

  #[error("Insufficient Withdraw Amount")]
  InsufficientWithdrawAmount {},
}
