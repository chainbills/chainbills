use crate::contract::Chainbills;
use crate::error::ChainbillsError;
use crate::messages::{
  CountMessage, CreatePayableMessage, FetchIdMessage, IdMessage,
  UpdatePayableTokensAndAmountsMessage,
};
use crate::state::{ActivityRecord, ActivityType, Payable, TokenDetails, User};
use sylvia::cw_std::{HexBinary, Response, StdError, Uint128};
use sylvia::interface;
use sylvia::types::{ExecCtx, QueryCtx};

#[interface]
pub trait Payables {
  type Error: From<StdError>;

  fn chain_payable_id(
    &self,
    ctx: QueryCtx,
    msg: CountMessage,
  ) -> Result<IdMessage, Self::Error>;

  #[sv::msg(query)]
  fn user_payable_id(
    &self,
    ctx: QueryCtx,
    msg: FetchIdMessage,
  ) -> Result<IdMessage, Self::Error>;

  #[sv::msg(query)]
  fn payable(
    &self,
    ctx: QueryCtx,
    msg: IdMessage,
  ) -> Result<Payable, Self::Error>;

  #[sv::msg(exec)]
  fn create_payable(
    &self,
    ctx: ExecCtx,
    data: CreatePayableMessage,
  ) -> Result<Response, Self::Error>;

  #[sv::msg(exec)]
  fn close_payable(
    &self,
    ctx: ExecCtx,
    msg: IdMessage,
  ) -> Result<Response, Self::Error>;

  #[sv::msg(exec)]
  fn reopen_payable(
    &self,
    ctx: ExecCtx,
    msg: IdMessage,
  ) -> Result<Response, Self::Error>;

  #[sv::msg(exec)]
  fn update_payable_tokens_and_amounts(
    &self,
    ctx: ExecCtx,
    msg: UpdatePayableTokensAndAmountsMessage,
  ) -> Result<Response, Self::Error>;
}

impl Payables for Chainbills {
  type Error = ChainbillsError;

  fn chain_payable_id(
    &self,
    ctx: QueryCtx,
    msg: CountMessage,
  ) -> Result<IdMessage, Self::Error> {
    // Ensure the requested count is valid.
    let count = msg.count;
    let chain_stats = self.chain_stats.load(ctx.deps.storage)?;
    if count == 0 || count > chain_stats.payables_count {
      return Err(ChainbillsError::InvalidChainPayableCount { count });
    }

    // Get and return the Payable ID.
    let ids = self.chain_payable_ids.load(ctx.deps.storage)?;
    let id = HexBinary::from(ids[(count - 1) as usize]).to_hex();
    Ok(IdMessage { id })
  }

  fn user_payable_id(
    &self,
    ctx: QueryCtx,
    msg: FetchIdMessage,
  ) -> Result<IdMessage, Self::Error> {
    // Validate the wallet address.
    let valid_wallet = ctx.deps.api.addr_validate(&msg.reference)?;
    let count = msg.count;

    // Ensure the requested count is valid.
    let user = self
      .users
      .load(ctx.deps.storage, &valid_wallet)
      .unwrap_or(User::initialize(0));
    if count == 0 || count > user.payables_count {
      return Err(ChainbillsError::InvalidUserPayableCount { count });
    }

    // Get and return the payable ID.
    let payable_ids = self
      .user_payable_ids
      .load(ctx.deps.storage, &valid_wallet)?;
    let id = HexBinary::from(payable_ids[(count - 1) as usize]).to_hex();
    Ok(IdMessage { id })
  }

  fn payable(
    &self,
    ctx: QueryCtx,
    msg: IdMessage,
  ) -> Result<Payable, Self::Error> {
    match self.payables.may_load(
      ctx.deps.storage,
      <[u8; 32]>::try_from(HexBinary::from_hex(&msg.id)?.as_slice()).unwrap(),
    )? {
      Some(payable) => Ok(payable),
      None => Err(ChainbillsError::InvalidPayableId { id: msg.id }),
    }
  }

