use crate::contract::Chainbills;
use crate::error::ChainbillsError;
use crate::messages::{
  FetchMaxFeeMessage, FetchMaxFeeResponse, TokenAndAmountMessage,
};
use sylvia::cw_std::{Event, Response, StdError};
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
  ) -> Result<FetchMaxFeeResponse, Self::Error>;

  #[sv::msg(exec)]
  fn update_max_withdrawal_fee(
    &self,
    ctx: ExecCtx,
    msg: TokenAndAmountMessage,
  ) -> Result<Response, Self::Error>;
}

impl MaxWithdrawalFees for Chainbills {
  type Error = ChainbillsError;

  fn max_fee(
    &self,
    ctx: QueryCtx,
    msg: FetchMaxFeeMessage,
  ) -> Result<FetchMaxFeeResponse, Self::Error> {
    // load and return the max fee for the token or throw an error if
    // the token is invalid.
    match self
      .max_fees_per_token
      .may_load(ctx.deps.storage, &ctx.deps.api.addr_validate(&msg.token)?)?
    {
      Some(max_fee) => Ok(FetchMaxFeeResponse { max_fee }),
      None => Err(ChainbillsError::InvalidToken {}),
    }
  }

  fn update_max_withdrawal_fee(
    &self,
    ctx: ExecCtx,
    msg: TokenAndAmountMessage,
  ) -> Result<Response, Self::Error> {
    // Only the owner can update the max withdrawal fee.
    let owner = self.config.load(ctx.deps.storage)?.owner;
    if ctx.info.sender != owner {
      return Err(ChainbillsError::Unauthorized {});
    }

    // Update the max withdrawal fee.
    let token = ctx.deps.api.addr_validate(&msg.token)?;
    self
      .max_fees_per_token
      .save(ctx.deps.storage, &token, &msg.amount)?;

    // Emit an event and return a response.
    let attributes = [
      ("token", token.as_str()),
      ("max_fee", &msg.amount.to_string()),
    ];
    let res = Response::new()
      .add_event(
        Event::new("updated_max_withdrawal_fee").add_attributes(attributes),
      )
      .add_attribute("action", "update_max_withdrawal_fee")
      .add_attributes(attributes);
    Ok(res)
  }
}
