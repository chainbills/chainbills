use crate::error::ChainbillsError;
use crate::messages::{
  AddressMessage, CountMessage, IdMessage, InstantiateMessage,
};
use crate::state::{
  ActivityRecord, ActivityType, ChainStats, Config, Payable, PayablePayment,
  TokenAndAmount, TokenDetails, User, UserPayment, Withdrawal,
};
use cw2::set_contract_version;
use cw20::Cw20ExecuteMsg;
use cw_storage_plus::{Item, Map};
use sha2::{Digest, Sha256};
use sylvia::cw_std::{
  to_json_binary, Addr, Api, Attribute, BankMsg, Coin, Env, HexBinary,
  Response, StdResult, Storage, Uint128, WasmMsg,
};
use sylvia::types::{ExecCtx, InstantiateCtx, QueryCtx};
#[allow(unused_imports)]
// RustRover IDE doesn't see the use of `entry_points` macro.
use sylvia::{contract, entry_points};

const CONTRACT_NAME: &str = "crates.io:chainbills";
const CONTRACT_VERSION: &str = env!("CARGO_PKG_VERSION");

pub struct Chainbills {
  pub config: Item<Config>,
  pub chain_stats: Item<ChainStats>,
  pub token_details: Map<String, TokenDetails>,
  pub chain_user_addresses: Item<Vec<Addr>>,
  pub chain_payable_ids: Item<Vec<[u8; 32]>>,
  pub chain_user_payment_ids: Item<Vec<[u8; 32]>>,
  pub chain_payable_payment_ids: Item<Vec<[u8; 32]>>,
  pub chain_withdrawal_ids: Item<Vec<[u8; 32]>>,
  pub chain_activity_ids: Item<Vec<[u8; 32]>>,
  pub activities: Map<[u8; 32], ActivityRecord>,
  pub users: Map<&'static Addr, User>,
  pub user_payable_ids: Map<&'static Addr, Vec<[u8; 32]>>,
  pub user_payments: Map<[u8; 32], UserPayment>,
  pub user_payment_ids: Map<&'static Addr, Vec<[u8; 32]>>,
  pub user_withdrawal_ids: Map<&'static Addr, Vec<[u8; 32]>>,
  pub user_activity_ids: Map<&'static Addr, Vec<[u8; 32]>>,
  pub payables: Map<[u8; 32], Payable>,
  pub payable_payments: Map<[u8; 32], PayablePayment>,
  pub payable_payment_ids: Map<[u8; 32], Vec<[u8; 32]>>,
  pub payable_withdrawal_ids: Map<[u8; 32], Vec<[u8; 32]>>,
  pub payable_activity_ids: Map<[u8; 32], Vec<[u8; 32]>>,
  pub per_chain_payable_payments_count: Map<(Vec<u8>, u16), u64>,
  pub per_chain_payable_payment_ids: Map<(Vec<u8>, u16), Vec<[u8; 32]>>,
  pub withdrawals: Map<[u8; 32], Withdrawal>,
}