  fn create_payable(
    &self,
    ctx: ExecCtx,
    msg: CreatePayableMessage,
  ) -> Result<Response, Self::Error> {
    /* CHECKS */
    let CreatePayableMessage {
      allowed_tokens_and_amounts,
    } = msg;
    for taa in allowed_tokens_and_amounts.iter() {
      // Ensure that the token is supported.
      let token_details = self
        .token_details
        .load(ctx.deps.storage, taa.token.clone())
        .unwrap_or(TokenDetails::initialize(false, false, Uint128::zero()));
      if !token_details.is_supported {
        return Err(ChainbillsError::UnsupportedToken {
          token: taa.token.clone(),
        });
      }

      // Ensure that all specified acceptable amounts are greater than zero.
      if taa.amount.is_zero() {
        return Err(ChainbillsError::ZeroAmountSpecified {});
      }
    }

    /* STATE CHANGES */
    /* COUNTS */
    // Increment payables and activities counts on the host (address)
    // creating this payable.
    let user_resp_attribs = self.initialize_user_if_is_new(
      ctx.deps.storage,
      &ctx.env,
      &ctx.info.sender,
    )?;
    let mut user = self.users.load(ctx.deps.storage, &ctx.info.sender)?;
    user.payables_count = user.next_payable();
    user.activities_count = user.next_activity();
    self.users.save(ctx.deps.storage, &ctx.info.sender, &user)?;

    // Increment the chain stats for payables_count and activities_count.
    let mut chain_stats = self.chain_stats.load(ctx.deps.storage)?;
    chain_stats.payables_count = chain_stats.next_payable();
    chain_stats.activities_count = chain_stats.next_activity();
    self.chain_stats.save(ctx.deps.storage, &chain_stats)?;

    /* PAYABLE DATA STRUCTURE */
    // Get a new Payable ID
    let payable_id = self.create_id(
      ctx.deps.storage,
      &ctx.env,
      &ctx.info.sender.as_str(),
      "payable",
      user.payables_count,
    )?;

    // Save the Payable ID to the chain_payable_ids.
    let mut chain_payable_ids =
      self.chain_payable_ids.load(ctx.deps.storage)?;
    chain_payable_ids.push(payable_id);
    self
      .chain_payable_ids
      .save(ctx.deps.storage, &chain_payable_ids)?;

    // Save the Payable ID to the users_payable_ids.
    let mut user_payable_ids = self
      .user_payable_ids
      .may_load(ctx.deps.storage, &ctx.info.sender)?
      .unwrap_or_default();
    user_payable_ids.push(payable_id);
    self.user_payable_ids.save(
      ctx.deps.storage,
      &ctx.info.sender,
      &user_payable_ids,
    )?;

    // Create and Save the Payable.
    let payable = Payable {
      chain_count: chain_stats.payables_count,
      host: ctx.info.sender.clone(),
      host_count: user.payables_count,
      allowed_tokens_and_amounts,
      balances: vec![],
      created_at: ctx.env.block.time.seconds(),
      payments_count: 0,
      withdrawals_count: 0,
      activities_count: 1,
      is_closed: false,
    };
    self.payables.save(ctx.deps.storage, payable_id, &payable)?;

    /* ACTIVITY DATA STRUCTURE */
    // Get a new ActivityRecord ID.
    let activity_id = self.create_id(
      ctx.deps.storage,
      &ctx.env,
      &ctx.info.sender.as_str(),
      "activity",
      user.activities_count,
    )?;

    // Save the ActivityRecord ID to involved entities.
    self.save_activity_id_for_all(
      ctx.deps.storage,
      &ctx.info.sender,
      payable_id,
      activity_id,
    )?;

    // Create and Save the ActivityRecord.
    self.activities.save(
      ctx.deps.storage,
      activity_id,
      &ActivityRecord {
        chain_count: chain_stats.activities_count,
        user_count: user.activities_count,
        payable_count: 1,
        timestamp: ctx.env.block.time.seconds(),
        entity: HexBinary::from(&payable_id).to_hex(),
        activity_type: ActivityType::CreatedPayable,
      },
    )?;

    /* FINISH */
    // Return the Response.
    Ok(
      Response::new()
        .add_attributes(user_resp_attribs) // Add the user init attributes.
        .add_attributes([
          ("action", "created_payable".to_string()),
          ("payable_id", HexBinary::from(&payable_id).to_hex()),
          ("host_wallet", ctx.info.sender.to_string()),
          ("chain_count", chain_stats.payables_count.to_string()),
          ("host_count", user.payables_count.to_string()),
        ]),
    )
  }

  fn close_payable(
    &self,
    ctx: ExecCtx,
    msg: IdMessage,
  ) -> Result<Response, Self::Error> {
    /* CHECKS */
    // Ensure that the payable_id is valid.
    let payable_id =
      <[u8; 32]>::try_from(HexBinary::from_hex(&msg.id)?.as_slice()).unwrap();
    if !self.payables.has(ctx.deps.storage, payable_id) {
      return Err(ChainbillsError::InvalidPayableId { id: msg.id });
    }
    let mut payable = self.payables.load(ctx.deps.storage, payable_id)?;

    // Ensure that the caller owns the payable.
    if payable.host != &ctx.info.sender {
      return Err(ChainbillsError::NotYourPayable {});
    }

    // Ensure that the payable is not already closed.
    if payable.is_closed {
      return Err(ChainbillsError::PayableIsAlreadyClosed {});
    }

    /* STATE CHANGES */
    // Close the payable
    payable.is_closed = true;

    // Increment the activity count on the payable.
    payable.activities_count = payable.next_activity();

    // Save the payable.
    self.payables.save(ctx.deps.storage, payable_id, &payable)?;

    // Record the activity.
    self.record_update_payable_activity(
      ctx.deps.storage,
      &ctx.env,
      &ctx.info.sender,
      payable_id,
      payable.activities_count,
      ActivityType::ClosedPayable,
    )?;

    // Return the Response.
    Ok(Response::new().add_attributes([
      ("action", "closed_payable".to_string()),
      ("payable_id", HexBinary::from(&payable_id).to_hex()),
      ("host_wallet", ctx.info.sender.to_string()),
    ]))
  }

