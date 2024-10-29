use crate::contract::Chainbills;
use crate::error::ChainbillsError;
use crate::messages::{CountMessage, FetchIdMessage, IdMessage};
use crate::state::{ActivityRecord, User};
use sylvia::cw_std::{HexBinary, StdError};
use sylvia::interface;
use sylvia::types::QueryCtx;

#[interface]
pub trait Activities {
  type Error: From<StdError>;

  #[sv::msg(query)]
  fn chain_activity_id(
    &self,
    ctx: QueryCtx,
    msg: CountMessage,
  ) -> Result<IdMessage, Self::Error>;

  #[sv::msg(query)]
  fn user_activity_id(
    &self,
    ctx: QueryCtx,
    msg: FetchIdMessage,
  ) -> Result<IdMessage, Self::Error>;

  #[sv::msg(query)]
  fn payable_activity_id(
    &self,
    ctx: QueryCtx,
    msg: FetchIdMessage,
  ) -> Result<IdMessage, Self::Error>;

  #[sv::msg(query)]
  fn activity(
    &self,
    ctx: QueryCtx,
    msg: IdMessage,
  ) -> Result<ActivityRecord, Self::Error>;
}

impl Activities for Chainbills {
  type Error = ChainbillsError;

  fn chain_activity_id(
    &self,
    ctx: QueryCtx,
    msg: CountMessage,
  ) -> Result<IdMessage, Self::Error> {
    // Ensure the requested count is valid.
    let count = msg.count;
    let chain_stats = self.chain_stats.load(ctx.deps.storage)?;
    if count == 0 || count > chain_stats.activities_count {
      return Err(ChainbillsError::InvalidChainActivityCount { count });
    }

    // Get and return the Activity ID.
    let ids = self.chain_activity_ids.load(ctx.deps.storage)?;
    let id = HexBinary::from(ids[(count - 1) as usize]).to_hex();
    Ok(IdMessage { id })
  }

  fn user_activity_id(
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
    if count == 0 || count > user.activities_count {
      return Err(ChainbillsError::InvalidUserActivityCount { count });
    }

    // Get and return the Activity ID.
    let ids = self
      .user_activity_ids
      .load(ctx.deps.storage, &valid_wallet)?;
    let id = HexBinary::from(ids[(count - 1) as usize]).to_hex();
    Ok(IdMessage { id })
  }

  fn payable_activity_id(
    &self,
    ctx: QueryCtx,
    msg: FetchIdMessage,
  ) -> Result<IdMessage, Self::Error> {
    // Ensure that the payable_id is valid.
    let payable_id =
      <[u8; 32]>::try_from(HexBinary::from_hex(&msg.reference)?.as_slice())
        .unwrap();
    if !self.payables.has(ctx.deps.storage, payable_id) {
      return Err(ChainbillsError::InvalidPayableId { id: msg.reference });
    }
    let payable = self.payables.load(ctx.deps.storage, payable_id)?;
    let count = msg.count;

    // Ensure the requested count is valid.
    if count == 0 || count > payable.activities_count {
      return Err(ChainbillsError::InvalidPayableActivityCount { count });
    }

    // Get and return the Payment ID.
    let ids = self
      .payable_activity_ids
      .load(ctx.deps.storage, payable_id)?;
    let id = HexBinary::from(ids[(count - 1) as usize]).to_hex();
    Ok(IdMessage { id })
  }

  fn activity(
    &self,
    ctx: QueryCtx,
    msg: IdMessage,
  ) -> Result<ActivityRecord, Self::Error> {
    match self.activities.may_load(
      ctx.deps.storage,
      <[u8; 32]>::try_from(HexBinary::from_hex(&msg.id)?.as_slice()).unwrap(),
    )? {
      Some(activity) => Ok(activity),
      None => Err(ChainbillsError::InvalidActivityId { id: msg.id }),
    }
  }
}
