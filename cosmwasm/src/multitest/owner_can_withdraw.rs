use crate::contract::sv::mt::{ChainbillsProxy, CodeId};
use crate::interfaces::token_details::sv::mt::TokenDetailsInterfaceProxy;
use crate::messages::{InstantiateMessage, UpdateMaxWithdrawalFeesMessage};
use crate::state::TokenAndAmount;
use cw20::{BalanceResponse, Cw20Coin};
use cw20_base::msg::InstantiateMsg;
use sylvia::cw_multi_test::{Contract, ContractWrapper, Executor, IntoAddr};
use sylvia::cw_std::{coins, BankMsg, CosmosMsg, Empty, StdResult, Uint128};
use sylvia::multitest::App;

fn contract_cw20() -> Box<dyn Contract<Empty>> {
  let contract = ContractWrapper::new(
    cw20_base::contract::execute,
    cw20_base::contract::instantiate,
    cw20_base::contract::query,
  );
  Box::new(contract)
}

#[test]
fn owner_can_withdraw() {
  let owner = "owner".into_addr();
  let user = "user".into_addr();

  let app = sylvia::cw_multi_test::App::new(|router, _api, storage| {
    router
      .bank
      .init_balance(storage, &user, coins(100, "native"))
      .unwrap();
  });

  let app = App::new(app);
  let code_id = CodeId::store_code(&app);
  let fee_collector = "fee_collector".into_addr();
  let init_msg = InstantiateMessage {
    chain_id: 1,
    chainbills_fee_collector: fee_collector.to_string(),
  };
  let contract = code_id.instantiate(init_msg).call(&owner).unwrap();

  let cw20_id = app.app_mut().store_code(contract_cw20());
  let usdc_addr = app
    .app_mut()
    .instantiate_contract(
      cw20_id,
      owner.clone(),
      &InstantiateMsg {
        name: "USDC".to_string(),
        symbol: "USDC".to_string(),
        decimals: 6,
        initial_balances: vec![Cw20Coin {
          address: contract.contract_addr.clone().to_string(),
          amount: Uint128::new(100),
        }],
        mint: None,
        marketing: None,
      },
      &[],
      "USDC",
      None,
    )
    .unwrap();

  println!(
    "Owner Native Balance: {:?}",
    app.querier().query_balance(&owner, "native")
  );
  println!(
    "User Native Balance: {:?}",
    app.querier().query_balance(&user, "native")
  );
  println!(
    "Contract Native Balance: {:?}",
    app
      .querier()
      .query_balance(&contract.contract_addr, "native")
  );
  println!(
    "Owner USDC Balance: {:?}",
    (app.querier().query_wasm_smart(
      &usdc_addr.clone(),
      &cw20::Cw20QueryMsg::Balance {
        address: owner.clone().to_string(),
      }
    ) as StdResult<BalanceResponse>)
      .unwrap()
  );
  println!(
    "User USDC Balance: {:?}",
    (app.querier().query_wasm_smart(
      &usdc_addr.clone(),
      &cw20::Cw20QueryMsg::Balance {
        address: user.clone().to_string(),
      }
    ) as StdResult<BalanceResponse>)
      .unwrap()
  );
  println!(
    "Contract USDC Balance: {:?}",
    (app.querier().query_wasm_smart(
      &usdc_addr.clone(),
      &cw20::Cw20QueryMsg::Balance {
        address: contract.contract_addr.clone().to_string(),
      }
    ) as StdResult<BalanceResponse>)
      .unwrap()
  );
  println!();

  // Set MaxWithdrawalFee for Native Token and Cw20 Token
  // Necessary for the contract to know if token is native or cw20
  // when making owner withdrawals
  contract
    .update_max_withdrawal_fees(UpdateMaxWithdrawalFeesMessage {
      token: "native".to_string(),
      max_withdrawal_fees: Uint128::new(100),
      is_native_token: true,
    })
    .call(&owner)
    .unwrap();
  contract
    .update_max_withdrawal_fees(UpdateMaxWithdrawalFeesMessage {
      token: usdc_addr.clone().to_string(),
      max_withdrawal_fees: Uint128::new(100),
      is_native_token: false,
    })
    .call(&owner)
    .unwrap();

  // send funds to contract
  let respo = app
    .app_mut()
    .execute_multi(
      user.clone(),
      vec![CosmosMsg::Bank(BankMsg::Send {
        to_address: contract.contract_addr.clone().to_string(),
        amount: coins(100, "native"),
      })],
    )
    .unwrap();
  println!("{:?}", respo);

  // Owner Withdraw for Native Token
  let respo1 = contract
    .owner_withdraw(TokenAndAmount {
      token: "native".to_string(),
      amount: Uint128::new(100),
    })
    .call(&owner)
    .unwrap();
  println!("{:?}", respo1);

  // Owner Withdraw for Cw20 Token
  let respo2 = contract
    .owner_withdraw(TokenAndAmount {
      token: usdc_addr.clone().to_string(),
      amount: Uint128::new(100),
    })
    .call(&owner)
    .unwrap();
  println!("{:?}", respo2);

  println!();
  println!(
    "Owner Native Balance: {:?}",
    app.querier().query_balance(&owner, "native")
  );
  println!(
    "User Native Balance: {:?}",
    app.querier().query_balance(&user, "native")
  );
  println!(
    "Contract Native Balance: {:?}",
    app
      .querier()
      .query_balance(&contract.contract_addr, "native")
  );
  println!(
    "Owner USDC Balance: {:?}",
    (app.querier().query_wasm_smart(
      &usdc_addr.clone(),
      &cw20::Cw20QueryMsg::Balance {
        address: owner.clone().to_string(),
      }
    ) as StdResult<BalanceResponse>)
      .unwrap()
  );
  println!(
    "User USDC Balance: {:?}",
    (app.querier().query_wasm_smart(
      &usdc_addr.clone(),
      &cw20::Cw20QueryMsg::Balance {
        address: user.clone().to_string(),
      }
    ) as StdResult<BalanceResponse>)
      .unwrap()
  );
  println!(
    "Contract USDC Balance: {:?}",
    (app.querier().query_wasm_smart(
      &usdc_addr.clone(),
      &cw20::Cw20QueryMsg::Balance {
        address: contract.contract_addr.clone().to_string(),
      }
    ) as StdResult<BalanceResponse>)
      .unwrap()
  );
}
