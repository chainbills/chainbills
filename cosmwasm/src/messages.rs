use sylvia::cw_schema::cw_serde;
use sylvia::cw_std::Uint128;

#[cw_serde(crate = "sylvia::cw_schema")]
pub struct InstantiateMessage {
  pub chain_id: u16,
  pub owner: String,
  pub chainbills_fee_collector: String,
  pub native_denom: String,
}

#[cw_serde(crate = "sylvia::cw_schema")]
pub struct TokenAndAmountMessage {
  pub token: String,
  pub amount: Uint128,
}

#[cw_serde(crate = "sylvia::cw_schema")]
pub struct FetchMaxFeeMessage {
  pub token: String,
}

#[cw_serde(crate = "sylvia::cw_schema")]
pub struct FetchMaxFeeResponse {
  pub max_fee: Uint128,
}

#[cw_serde(crate = "sylvia::cw_schema")]
pub struct CreatePayableMessage {
  pub allowed_tokens_and_amounts: Vec<TokenAndAmountMessage>,
}

#[cw_serde(crate = "sylvia::cw_schema")]
pub struct IdMessage {
  pub id: String,
}

#[cw_serde(crate = "sylvia::cw_schema")]
pub struct FetchIdMessage {
  pub reference: String,
  pub count: u64,
}

#[cw_serde(crate = "sylvia::cw_schema")]
pub struct UpdatePayableTokensAndAmountsMessage {
  pub payable_id: String,
  pub allowed_tokens_and_amounts: Vec<TokenAndAmountMessage>,
}

#[cw_serde(crate = "sylvia::cw_schema")]
pub struct TransactionInfoMessage {
  pub payable_id: String,
  pub token: String,
  pub amount: Uint128,
}
