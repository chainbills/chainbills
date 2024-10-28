use crate::contract::Chainbills;
use crate::error::ChainbillsError;
use crate::messages::{FetchIdMessage, IdMessage, TransactionInfoMessage};
use crate::state::{TokenAndAmount, TokenDetails, User, Withdrawal};
use cw20::Cw20ExecuteMsg;
use std::cmp::min;
use sylvia::cw_std::{
  to_json_binary, BankMsg, Coin, HexBinary, Response, StdError, Uint128,
  WasmMsg,
};
use sylvia::interface;
use sylvia::types::{ExecCtx, QueryCtx};

#[interface]
pub trait Withdrawals {
  type Error: From<StdError>;

  #[sv::msg(query)]
  fn user_withdrawal_id(
    &self,
    ctx: QueryCtx,
    msg: FetchIdMessage,
  ) -> Result<IdMessage, Self::Error>;

  #[sv::msg(query)]
  fn payable_withdrawal_id(
    &self,
    ctx: QueryCtx,
    msg: FetchIdMessage,
  ) -> Result<IdMessage, Self::Error>;

  #[sv::msg(query)]
  fn withdrawal(
    &self,
    ctx: QueryCtx,
    msg: IdMessage,
  ) -> Result<Withdrawal, Self::Error>;

  #[sv::msg(exec)]
  fn withdraw(
    &self,
    ctx: ExecCtx,
    data: TransactionInfoMessage,
  ) -> Result<Response, Self::Error>;
}

impl Withdrawals for Chainbills {
  type Error = ChainbillsError;

  fn user_withdrawal_id(
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
    if count > user.withdrawals_count {
      return Err(ChainbillsError::InvalidUserWithdrawalCount { count });
    }

    // Get and return the Withdrawal ID.
    let wtdl_ids = self
      .user_withdrawal_ids
      .load(ctx.deps.storage, &valid_wallet)?;
    let id = HexBinary::from(wtdl_ids[(count - 1) as usize]).to_hex();
    Ok(IdMessage { id })
  }

  fn payable_withdrawal_id(
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
    if count > payable.withdrawals_count {
      return Err(ChainbillsError::InvalidPayableWithdrawalCount { count });
    }

    // Get and return the Payment ID.
    let wtdl_ids = self
      .payable_withdrawal_ids
      .load(ctx.deps.storage, payable_id)?;
    let id = HexBinary::from(wtdl_ids[(count - 1) as usize]).to_hex();
    Ok(IdMessage { id })
  }

  fn withdrawal(
    &self,
    ctx: QueryCtx,
    msg: IdMessage,
  ) -> Result<Withdrawal, Self::Error> {
    match self.withdrawals.may_load(
      ctx.deps.storage,
      <[u8; 32]>::try_from(HexBinary::from_hex(&msg.id)?.as_slice()).unwrap(),
    )? {
      Some(withdrawal) => Ok(withdrawal),
      None => Err(ChainbillsError::InvalidWithdrawalId { id: msg.id }),
    }
  }

