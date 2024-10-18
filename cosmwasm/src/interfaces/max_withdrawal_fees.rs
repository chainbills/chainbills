use crate::contract::Chainbills;
use crate::error::ChainbillsError;
use crate::messages::FetchMaxFeeMessage;
use crate::state::MaxWithdrawalFeeDetails;
use sylvia::cw_std::{Response, StdError};
use sylvia::interface;
use sylvia::types::{ExecCtx, QueryCtx};

#[interface]
pub trait MaxWithdrawalFees {
  type Error: From<StdError>;

  #[sv::msg(query)]
  fn max_fee(
    &self,
    ctx: QueryCtx,
    msg: FetchMaxFeeMessage,
  ) -> Result<MaxWithdrawalFeeDetails, Self::Error>;

  #[sv::msg(exec)]
  fn update_max_withdrawal_fee(
    &self,
    ctx: ExecCtx,
    msg: MaxWithdrawalFeeDetails,
  ) -> Result<Response, Self::Error>;
}

impl MaxWithdrawalFees for Chainbills {
  type Error = ChainbillsError;

  fn max_fee(
    &self,
    ctx: QueryCtx,
    msg: FetchMaxFeeMessage,
  ) -> Result<MaxWithdrawalFeeDetails, Self::Error> {
    // load and return the max fee details for the token or throw an error if
    // the token is invalid.
    match self
      .max_fees_per_token
      .may_load(ctx.deps.storage, msg.token.clone())?
    {
      Some(details) => Ok(details),
      None => Err(ChainbillsError::InvalidToken {
        token: msg.token.clone(),
      }),
    }
  }

  fn update_max_withdrawal_fee(
    &self,
    ctx: ExecCtx,
    msg: MaxWithdrawalFeeDetails,
  ) -> Result<Response, Self::Error> {
    // Only the owner can update the max withdrawal fee.
    let owner = self.config.load(ctx.deps.storage)?.owner;
    if ctx.info.sender != owner {
      return Err(ChainbillsError::OwnerUnauthorized {});
    }

    // If the token is not a native one, ensure it is a valid token address.
    if !msg.is_native_token {
      ctx.deps.api.addr_validate(&msg.token)?;
    }

    // Update the max withdrawal fee details.
    self.max_fees_per_token.save(
      ctx.deps.storage,
      msg.clone().token,
      &msg.clone(),
    )?;

    // Return the Response.
    Ok(Response::new().add_attributes([
      ("action", "update_max_withdrawal_fee".to_string()),
      ("token", msg.token),
      ("is_native_token", msg.is_native_token.to_string()),
      ("max_fee", msg.max_fee.to_string()),
    ]))
  }
}