  fn reopen_payable(
    &self,
    ctx: ExecCtx,
    msg: IdMessage,
  ) -> Result<Response, Self::Error> {
    /* CHECKS */
    // Ensure that the payable_id is valid.
    let payable_id =
      <[u8; 32]>::try_from(HexBinary::from_hex(&msg.id)?.as_slice()).unwrap();
    if !self.payables.has(ctx.deps.storage, payable_id) {
      return Err(ChainbillsError::InvalidPayableId { id: msg.id });
    }
    let mut payable = self.payables.load(ctx.deps.storage, payable_id)?;

    // Ensure that the caller owns the payable.
    if payable.host != &ctx.info.sender {
      return Err(ChainbillsError::NotYourPayable {});
    }

    // Ensure that the payable is already closed.
    if !payable.is_closed {
      return Err(ChainbillsError::PayableIsNotClosed {});
    }

    /* STATE CHANGES */
    // Reopen the payable.
    payable.is_closed = false;

    // Increment the activity count on the payable.
    payable.activities_count = payable.next_activity();

    // Save the payable.
    self.payables.save(ctx.deps.storage, payable_id, &payable)?;

    // Record the activity.
    self.record_update_payable_activity(
      ctx.deps.storage,
      &ctx.env,
      &ctx.info.sender,
      payable_id,
      payable.activities_count,
      ActivityType::ReopenedPayable,
    )?;

    // Return the Response.
    Ok(Response::new().add_attributes([
      ("action", "reopened_payable".to_string()),
      ("payable_id", HexBinary::from(&payable_id).to_hex()),
      ("host_wallet", ctx.info.sender.to_string()),
    ]))
  }

  fn update_payable_tokens_and_amounts(
    &self,
    ctx: ExecCtx,
    msg: UpdatePayableTokensAndAmountsMessage,
  ) -> Result<Response, Self::Error> {
    /* CHECKS */
    // Ensure that the payable_id is valid.
    let payable_id =
      <[u8; 32]>::try_from(HexBinary::from_hex(&msg.payable_id)?.as_slice())
        .unwrap();
    if !self.payables.has(ctx.deps.storage, payable_id) {
      return Err(ChainbillsError::InvalidPayableId { id: msg.payable_id });
    }
    let mut payable = self.payables.load(ctx.deps.storage, payable_id)?;

    // Ensure that the caller owns the payable.
    if payable.host != &ctx.info.sender {
      return Err(ChainbillsError::NotYourPayable {});
    }

    let UpdatePayableTokensAndAmountsMessage {
      allowed_tokens_and_amounts,
      ..
    } = msg;
    for taa in allowed_tokens_and_amounts.iter() {
      // Ensure that the token is supported.
      let token_details = self
        .token_details
        .load(ctx.deps.storage, taa.token.clone())
        .unwrap_or(TokenDetails::initialize(false, false, Uint128::zero()));
      if !token_details.is_supported {
        return Err(ChainbillsError::UnsupportedToken {
          token: taa.token.clone(),
        });
      }

      // Ensure that all specified acceptable amounts are greater than zero.
      if taa.amount.is_zero() {
        return Err(ChainbillsError::ZeroAmountSpecified {});
      }
    }

    /* STATE CHANGES */
    // Update the payable's allowed_tokens_and_amounts.
    payable.allowed_tokens_and_amounts = allowed_tokens_and_amounts;

    // Increment the activity count on the payable.
    payable.activities_count = payable.next_activity();

    // Save the payable.
    self.payables.save(ctx.deps.storage, payable_id, &payable)?;

    // Record the activity.
    self.record_update_payable_activity(
      ctx.deps.storage,
      &ctx.env,
      &ctx.info.sender,
      payable_id,
      payable.activities_count,
      ActivityType::UpdatedPayableAllowedTokensAndAmounts,
    )?;

    // Return the Response.
    Ok(Response::new().add_attributes([
      ("action", "updated_payable_tokens_and_amounts".to_string()),
      ("payable_id", HexBinary::from(&payable_id).to_hex()),
      ("host_wallet", ctx.info.sender.to_string()),
    ]))
  }
}
