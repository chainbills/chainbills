use anchor_lang::prelude::*;

#[event]
pub struct Initialized {}

#[event]
pub struct InitializedUser {
  pub wallet: Pubkey,
  pub chain_count: u64,
}

#[event]
pub struct CreatedPayable {
  pub payable_id: Pubkey,
  pub host_wallet: Pubkey,
  pub chain_count: u64,
  pub host_count: u64,
}

#[event]
/// Emitted when a payment is made by a user. payable_id is [u8; 32] to take
/// into account payments to payables on other chains.
pub struct UserPaid {
  pub payable_id: [u8; 32],
  pub payer_wallet: Pubkey,
  pub payment_id: Pubkey,
  pub payable_chain_id: u16,
  pub chain_count: u64,
  pub payer_count: u64,
}

#[event]
/// Emitted when a payment is made to a payable. payer_wallet is [u8; 32] to
/// take into account payments from other chains.
pub struct PayableReceived {
  pub payable_id: Pubkey,
  pub payer_wallet: [u8; 32],
  pub payment_id: Pubkey,
  pub payer_chain_id: u16,
  pub chain_count: u64,
  pub payable_count: u64,
}

#[event]
pub struct Withdrew {
  pub payable_id: Pubkey,
  pub host_wallet: Pubkey,
  pub withdrawal_id: Pubkey,
  pub chain_count: u64,
  pub payable_count: u64,
  pub host_count: u64,
}

#[event]
pub struct ClosedPayable {
  pub payable_id: Pubkey,
  pub host_wallet: Pubkey,
}

#[event]
pub struct ReopenedPayable {
  pub payable_id: Pubkey,
  pub host_wallet: Pubkey,
}

#[event]
pub struct UpdatedPayableAllowedTokensAndAmounts {
  pub payable_id: Pubkey,
  pub host_wallet: Pubkey,
}

#[event]
pub struct ConsumedWormholePayableMessage {
  pub payable_id: [u8; 32],
  pub chain_id: u16,
  pub vaa_hash: [u8; 32],
}

#[event]
pub struct UpdatedMaxWithdrawalFees {
  pub token: Pubkey,
  pub max_withdrawal_fees: u64,
}

#[event]
pub struct OwnerWithdrew {
  pub token: Pubkey,
  pub amount: u64,
}

#[event]
// Append Event to differentiate it from the corresponding state struct
pub struct RegisteredForeignContractEvent {
  pub chain_id: u16,
  pub emitter_address: [u8; 32],
}

#[event]
pub struct RegisteredMatchingTokenForForeignChain {
  pub chain_id: u16,
  pub foreign_token: [u8; 32],
  pub token: Pubkey,
}
