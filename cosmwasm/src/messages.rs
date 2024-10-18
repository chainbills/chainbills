use sylvia::cw_schema::cw_serde;
use sylvia::cw_std::Uint128;
use crate::state::TokenAndAmount;

#[cw_serde(crate = "sylvia::cw_schema")]
pub struct InstantiateMessage {
  pub chain_id: u16,
  pub chainbills_fee_collector: String,
}

#[cw_serde(crate = "sylvia::cw_schema")]
pub struct FetchMaxFeeMessage {
  pub token: String,
}

#[cw_serde(crate = "sylvia::cw_schema")]
pub struct CreatePayableMessage {
  pub allowed_tokens_and_amounts: Vec<TokenAndAmount>,
}

#[cw_serde(crate = "sylvia::cw_schema")]
pub struct IdMessage {
  pub id: String,
}

#[cw_serde(crate = "sylvia::cw_schema")]
pub struct UpdatePayableTokensAndAmountsMessage {
  pub payable_id: String,
  pub allowed_tokens_and_amounts: Vec<TokenAndAmount>,
}

#[cw_serde(crate = "sylvia::cw_schema")]
pub struct FetchIdMessage {
  pub reference: String,
  pub count: u64,
}

#[cw_serde(crate = "sylvia::cw_schema")]
pub struct PerChainPayablePaymentsCountMessage {
  pub payable_id: String,
  pub chain_id: u16,
}

#[cw_serde(crate = "sylvia::cw_schema")]
pub struct CountMessage {
  pub count: u64,
}


#[cw_serde(crate = "sylvia::cw_schema")]
pub struct PerChainPayablePaymentIdMessage {
  pub payable_id: String,
  pub chain_id: u16,
  pub count: u64,
}

#[cw_serde(crate = "sylvia::cw_schema")]
pub struct TransactionInfoMessage {
  pub payable_id: String,
  pub token: String,
  pub amount: Uint128,
}
