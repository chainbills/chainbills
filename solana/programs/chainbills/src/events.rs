use anchor_lang::prelude::*;

#[event]
pub struct InitializedEvent {}

#[event]
pub struct RegisteredForeignContractEvent {}

#[event]
pub struct UpdatedMaxWithdrawalFeeEvent {}

#[event]
pub struct InitializedUserEvent {
  pub global_count: u64,
  pub chain_count: u64,
}

#[event]
pub struct InitializedPayableEvent {
  pub global_count: u64,
  pub chain_count: u64,
  pub host_count: u64,
}

#[event]
pub struct ClosePayableEvent {}

#[event]
pub struct ReopenPayableEvent {}

#[event]
pub struct UpdatePayableDescriptionEvent {}

#[event]
pub struct PayEvent {
  pub global_count: u64,
  pub chain_count: u64,
  pub payable_count: u64,
  pub payer_count: u64,
}

#[event]
pub struct WithdrawalEvent {
  pub global_count: u64,
  pub chain_count: u64,
  pub payable_count: u64,
  pub host_count: u64,
}

#[event]
pub struct OwnerWithdrawalEvent {}
