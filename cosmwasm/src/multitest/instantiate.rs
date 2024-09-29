use crate::contract::sv::mt::{ChainbillsProxy, CodeId};
use crate::messages::InstantiateMessage;
use sylvia::cw_multi_test::IntoAddr;
use sylvia::multitest::App;

#[test]
fn instantiate() {
  let app = App::default();
  let code_id = CodeId::store_code(&app);

  let owner = "owner".into_addr();
  let fee_collector = "fee_collector".into_addr();
  let init_msg = InstantiateMessage {
    chain_id: 1,
    chainbills_fee_collector: fee_collector.to_string(),
  };
  let contract = code_id.instantiate(init_msg).call(&owner).unwrap();

  let chain_stats = contract.chain_stats().unwrap();
  let config = contract.config().unwrap();

  assert_eq!(chain_stats.chain_id, 1);
  assert_eq!(chain_stats.users_count, 0);
  assert_eq!(config.owner, owner);
  assert_eq!(config.chainbills_fee_collector, fee_collector);
}
