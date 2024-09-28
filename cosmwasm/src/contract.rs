use crate::messages::{IdMessage, InstantiateMessage};
use crate::state::{
  ChainStats, Config, Payable, PayablePayment, User, UserPayment, Withdrawal,
};
use cw2::set_contract_version;
use cw_storage_plus::{Item, Map};
use sha2::{Digest, Sha256};
use sylvia::cw_std::{
  Addr, Api, Env, Event, Response, StdResult, Storage, Uint128,
};
use sylvia::types::{InstantiateCtx, QueryCtx};
#[allow(unused_imports)]
// RustRover IDE doesn't see the use of `entry_points` macro.
use sylvia::{contract, entry_points};

const CONTRACT_NAME: &str = "crates.io:chainbills";
const CONTRACT_VERSION: &str = env!("CARGO_PKG_VERSION");

pub struct Chainbills {
  pub config: Item<Config>,
  pub chain_stats: Item<ChainStats>,
  pub max_fees_per_token: Map<&'static Addr, Uint128>,
  pub users: Map<&'static Addr, User>,
  pub user_payable_ids: Map<&'static Addr, Vec<[u8; 32]>>,
  pub user_payments: Map<[u8; 32], UserPayment>,
  pub user_payment_ids: Map<&'static Addr, Vec<[u8; 32]>>,
  pub user_withdrawal_ids: Map<&'static Addr, Vec<[u8; 32]>>,
  pub payables: Map<[u8; 32], Payable>,
  pub payable_payments: Map<[u8; 32], PayablePayment>,
  pub payable_payment_ids: Map<[u8; 32], Vec<[u8; 32]>>,
  pub payable_withdrawal_ids: Map<[u8; 32], Vec<[u8; 32]>>,
  pub payable_chain_payments_count: Map<(Vec<u8>, u16), u64>,
  pub withdrawals: Map<[u8; 32], Withdrawal>,
}

#[cfg_attr(not(feature = "library"), entry_points)]
#[contract]
#[sv::error(crate::error::ChainbillsError)]
#[sv::messages(crate::interfaces::max_withdrawal_fees as MaxWithdrawalFees)]
#[sv::messages(crate::interfaces::payables as Payables)]
#[sv::messages(crate::interfaces::payments as Payments)]
#[sv::messages(crate::interfaces::withdrawals as Withdrawals)]
impl Chainbills {
  pub const fn new() -> Self {
    Self {
      config: Item::new("config"),
      chain_stats: Item::new("chain_stats"),
      max_fees_per_token: Map::new("max_fees_per_token"),
      users: Map::new("users"),
      user_payable_ids: Map::new("user_payable_ids"),
      user_payments: Map::new("user_payments"),
      user_payment_ids: Map::new("user_payment_ids"),
      user_withdrawal_ids: Map::new("user_withdrawal_ids"),
      payables: Map::new("payables"),
      payable_payments: Map::new("payable_payments"),
      payable_payment_ids: Map::new("payable_payment_ids"),
      payable_withdrawal_ids: Map::new("payable_withdrawal_ids"),
      payable_chain_payments_count: Map::new("payable_chain_payments_count"),
      withdrawals: Map::new("withdrawals"),
    }
  }

  #[sv::msg(instantiate)]
  fn instantiate(
    &self,
    ctx: InstantiateCtx,
    msg: InstantiateMessage,
  ) -> StdResult<Response> {
    // Set Contract Version
    set_contract_version(ctx.deps.storage, CONTRACT_NAME, CONTRACT_VERSION)?;

    // Initialize ChainStats
    self
      .chain_stats
      .save(ctx.deps.storage, &mut ChainStats::initialize(msg.chain_id))?;

    // Initialize Config
    let cbfc = ctx.deps.api.addr_validate(&msg.chainbills_fee_collector)?;
    self.config.save(
      ctx.deps.storage,
      &Config {
        owner: ctx.info.sender.clone(),
        chainbills_fee_collector: cbfc,
        native_denom: msg.native_denom,
        withdrawal_fee_percentage: Uint128::new(2),
      },
    )?;

    // Emit an event and return a response.
    let attributes = [
      ("owner", &*ctx.info.sender.as_str()),
      ("version", CONTRACT_VERSION),
    ];
    let res = Response::new()
      .add_event(Event::new("instantiated").add_attributes(attributes.clone()))
      .add_attribute("action", "instantiate")
      .add_attributes(attributes.clone());
    Ok(res)
  }

  #[sv::msg(query)]
  fn chain_stats(&self, ctx: QueryCtx) -> StdResult<ChainStats> {
    Ok(self.chain_stats.load(ctx.deps.storage)?)
  }

  #[sv::msg(query)]
  fn config(&self, ctx: QueryCtx) -> StdResult<Config> {
    Ok(self.config.load(ctx.deps.storage)?)
  }

  #[sv::msg(query)]
  fn user(&self, ctx: QueryCtx, msg: IdMessage) -> StdResult<User> {
    // load and return the user data if found. Otherwise, return an empty
    // user (with chain_id as zero) rather than throwing an error.
    let valid_wallet = ctx.deps.api.addr_validate(&msg.id)?;
    let fetched_user = self.users.load(ctx.deps.storage, &valid_wallet);
    Ok(fetched_user.unwrap_or(User::initialize(0)))
  }

  pub fn initialize_user_if_need_be(
    &self,
    storage: &mut dyn Storage,
    wallet: &Addr,
  ) -> StdResult<Vec<Event>> {
    let mut events = vec![];

    if !self.users.has(storage, wallet) {
      // Increment chain count for users.
      let mut chain_stats = self.chain_stats.load(storage)?;
      chain_stats.users_count = chain_stats.next_user();
      self.chain_stats.save(storage, &chain_stats)?;

      // Initialize the user.
      self.users.save(
        storage,
        wallet,
        &User::initialize(chain_stats.users_count),
      )?;

      // Emit an event.
      events.push(Event::new("initialized_user").add_attributes(vec![
        ("wallet", wallet.as_str()),
        ("chain_count", &chain_stats.users_count.to_string()),
      ]));
    }

    Ok(events)
  }

  pub fn create_id(
    &self,
    storage: &dyn Storage,
    env: &Env,
    wallet: &Addr,
    count: u64,
  ) -> StdResult<[u8; 32]> {
    let mut hasher = Sha256::new();
    hasher.update(env.block.chain_id.as_bytes());
    hasher.update(self.chain_stats.load(storage)?.chain_id.to_le_bytes());
    hasher.update(env.block.time.seconds().to_le_bytes());
    hasher.update(wallet.as_bytes());
    hasher.update(count.to_le_bytes());
    Ok(hasher.finalize().into())
  }

  pub fn address_to_bytes32(&self, addr: &Addr, api: &dyn Api) -> [u8; 32] {
    let slice = api.addr_canonicalize(addr.as_ref()).unwrap();
    let mut result = [0u8; 32];
    let start = 32 - slice.len();
    result[start..].copy_from_slice(&slice);
    result
  }
}
