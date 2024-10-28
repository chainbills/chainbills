use anchor_lang::prelude::*;

#[event]
pub struct InitializedEvent {}

#[event]
pub struct RegisteredForeignContractEvent {
  pub chain_id: u16,
  pub emitter: [u8; 32],
}

#[event]
pub struct UpdatedMaxWithdrawalFeesEvent {
  pub token: Pubkey,
  pub max_withdrawal_fees: u64,
}

#[event]
pub struct InitializedUserEvent {
  pub wallet: Pubkey,
  pub chain_count: u64,
}

#[event]
pub struct CreatedPayableEvent {
  pub payable_id: Pubkey,
  pub host_wallet: Pubkey,
  pub chain_count: u64,
  pub host_count: u64,
}

#[event]
pub struct ClosePayableEvent {
  pub payable_id: Pubkey,
  pub host_wallet: Pubkey,
}

#[event]
pub struct ReopenPayableEvent {
  pub payable_id: Pubkey,
  pub host_wallet: Pubkey,
}

#[event]
pub struct UpdatedPayableAllowedTokensAndAmountsEvent {
  pub payable_id: Pubkey,
  pub host_wallet: Pubkey,
}

#[event]
/// Emitted when a payment is made to a payable. payer_wallet is [u8; 32] to
/// take into account payments from other chains.
pub struct PayablePayEvent {
  pub payable_id: Pubkey,
  pub payer_wallet: [u8; 32],
  pub payment_id: Pubkey,
  pub payer_chain_id: u16,
  pub chain_count: u64,
  pub payable_count: u64,
}

#[event]
/// Emitted when a payment is made by a user. payable_id is [u8; 32] to take
/// into account payments to payables on other chains.
pub struct UserPayEvent {
  pub payable_id: [u8; 32],
  pub payer_wallet: Pubkey,
  pub payment_id: Pubkey,
  pub payable_chain_id: u16,
  pub chain_count: u64,
  pub payer_count: u64,
}

#[event]
pub struct WithdrawalEvent {
  pub payable_id: Pubkey,
  pub host_wallet: Pubkey,
  pub withdrawal_id: Pubkey,
  pub chain_count: u64,
  pub payable_count: u64,
  pub host_count: u64,
}

#[event]
pub struct OwnerWithdrawalEvent {
  pub token: Pubkey,
  pub amount: u64,
}
