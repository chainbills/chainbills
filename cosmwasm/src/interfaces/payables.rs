use crate::messages::{
  CreatePayableMessage, FetchIdMessage, IdMessage,
  UpdatePayableTokensAndAmountsMessage,
};
use crate::state::{Payable, TokenAndAmount, User};
use crate::{contract::Chainbills, error::ChainbillsError};
use sylvia::cw_std::{Event, HexBinary, Response, StdError};
use sylvia::interface;
use sylvia::types::{ExecCtx, QueryCtx};

#[interface]
pub trait Payables {
  type Error: From<StdError>;

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

  fn user_payable_id(
    &self,
    ctx: QueryCtx,
    msg: FetchIdMessage,
  ) -> Result<IdMessage, Self::Error> {
    // Validate the wallet address.
    let valid_wallet = ctx.deps.api.addr_validate(&msg.reference)?;

    // Ensure the requested count is valid.
    let user = self
      .users
      .load(ctx.deps.storage, &valid_wallet)
      .unwrap_or(User::initialize(0));
    if msg.count > user.payables_count {
      return Err(ChainbillsError::InvalidUserPayableCount {});
    }

    // Get and return the payable ID.
    let payable_ids = self
      .user_payable_ids
      .load(ctx.deps.storage, &valid_wallet)?;
    let id = HexBinary::from(payable_ids[(msg.count - 1) as usize]).to_hex();
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
      None => Err(ChainbillsError::InvalidPayableId {}),
    }
  }

  fn create_payable(
    &self,
    ctx: ExecCtx,
    msg: CreatePayableMessage,
  ) -> Result<Response, Self::Error> {
    /* CHECKS */
    let mut allowed_tokens_and_amounts = vec![];
    for taa in msg.allowed_tokens_and_amounts.iter() {
      // Ensure tokens are valid and are supported. Basically if a token's max
      // fees is not set, then it isn't supported.
      let token = &ctx.deps.api.addr_validate(&taa.token)?;
      if !self.max_fees_per_token.has(ctx.deps.storage, token) {
        return Err(ChainbillsError::InvalidToken {});
      }

      // Ensure that all specified acceptable amounts are greater than zero.
      if taa.amount.is_zero() {
        return Err(ChainbillsError::ZeroAmountSpecified {});
      }

      allowed_tokens_and_amounts.push(TokenAndAmount {
        token: token.clone(),
        amount: taa.amount,
      });
    }

    /* STATE CHANGES */
    // Increment the chain stats for payables_count.
    let mut chain_stats = self.chain_stats.load(ctx.deps.storage)?;
    chain_stats.payables_count = chain_stats.next_payable();
    self.chain_stats.save(ctx.deps.storage, &chain_stats)?;

    // Increment payablesCount on the host (address) creating this payable.
    let mut events =
      self.initialize_user_if_need_be(ctx.deps.storage, &ctx.info.sender)?;
    let mut user = self.users.load(ctx.deps.storage, &ctx.info.sender)?;
    user.payables_count = user.next_payable();
    self.users.save(ctx.deps.storage, &ctx.info.sender, &user)?;

    // Get a new Payable ID
    let payable_id = self.create_id(
      ctx.deps.storage,
      &ctx.env,
      &ctx.info.sender,
      user.payables_count,
    )?;

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
      is_closed: false,
    };
    self.payables.save(ctx.deps.storage, payable_id, &payable)?;

    // Emit events and return a response.
    let attributes = vec![
      ("payable_id", HexBinary::from(&payable_id).to_hex()),
      ("host_wallet", ctx.info.sender.to_string()),
      ("chain_count", chain_stats.payables_count.to_string()),
      ("host_count", user.payables_count.to_string()),
    ];
    events
      .push(Event::new("created_payable").add_attributes(attributes.clone()));
    let res = Response::new()
      .add_events(events)
      .add_attribute("action", "create_payable")
      .add_attributes(attributes);
    Ok(res)
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
      return Err(ChainbillsError::InvalidPayableId {});
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
    // Close the payable and save it.
    payable.is_closed = true;
    self.payables.save(ctx.deps.storage, payable_id, &payable)?;

    // Emit events and return a response.
    let attributes = vec![
      ("payable_id", HexBinary::from(&payable_id).to_hex()),
      ("host_wallet", ctx.info.sender.to_string()),
    ];
    let res = Response::new()
      .add_event(
        Event::new("closed_payable").add_attributes(attributes.clone()),
      )
      .add_attribute("action", "close_payable")
      .add_attributes(attributes);
    Ok(res)
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
      return Err(ChainbillsError::InvalidPayableId {});
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
    // Reopen the payable and save it.
    payable.is_closed = false;
    self.payables.save(ctx.deps.storage, payable_id, &payable)?;

    // Emit events and return a response.
    let attributes = vec![
      ("payable_id", HexBinary::from(&payable_id).to_hex()),
      ("host_wallet", ctx.info.sender.to_string()),
    ];
    let res = Response::new()
      .add_event(
        Event::new("reopened_payable").add_attributes(attributes.clone()),
      )
      .add_attribute("action", "reopen_payable")
      .add_attributes(attributes);
    Ok(res)
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
      return Err(ChainbillsError::InvalidPayableId {});
    }
    let mut payable = self.payables.load(ctx.deps.storage, payable_id)?;

    // Ensure that the caller owns the payable.
    if payable.host != &ctx.info.sender {
      return Err(ChainbillsError::NotYourPayable {});
    }

    let mut allowed_tokens_and_amounts = vec![];
    for taa in msg.allowed_tokens_and_amounts.iter() {
      // Ensure tokens are valid and are supported. Basically if a token's max
      // fees is not set, then it isn't supported.
      let token = &ctx.deps.api.addr_validate(&taa.token)?;
      if !self.max_fees_per_token.has(ctx.deps.storage, token) {
        return Err(ChainbillsError::InvalidToken {});
      }

      // Ensure that all specified acceptable amounts are greater than zero.
      if taa.amount.is_zero() {
        return Err(ChainbillsError::ZeroAmountSpecified {});
      }

      allowed_tokens_and_amounts.push(TokenAndAmount {
        token: token.clone(),
        amount: taa.amount,
      });
    }

    /* STATE CHANGES */
    // Update the payable's allowed_tokens_and_amounts and save it.
    payable.allowed_tokens_and_amounts = allowed_tokens_and_amounts;
    self.payables.save(ctx.deps.storage, payable_id, &payable)?;

    // Emit events and return a response.
    let attributes = vec![
      ("payable_id", HexBinary::from(&payable_id).to_hex()),
      ("host_wallet", ctx.info.sender.to_string()),
    ];
    let res = Response::new()
      .add_event(
        Event::new("updated_payable_tokens_and_amounts")
          .add_attributes(attributes.clone()),
      )
      .add_attribute("action", "update_payable_tokens_and_amounts")
      .add_attributes(attributes);
    Ok(res)
  }
}
