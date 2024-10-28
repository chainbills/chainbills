use crate::contract::Chainbills;
use crate::error::ChainbillsError;
use crate::messages::{IdMessage, UpdateMaxWithdrawalFeesMessage};
use crate::state::TokenDetails;
use sylvia::cw_std::{Response, StdError};
use sylvia::interface;
use sylvia::types::{ExecCtx, QueryCtx};

#[interface]
pub trait TokenDetailsInterface {
  type Error: From<StdError>;

  #[sv::msg(query)]
  fn token_details(
    &self,
    ctx: QueryCtx,
    msg: IdMessage,
  ) -> Result<TokenDetails, Self::Error>;

  #[sv::msg(exec)]
  fn update_max_withdrawal_fees(
    &self,
    ctx: ExecCtx,
    msg: UpdateMaxWithdrawalFeesMessage,
  ) -> Result<Response, Self::Error>;
}

impl TokenDetailsInterface for Chainbills {
  type Error = ChainbillsError;

  fn token_details(
    &self,
    ctx: QueryCtx,
    msg: IdMessage,
  ) -> Result<TokenDetails, Self::Error> {
    // load and return the max fee details for the token or throw an error if
    // the token is invalid.
    match self
      .token_details
      .may_load(ctx.deps.storage, msg.id.clone())?
    {
      Some(details) => Ok(details),
      None => Err(ChainbillsError::InvalidToken {
        token: msg.id.clone(),
      }),
    }
  }

  fn update_max_withdrawal_fees(
    &self,
    ctx: ExecCtx,
    msg: UpdateMaxWithdrawalFeesMessage,
  ) -> Result<Response, Self::Error> {
    // Only the owner can update the max withdrawal fee.
    let owner = self.config.load(ctx.deps.storage)?.owner;
    if ctx.info.sender != owner {
      return Err(ChainbillsError::OwnerUnauthorized {});
    }

    // Extract necessary details for the update.
    let UpdateMaxWithdrawalFeesMessage {
      is_native_token,
      max_withdrawal_fees,
      token,
    } = msg;

    // If the token is not a native one, ensure it is a valid token address.
    if !is_native_token {
      ctx.deps.api.addr_validate(&token)?;
    }

    // Fetch the token's TokenDetails. If this is the first time the token is
    // being updated, it means it is being added, we create a new TokenDetails.
    let mut token_details = self
      .token_details
      .load(ctx.deps.storage, token.clone())
      .unwrap_or(TokenDetails::initialize(
        true,
        is_native_token,
        max_withdrawal_fees,
      ));

    // Update the max_withdrawal_fees and native token status for the token.
    token_details.max_withdrawal_fees = max_withdrawal_fees;
    token_details.is_native_token = is_native_token;

    // Save the updated TokenDetails.
    self
      .token_details
      .save(ctx.deps.storage, token.clone(), &token_details)?;

    // Return the Response.
    Ok(Response::new().add_attributes([
      ("action", "updated_max_withdrawal_fees".to_string()),
      ("token", token.clone()),
      ("is_native_token", is_native_token.to_string()),
      ("max_withdrawal_fees", max_withdrawal_fees.to_string()),
    ]))
  }
}