#[cfg_attr(not(feature = "library"), entry_points)]
#[contract]
#[sv::error(crate::error::ChainbillsError)]
#[sv::messages(crate::interfaces::activities as Activities)]
#[sv::messages(crate::interfaces::payables as Payables)]
#[sv::messages(crate::interfaces::payments as Payments)]
#[sv::messages(crate::interfaces::token_details as TokenDetailsInterface)]
#[sv::messages(crate::interfaces::withdrawals as Withdrawals)]
impl Chainbills {
  pub const fn new() -> Self {
    Self {
      config: Item::new("config"),
      chain_stats: Item::new("chain_stats"),
      token_details: Map::new("token_details"),
      chain_user_addresses: Item::new("chain_user_addresses"),
      chain_payable_ids: Item::new("chain_payable_ids"),
      chain_user_payment_ids: Item::new("chain_user_payment_ids"),
      chain_payable_payment_ids: Item::new("chain_payable_payment_ids"),
      chain_withdrawal_ids: Item::new("chain_withdrawal_ids"),
      chain_activity_ids: Item::new("chain_activity_ids"),
      activities: Map::new("activities"),
      users: Map::new("users"),
      user_payable_ids: Map::new("user_payable_ids"),
      user_payments: Map::new("user_payments"),
      user_payment_ids: Map::new("user_payment_ids"),
      user_withdrawal_ids: Map::new("user_withdrawal_ids"),
      user_activity_ids: Map::new("user_activity_ids"),
      payables: Map::new("payables"),
      payable_payments: Map::new("payable_payments"),
      payable_payment_ids: Map::new("payable_payment_ids"),
      payable_withdrawal_ids: Map::new("payable_withdrawal_ids"),
      payable_activity_ids: Map::new("payable_activity_ids"),
      per_chain_payable_payments_count: Map::new(
        "per_chain_payable_payments_count",
      ),
      per_chain_payable_payment_ids: Map::new("per_chain_payable_payment_ids"),
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
      .save(ctx.deps.storage, &mut ChainStats::initialize())?;

    // Initialize Config
    let cbfc = ctx.deps.api.addr_validate(&msg.chainbills_fee_collector)?;
    self.config.save(
      ctx.deps.storage,
      &Config {
        chain_id: msg.chain_id,
        owner: ctx.info.sender.clone(),
        chainbills_fee_collector: cbfc,
        withdrawal_fee_percentage: Uint128::new(200),
      },
    )?;

    // Initialize Chain-Level Arrays
    self.chain_user_addresses.save(ctx.deps.storage, &vec![])?;
    self.chain_payable_ids.save(ctx.deps.storage, &vec![])?;
    self
      .chain_user_payment_ids
      .save(ctx.deps.storage, &vec![])?;
    self
      .chain_payable_payment_ids
      .save(ctx.deps.storage, &vec![])?;
    self.chain_withdrawal_ids.save(ctx.deps.storage, &vec![])?;
    self.chain_activity_ids.save(ctx.deps.storage, &vec![])?;

    // Emit an event and return a response.
    Ok(Response::new().add_attributes([
      ("action", "instantiated"),
      ("owner", &*ctx.info.sender.as_str()),
      ("version", CONTRACT_VERSION),
    ]))
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

  #[sv::msg(query)]
  fn chain_user_address(
    &self,
    ctx: QueryCtx,
    msg: CountMessage,
  ) -> Result<AddressMessage, ChainbillsError> {
    // Ensure the requested count is valid.
    let count = msg.count;
    let chain_stats = self.chain_stats.load(ctx.deps.storage)?;
    if count == 0 || count > chain_stats.users_count {
      return Err(ChainbillsError::InvalidChainUserAddressCount { count });
    }

    // Get and return the User Address.
    let addresses = self.chain_user_addresses.load(ctx.deps.storage)?;
    Ok(AddressMessage {
      address: addresses[(count - 1) as usize].clone(),
    })
  }

  #[sv::msg(exec)]
  fn owner_withdraw(
    &self,
    ctx: ExecCtx,
    msg: TokenAndAmount,
  ) -> Result<Response, ChainbillsError> {
    // Ensure the caller is the owner.
    let config = self.config.load(ctx.deps.storage)?;
    if ctx.info.sender != config.owner {
      return Err(ChainbillsError::OwnerUnauthorized {});
    }

    // Extract the token and amount for the payment.
    let TokenAndAmount { token, amount } = msg;

    // Ensure that the specified amount is greater than zero.
    if amount.is_zero() {
      return Err(ChainbillsError::ZeroAmountSpecified {});
    }

    // Ensure the token is supported and know if it is a native one.
    let TokenDetails {
      is_native_token, ..
    } = match self
      .token_details
      .may_load(ctx.deps.storage, token.clone())?
    {
      Some(details) => Ok(details),
      None => Err(ChainbillsError::InvalidToken {
        token: token.clone(),
      }),
    }?;

    // Prepare messages for transfer to add to the response.
    let mut bank_messages = vec![];
    let mut cw20_messages = vec![];
    if is_native_token {
      bank_messages.push(BankMsg::Send {
        to_address: ctx.info.sender.to_string(),
        amount: vec![Coin {
          denom: token.clone(),
          amount,
        }],
      });
    } else {
      cw20_messages.push(WasmMsg::Execute {
        contract_addr: token.clone(),
        funds: vec![],
        msg: to_json_binary(&Cw20ExecuteMsg::Transfer {
          recipient: ctx.info.sender.to_string(),
          amount,
        })?,
      });
    }

    // Return the Response.
    Ok(
      Response::new()
          .add_messages(bank_messages) // Add the bank messages
          .add_messages(cw20_messages) // Add the cw20 me
          .add_attributes([
            ("action", "owner_withdrew".to_string()),
            ("token", token),
            ("is_native_token", is_native_token.to_string()),
            ("amount", amount.to_string()),
          ]),
    )
  }

  pub fn initialize_user_if_is_new(
    &self,
    storage: &mut dyn Storage,
    env: &Env,
    wallet: &Addr,
  ) -> StdResult<Vec<Attribute>> {
    let mut response_attribs: Vec<Attribute> = vec![];

    // If this is the first time this wallet is interacting with the contract
    if !self.users.has(storage, wallet) {
      // Increment chain count for users and activities.
      let mut chain_stats = self.chain_stats.load(storage)?;
      chain_stats.users_count = chain_stats.next_user();
      chain_stats.activities_count = chain_stats.next_activity();
      self.chain_stats.save(storage, &chain_stats)?;

      // Initialize the user.
      self.users.save(
        storage,
        wallet,
        &User::initialize(chain_stats.users_count),
      )?;

      // Save the user address to user_addresses.
      let mut chain_user_addresses = self.chain_user_addresses.load(storage)?;
      chain_user_addresses.push(wallet.clone());
      self
        .chain_user_addresses
        .save(storage, &chain_user_addresses)?;

      // Get a new ActivityRecord ID.
      let activity_id =
        self.create_id(storage, env, &wallet.to_string(), "activity", 1)?;

      // Save the ActivityRecord ID to chain_activity_ids.
      let mut chain_activity_ids = self.chain_activity_ids.load(storage)?;
      chain_activity_ids.push(activity_id);
      self.chain_activity_ids.save(storage, &chain_activity_ids)?;

      // Save the ActivityRecord ID to user_activity_ids.
      self
        .user_activity_ids
        .save(storage, &wallet, &vec![activity_id])?;

      // Create and Save the ActivityRecord.
      self.activities.save(
        storage,
        activity_id,
        &ActivityRecord {
          chain_count: chain_stats.activities_count,
          user_count: 1,
          payable_count: 0, // no payable involved
          timestamp: env.block.time.seconds(),
          entity: wallet.to_string(),
          activity_type: ActivityType::InitializedUser,
        },
      )?;

      // Set the response attributes
      response_attribs.append(&mut vec![
        Attribute::from(("action", "initialized_user".to_string())),
        Attribute::from(("wallet", wallet.as_str())),
        Attribute::from(("chain_count", chain_stats.users_count.to_string())),
      ]);
    }

    Ok(response_attribs)
  }

  pub fn create_id(
    &self,
    storage: &dyn Storage,
    env: &Env,
    reference: &str,
    salt: &str,
    count: u64,
  ) -> StdResult<[u8; 32]> {
    let mut hasher = Sha256::new();
    hasher.update(env.block.chain_id.as_bytes());
    hasher.update(self.config.load(storage)?.chain_id.to_le_bytes());
    hasher.update(env.block.time.seconds().to_le_bytes());
    hasher.update(reference.as_bytes());
    hasher.update(salt.as_bytes());
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

  pub fn save_activity_id_for_all(
    &self,
    storage: &mut dyn Storage,
    wallet: &Addr,
    payable_id: [u8; 32],
    activity_id: [u8; 32],
  ) -> StdResult<()> {
    // Save the ActivityRecord ID to chain_activity_ids.
    let mut chain_activity_ids = self.chain_activity_ids.load(storage)?;
    chain_activity_ids.push(activity_id);
    self.chain_activity_ids.save(storage, &chain_activity_ids)?;

    // Save the ActivityRecord ID to user_activity_ids.
    let mut user_activity_ids = self.user_activity_ids.load(storage, wallet)?;
    user_activity_ids.push(activity_id);
    self
      .user_activity_ids
      .save(storage, &wallet, &user_activity_ids)?;

    // Save the ActivityRecord ID to payable_activity_ids.
    let mut payable_activity_ids = self
      .payable_activity_ids
      .may_load(storage, payable_id)?
      .unwrap_or_default();
    payable_activity_ids.push(activity_id);
    self.payable_activity_ids.save(
      storage,
      payable_id,
      &payable_activity_ids,
    )?;

    Ok(())
  }

  pub fn record_update_payable_activity(
    &self,
    storage: &mut dyn Storage,
    env: &Env,
    wallet: &Addr,
    payable_id: [u8; 32],
    payable_count: u64,
    activity_type: ActivityType,
  ) -> StdResult<()> {
    /* COUNTS */
    // Increment the chain stats for activities_count.
    let mut chain_stats = self.chain_stats.load(storage)?;
    chain_stats.activities_count = chain_stats.next_activity();
    self.chain_stats.save(storage, &chain_stats)?;

    // Increment activities counts on the host (address) making the update.
    let mut user = self.users.load(storage, wallet)?;
    user.activities_count = user.next_activity();
    self.users.save(storage, wallet, &user)?;

    // Not Retrieving the Payable to update the activities count in it because
    // the caller should have done so. This is to avoid more reads and writes.

    // Get a new ActivityRecord ID.
    let activity_id = self.create_id(
      storage,
      env,
      &wallet.to_string(),
      "activity",
      user.activities_count,
    )?;

    // Save the ActivityRecord ID for all.
    self.save_activity_id_for_all(storage, wallet, payable_id, activity_id)?;

    // Create and Save the ActivityRecord.
    self.activities.save(
      storage,
      activity_id,
      &ActivityRecord {
        chain_count: chain_stats.activities_count,
        user_count: user.activities_count,
        payable_count,
        timestamp: env.block.time.seconds(),
        entity: HexBinary::from(&payable_id).to_hex(),
        activity_type,
      },
    )?;

    Ok(())
  }
}
