use crate::contract::sv::mt::{ChainbillsProxy, CodeId};
use crate::interfaces::activities::sv::mt::ActivitiesProxy;
use crate::interfaces::payables::sv::mt::PayablesProxy;
use crate::interfaces::payments::sv::mt::PaymentsProxy;
use crate::interfaces::token_details::sv::mt::TokenDetailsInterfaceProxy;
use crate::messages::{
  CountMessage, CreatePayableMessage, FetchIdMessage, IdMessage, InstantiateMessage, TransactionInfoMessage, UpdateMaxWithdrawalFeesMessage
};
use cw20::{BalanceResponse, Cw20Coin};
use cw20_base::msg::InstantiateMsg;
use sylvia::cw_multi_test::{Contract, ContractWrapper, Executor, IntoAddr};
use sylvia::cw_std::{coins, Empty, StdResult, Uint128};
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
fn making_payments() {
  let owner = "owner".into_addr();
  let user = "user".into_addr();

  let mut app = sylvia::cw_multi_test::App::new(|router, _api, storage| {
    router
      .bank
      .init_balance(storage, &user, coins(100, "native"))
      .unwrap();
  });
  let cw20_id = app.store_code(contract_cw20());
  let usdc_addr = app
    .instantiate_contract(
      cw20_id,
      owner.clone(),
      &InstantiateMsg {
        name: "USDC".to_string(),
        symbol: "USDC".to_string(),
        decimals: 6,
        initial_balances: vec![Cw20Coin {
          address: user.to_string(),
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

  let app = App::new(app);
  let code_id = CodeId::store_code(&app);
  let fee_collector = "fee_collector".into_addr();
  let init_msg = InstantiateMessage {
    chain_id: 1,
    chainbills_fee_collector: fee_collector.to_string(),
  };
  let contract = code_id.instantiate(init_msg).call(&owner).unwrap();

  // Create a Payable
  let payable_resp = contract
    .create_payable(CreatePayableMessage {
      allowed_tokens_and_amounts: vec![],
    })
    .call(&owner)
    .unwrap();
  let payable_id = payable_resp
    .events
    .iter()
    .find(|ev| ev.ty == "wasm")
    .unwrap()
    .attributes
    .iter()
    .find(|attr| attr.key == "payable_id")
    .unwrap()
    .value
    .clone();

  // Fetch and Log Created Payable Details
  let mut chain_stats = contract.chain_stats().unwrap();
  let mut user_data = contract
    .user(IdMessage {
      id: user.to_string(),
    })
    .unwrap();
  let mut payable = contract
    .payable(IdMessage {
      id: payable_id.clone(),
    })
    .unwrap();
  println!("{:?}", chain_stats);
  println!("{:?}", user_data);
  println!("Payable ID: {:?}", payable_id.clone());
  println!("{:?}", payable);
  println!(
    "User Native Balance Before Payments: {:?}",
    app.querier().query_balance(&user, "native")
  );
  println!(
    "Contract Native Balance Before Payments: {:?}",
    app
      .querier()
      .query_balance(&contract.contract_addr, "native")
  );
  println!(
    "User USDC Balance Before Payments: {:?}",
    (app.querier().query_wasm_smart(
      &usdc_addr.clone(),
      &cw20::Cw20QueryMsg::Balance {
        address: user.clone().to_string(),
      }
    ) as StdResult<BalanceResponse>)
      .unwrap()
  );
  println!(
    "Contract USDC Balance Before Payments: {:?}",
    (app.querier().query_wasm_smart(
      &usdc_addr.clone(),
      &cw20::Cw20QueryMsg::Balance {
        address: contract.contract_addr.clone().to_string(),
      }
    ) as StdResult<BalanceResponse>)
      .unwrap()
  );

  // Set MaxWithdrawalFees for Native Token
  contract
    .update_max_withdrawal_fees(UpdateMaxWithdrawalFeesMessage {
      token: "native".to_string(),
      max_withdrawal_fees: Uint128::new(100),
      is_native_token: true,
    })
    .call(&owner)
    .unwrap();

  // Set MaxWithdrawalFees for Cw20 Token
  contract
    .update_max_withdrawal_fees(UpdateMaxWithdrawalFeesMessage {
      token: usdc_addr.clone().to_string(),
      max_withdrawal_fees: Uint128::new(100),
      is_native_token: false,
    })
    .call(&owner)
    .unwrap();

  // Native TokenDetails
  let mut native_token_details = contract
    .token_details(IdMessage {
      id: "native".to_string(),
    })
    .unwrap();
  println!("Native TokenDetails: {:?}", native_token_details);

  // Cw20 TokenDetails
  let mut cw20_token_details = contract
    .token_details(IdMessage {
      id: usdc_addr.clone().to_string(),
    })
    .unwrap();
  println!("Cw20 TokenDetails: {:?}", cw20_token_details);

  // Make a Payment in Native Token
  contract
    .pay(TransactionInfoMessage {
      payable_id: payable_id.clone(),
      token: "native".to_string(),
      amount: Uint128::new(100),
    })
    .with_funds(&coins(100, "native"))
    .call(&user)
    .unwrap();

  // Approve Spend for Cw20 Token
  app
    .app_mut()
    .execute_contract(
      user.clone(),
      usdc_addr.clone(),
      &cw20::Cw20ExecuteMsg::IncreaseAllowance {
        spender: contract.contract_addr.clone().to_string(),
        amount: Uint128::new(100),
        expires: None,
      },
      &[],
    )
    .unwrap();

  // Make a Payment in Cw20 Token
  contract
    .pay(TransactionInfoMessage {
      payable_id: payable_id.clone(),
      token: usdc_addr.clone().to_string(),
      amount: Uint128::new(100),
    })
    .call(&user)
    .unwrap();

  // Fetch and Log Payment Details
  println!();
  println!("After Payment");
  println!();
  chain_stats = contract.chain_stats().unwrap();
  user_data = contract
    .user(IdMessage {
      id: user.to_string(),
    })
    .unwrap();
  native_token_details = contract
    .token_details(IdMessage {
      id: "native".to_string(),
    })
    .unwrap();
  cw20_token_details = contract
    .token_details(IdMessage {
      id: usdc_addr.clone().to_string(),
    })
    .unwrap();
  payable = contract
    .payable(IdMessage {
      id: payable_id.clone(),
    })
    .unwrap();
  let upid_res = contract
    .user_payment_id(FetchIdMessage {
      reference: user.to_string(),
      count: user_data.payments_count,
    })
    .unwrap();
  let user_payment = contract
    .user_payment(IdMessage {
      id: upid_res.clone().id,
    })
    .unwrap();
  let pypdid_res = contract
    .payable_payment_id(FetchIdMessage {
      reference: payable_id.clone(),
      count: payable.payments_count,
    })
    .unwrap();
  let payable_payment = contract
    .payable_payment(IdMessage {
      id: pypdid_res.clone().id,
    })
    .unwrap();
  println!("{:?}", chain_stats);
  println!("{:?}", user_data);
  println!("Native TokenDetails: {:?}", native_token_details);
  println!("Cw20 TokenDetails: {:?}", cw20_token_details);
  println!("Payable ID: {:?}", payable_id.clone());
  println!("{:?}", payable);
  println!("UserPayment ID: {:?}", upid_res.clone().id);
  println!("{:?}", user_payment);
  println!("PayablePayment ID: {:?}", pypdid_res.clone().id);
  println!("{:?}", payable_payment);
  println!(
    "User Native Balance After Payment: {:?}",
    app.querier().query_balance(&user, "native")
  );
  println!(
    "Contract Native Balance After Payment: {:?}",
    app
      .querier()
      .query_balance(&contract.contract_addr, "native")
  );
  println!(
    "User USDC Balance After Payments: {:?}",
    (app.querier().query_wasm_smart(
      &usdc_addr.clone(),
      &cw20::Cw20QueryMsg::Balance {
        address: user.clone().to_string(),
      }
    ) as StdResult<BalanceResponse>)
      .unwrap()
  );
  println!(
    "Contract USDC Balance After Payments: {:?}",
    (app.querier().query_wasm_smart(
      &usdc_addr.clone(),
      &cw20::Cw20QueryMsg::Balance {
        address: contract.contract_addr.clone().to_string(),
      }
    ) as StdResult<BalanceResponse>)
      .unwrap()
  );

    // Fetch and Display Activities
    println!();
    println!();
    println!("CHAIN ACTIVITIES");
    for i in 0..chain_stats.activities_count {
        let id_msg = contract
            .chain_activity_id(CountMessage { count: i + 1 })
            .unwrap();
        let activity = contract.activity(id_msg.clone()).unwrap();
        println!(
            "Count {:?}, ID {:?}, {:?}",
            i + 1,
            id_msg.clone().id,
            activity
        );
    }
    println!();
    println!();
    println!("USER ACTIVITIES");
    for i in 0..user_data.activities_count {
        let id_msg = contract
            .user_activity_id(FetchIdMessage { reference: user.to_string(), count: i + 1 })
            .unwrap();
        let activity = contract.activity(id_msg.clone()).unwrap();
        println!(
            "Count {:?}, ID {:?}, {:?}",
            i + 1,
            id_msg.clone().id,
            activity
        );
    }
    println!();
    println!();
    println!("PAYABLE ACTIVITIES");
    for i in 0..payable.activities_count {
        let id_msg = contract
            .payable_activity_id(FetchIdMessage { reference: payable_id.clone(), count: i + 1 })
            .unwrap();
        let activity = contract.activity(id_msg.clone()).unwrap();
        println!(
            "Count {:?}, ID {:?}, {:?}",
            i + 1,
            id_msg.clone().id,
            activity
        );
    }
}
