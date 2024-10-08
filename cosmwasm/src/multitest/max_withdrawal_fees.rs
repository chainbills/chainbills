use crate::contract::sv::mt::CodeId;
use crate::error::ChainbillsError;
use crate::interfaces::max_withdrawal_fees::sv::mt::MaxWithdrawalFeesProxy;
use crate::messages::{FetchMaxFeeMessage, InstantiateMessage};
use crate::state::MaxWithdrawalFeeDetails;
use sylvia::cw_multi_test::IntoAddr;
use sylvia::cw_std::Uint128;
use sylvia::multitest::App;

#[test]
fn max_withdrawal_fees() {
  let app = App::default();
  let code_id = CodeId::store_code(&app);

  let owner = "owner".into_addr();
  let fee_collector = "fee_collector".into_addr();
  let init_msg = InstantiateMessage {
    chain_id: 1,
    chainbills_fee_collector: fee_collector.to_string(),
  };
  let contract = code_id.instantiate(init_msg).call(&owner).unwrap();

  // Update max withdrawal fee
  let token = "token".into_addr().to_string();
  let amount = Uint128::new(100);
  let resp = contract
    .update_max_withdrawal_fee(MaxWithdrawalFeeDetails {
      token,
      max_fee: amount,
      is_native_token: false,
    })
    .call(&owner)
    .unwrap();

  // TODO: Use resp.assert_event() if need be

  let wasm = resp.events.iter().find(|ev| ev.ty == "wasm").unwrap();
  assert_eq!(
    wasm
      .attributes
      .iter()
      .find(|attr| attr.key == "action")
      .unwrap()
      .value,
    "update_max_withdrawal_fee"
  );
  assert_eq!(
    wasm
      .attributes
      .iter()
      .find(|attr| attr.key == "max_fee")
      .unwrap()
      .value,
    amount.to_string()
  );

  let max_fee_resp = contract
    .max_fee(FetchMaxFeeMessage {
      token: "token".into_addr().to_string(),
    })
    .unwrap();
  assert_eq!(max_fee_resp.max_fee, amount);

  // Unauthorized
  let token = "token".into_addr().to_string();
  let other = "other".into_addr();
  let err = contract
    .update_max_withdrawal_fee(MaxWithdrawalFeeDetails {
      token,
      max_fee: amount,
      is_native_token: false,
    })
    .call(&other)
    .unwrap_err();
  assert_eq!(err, ChainbillsError::OwnerUnauthorized {});

  // Nonexistent token
  let err = contract
    .max_fee(FetchMaxFeeMessage {
      token: "no_exists".into_addr().to_string(),
    })
    .unwrap_err();
  // Testing the error message because a Querrier error is returned
  // instead of a ChainbillsError.
  assert!(err.to_string().contains("Invalid Token"));
}
