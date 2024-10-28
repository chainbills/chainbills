use cw_utils::PaymentError;
use sylvia::cw_std::StdError;
use thiserror::Error;

#[derive(Error, Debug, PartialEq)]
pub enum ChainbillsError {
  #[error("{0}")]
  Std(#[from] StdError),

  #[error("Payment error: {0}")]
  NativePayment(#[from] PaymentError),

  #[error("OwnerUnauthorized")]
  OwnerUnauthorized {},

  #[error("Invalid Token: {token}")]
  InvalidToken { token: String },

  #[error("Unsupported Token: {token}")]
  UnsupportedToken { token: String },

  #[error("Zero Amount Specified")]
  ZeroAmountSpecified {},

  #[error("Invalid User Payable Count: {count}")]
  InvalidUserPayableCount { count: u64 },

  #[error("Invalid Payable ID: {id}")]
  InvalidPayableId { id: String },

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

  #[error("Invalid User Payment Count: {count}")]
  InvalidUserPaymentCount { count: u64 },

  #[error("Invalid Payable Payment Count: {count}")]
  InvalidPayablePaymentCount { count: u64 },

  #[error("Invalid Payment ID: {id}")]
  InvalidPaymentId { id: String },

  #[error("Invalid Chain ID: {chain_id}")]
  InvalidChainId { chain_id: u16 },

  #[error("Invalid Per Chain Payable Payment Count: {count}")]
  InvalidPerChainPayablePaymentCount { count: u64 },

  #[error("Invalid User Withdrawal Count: {count}")]
  InvalidUserWithdrawalCount { count: u64 },

  #[error("Invalid Payable Withdrawal Count: {count}")]
  InvalidPayableWithdrawalCount { count: u64 },

  #[error("Invalid Withdrawal ID: {id}")]
  InvalidWithdrawalId { id: String },

  #[error("Not Your Payable")]
  NotYourPayable {},

  #[error("No Balance For Withdrawal Token: {token}")]
  NoBalanceForWithdrawalToken { token: String },

  #[error("Insufficient Withdraw Amount")]
  InsufficientWithdrawAmount {},
}
