use chainbills::contract::sv::{
    ContractExecMsg, ContractQueryMsg, InstantiateMsg,
};
use sylvia::cw_schema::write_api;

fn main() {
  write_api! {
      instantiate: InstantiateMsg,
      execute: ContractExecMsg,
      query: ContractQueryMsg,
  }
}
