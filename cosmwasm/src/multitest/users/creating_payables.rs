use crate::contract::sv::mt::{ChainbillsProxy, CodeId};
use crate::interfaces::payables::sv::mt::PayablesProxy;
use crate::messages::{
  CreatePayableMessage, FetchIdMessage, IdMessage, InstantiateMessage,
};
use sylvia::cw_multi_test::IntoAddr;
use sylvia::multitest::App;

#[test]
fn creating_payables() {
  let app = App::default();
  let code_id = CodeId::store_code(&app);

  let owner = "owner".into_addr();
  let fee_collector = "fee_collector".into_addr();
  let init_msg = InstantiateMessage {
    chain_id: 1,
    chainbills_fee_collector: fee_collector.to_string(),
  };
  let contract = code_id.instantiate(init_msg).call(&owner).unwrap();
  let user = "user".into_addr();

  // Create a Payable
  contract
    .create_payable(CreatePayableMessage {
      allowed_tokens_and_amounts: vec![],
    })
    .call(&user)
    .unwrap();

  // Fetch and Log Created Payable Details
  let chain_stats = contract.chain_stats().unwrap();
  let user_data = contract
    .user(IdMessage {
      id: user.to_string(),
    })
    .unwrap();
  let payable_id_resp = contract
    .user_payable_id(FetchIdMessage {
      reference: user.to_string(),
      count: user_data.payables_count,
    })
    .unwrap();
  let payable = contract
    .payable(IdMessage {
      id: payable_id_resp.clone().id,
    })
    .unwrap();
  println!("{:?}", chain_stats);
  println!("{:?}", user_data);
  println!("Payable ID: {:?}", payable_id_resp.clone().id);
  println!("{:?}", payable);

  // TODO: Assert payable details and events
}
