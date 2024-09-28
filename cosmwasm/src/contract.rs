use crate::error::ChainbillsError;
use crate::messages::{IdMessage, InstantiateMessage};
use crate::state::{
  ChainStats, Config, MaxWithdrawalFeeDetails, Payable, PayablePayment, User,
  UserPayment, Withdrawal,
};
use cw2::set_contract_version;
use cw20::Cw20ExecuteMsg;
use cw_storage_plus::{Item, Map};
use sha2::{Digest, Sha256};
use sylvia::cw_std::{
  to_json_binary, Addr, Api, Attribute, BankMsg, Coin, Env, Event, Response,
  StdResult, Storage, Uint128, WasmMsg,
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
  pub max_fees_per_token: Map<String, MaxWithdrawalFeeDetails>,
  pub users: Map<&'static Addr, User>,
  pub user_payable_ids: Map<&'static Addr, Vec<[u8; 32]>>,
  pub user_payments: Map<[u8; 32], UserPayment>,
  pub user_payment_ids: Map<&'static Addr, Vec<[u8; 32]>>,
  pub user_withdrawal_ids: Map<&'static Addr, Vec<[u8; 32]>>,
  pub payables: Map<[u8; 32], Payable>,
  pub payable_payments: Map<[u8; 32], PayablePayment>,
  pub payable_payment_ids: Map<[u8; 32], Vec<[u8; 32]>>,
  pub payable_withdrawal_ids: Map<[u8; 32], Vec<[u8; 32]>>,
  pub per_chain_payable_payments_count: Map<(Vec<u8>, u16), u64>,
  pub per_chain_payable_payment_ids: Map<(Vec<u8>, u16), Vec<[u8; 32]>>,
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
      .save(ctx.deps.storage, &mut ChainStats::initialize(msg.chain_id))?;

    // Initialize Config
    let cbfc = ctx.deps.api.addr_validate(&msg.chainbills_fee_collector)?;
    self.config.save(
      ctx.deps.storage,
      &Config {
        owner: ctx.info.sender.clone(),
        chainbills_fee_collector: cbfc,
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

  #[sv::msg(exec)]
  fn owner_withdraw(
    &self,
    ctx: ExecCtx,
    msg: MaxWithdrawalFeeDetails,
  ) -> Result<Response, ChainbillsError> {
    // Ensure the caller is the owner.
    let config = self.config.load(ctx.deps.storage)?;
    if ctx.info.sender != config.owner {
      return Err(ChainbillsError::OwnerUnauthorized {});
    }

    // Extract the details token and amount for the withdrawal.
    let MaxWithdrawalFeeDetails {
      token,
      max_fee: amount,
      is_native_token,
    } = msg;

    // If the token is not a native one, ensure it is a valid token address.
    if !is_native_token {
      ctx.deps.api.addr_validate(&token.clone())?;
    }

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
            ("action", "owner_withdraw".to_string()),
            ("token", token),
            ("is_native_token", is_native_token.to_string()),
            ("amount", amount.to_string()),
          ]),
    )
  }

  pub fn initialize_user_if_is_new(
    &self,
    storage: &mut dyn Storage,
    wallet: &Addr,
  ) -> StdResult<Vec<Attribute>> {
    let mut response_attribs: Vec<Attribute> = vec![];

    // If this is the first time this wallet is interacting with the contract
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

      // Set the response attributes
      response_attribs.append(&mut vec![
        Attribute::from(("action", "initialize_user".to_string())),
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