  fn withdraw(
    &self,
    ctx: ExecCtx,
    msg: TransactionInfoMessage,
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

    // Extract the token and amount for the withdrawal.
    let TransactionInfoMessage { token, amount, .. } = msg;

    // Ensure that the amount to be withdrawn is not zero.
    if amount.is_zero() {
      return Err(ChainbillsError::ZeroAmountSpecified {});
    }

    // - Ensure that this payable has enough of the amount in its balance.
    // - Ensure that the specified token for withdrawal exists in the
    //   payable's balances.
    if payable.balances.is_empty() {
      return Err(ChainbillsError::NoBalanceForWithdrawalToken { token });
    }
    let mut bals_it = payable.balances.iter().peekable();
    while let Some(balance) = bals_it.next() {
      if balance.token == token {
        if balance.amount < amount {
          return Err(ChainbillsError::InsufficientWithdrawAmount {});
        } else {
          break;
        }
      }
      if bals_it.peek().is_none() {
        return Err(ChainbillsError::NoBalanceForWithdrawalToken { token });
      }
    }

    /* TRANSFER */
    // Prepare withdraw amounts and fees
    let config = self.config.load(ctx.deps.storage)?;
    let percent = amount
      .checked_mul(config.withdrawal_fee_percentage)
      .unwrap()
      .checked_div(Uint128::new(10000))  // 10000 is 100%
      .unwrap();
    let mut token_details =
      self.token_details.load(ctx.deps.storage, token.clone())?;
    let TokenDetails {
      is_native_token, // Determine if token is a native one
      max_withdrawal_fees,
      ..
    } = token_details;
    let fees = min(percent, max_withdrawal_fees);
    let amount_due = amount.checked_sub(fees).unwrap();

    // Prepare messages for transfer to add to the response.
    let mut bank_messages = vec![];
    let mut cw20_messages = vec![];
    if is_native_token {
      // Transfer the amount to the host.
      bank_messages.push(BankMsg::Send {
        to_address: ctx.info.sender.to_string(),
        amount: vec![Coin {
          denom: token.clone(),
          amount: amount_due,
        }],
      });
      // Transfer the withdrawal fee to the fee collector.
      bank_messages.push(BankMsg::Send {
        to_address: config.chainbills_fee_collector.to_string(),
        amount: vec![Coin {
          denom: token.clone(),
          amount: fees,
        }],
      });
    } else {
      cw20_messages.push(WasmMsg::Execute {
        contract_addr: token.clone(),
        funds: vec![],
        msg: to_json_binary(&Cw20ExecuteMsg::Transfer {
          recipient: ctx.info.sender.to_string(),
          amount: amount_due,
        })?,
      });
      cw20_messages.push(WasmMsg::Execute {
        contract_addr: token.clone(),
        funds: vec![],
        msg: to_json_binary(&Cw20ExecuteMsg::Transfer {
          recipient: config.chainbills_fee_collector.to_string(),
          amount: fees,
        })?,
      });
    }

    /* STATE CHANGES */
    // Increment the chain stats for withdrawals_count.
    let mut chain_stats = self.chain_stats.load(ctx.deps.storage)?;
    chain_stats.withdrawals_count = chain_stats.next_withdrawal();
    self.chain_stats.save(ctx.deps.storage, &chain_stats)?;

    // Increment withdrawalsCount in the host that just withdrew.
    let mut user = self.users.load(ctx.deps.storage, &ctx.info.sender)?;
    user.withdrawals_count = user.next_withdrawal();
    self.users.save(ctx.deps.storage, &ctx.info.sender, &user)?;

    // Increment withdrawalsCount and deduct balances on the involved payable.
    payable.withdrawals_count = payable.next_withdrawal();
    for balance in payable.balances.iter_mut() {
      if balance.token == token {
        balance.amount = balance.amount.checked_sub(amount).unwrap();
        break;
      }
    }
    self.payables.save(ctx.deps.storage, payable_id, &payable)?;

    // Increase the supported token's totals from this withdrawal.
    token_details.add_withdrawn(amount);
    token_details.add_withdrawal_fees_collected(fees);
    self
      .token_details
      .save(ctx.deps.storage, token.clone(), &token_details)?;

    // Get a new Withdrawal ID
    let withdrawal_id = self.create_id(
      ctx.deps.storage,
      &ctx.env,
      &ctx.info.sender,
      user.payments_count,
    )?;

    // Save the Withdrawal ID to the users_withdrawal_ids.
    let mut user_withdrawal_ids = self
      .user_withdrawal_ids
      .may_load(ctx.deps.storage, &ctx.info.sender)?
      .unwrap_or_default();
    user_withdrawal_ids.push(withdrawal_id);
    self.user_withdrawal_ids.save(
      ctx.deps.storage,
      &ctx.info.sender,
      &user_withdrawal_ids,
    )?;

    // Save the Withdrawal ID to the payables_withdrawal_ids.
    let mut payable_withdrawal_ids = self
      .payable_withdrawal_ids
      .may_load(ctx.deps.storage, payable_id)?
      .unwrap_or_default();
    payable_withdrawal_ids.push(withdrawal_id);
    self.payable_withdrawal_ids.save(
      ctx.deps.storage,
      payable_id,
      &payable_withdrawal_ids,
    )?;

    // Create and Save the Withdrawal.
    let withdrawal = Withdrawal {
      payable_id,
      host: ctx.info.sender.clone(),
      chain_count: chain_stats.withdrawals_count,
      host_count: user.withdrawals_count,
      payable_count: payable.withdrawals_count,
      timestamp: ctx.env.block.time.seconds(),
      details: TokenAndAmount {
        amount,
        token: token.clone(),
      },
    };
    self
      .withdrawals
      .save(ctx.deps.storage, withdrawal_id, &withdrawal)?;

    // Return the Response.
    Ok(
      Response::new()
      .add_messages(bank_messages) // Add the bank messages
      .add_messages(cw20_messages)// Add the cw20 messages
      .add_attributes([
        ("action", "withdrew".to_string()),
        ("payable_id", HexBinary::from(&payable_id).to_hex()),
        ("host_wallet", ctx.info.sender.to_string()),
        ("withdrawal_id", HexBinary::from(&withdrawal_id).to_hex()),
        ("chain_count", chain_stats.withdrawals_count.to_string()),
        ("host_count", user.withdrawals_count.to_string()),
        ("payable_count", payable.withdrawals_count.to_string()),
      ]),
    )
  }
}
