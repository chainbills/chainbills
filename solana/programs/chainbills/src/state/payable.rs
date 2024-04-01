use anchor_lang::prelude::*;
use crate::constants::*;
use crate::state::TokenAndAmount;

#[account]
pub struct Payable {
    /// The nth count of global payables at the point this payable was created.
    pub global_count: u64, // 8 bytes

    /// The address of the User account that owns this Payable.
    pub host: Pubkey, // 32 bytes

    /// The nth count of payables that the host has created at the point of
    /// this payable's creation.
    pub host_count: u64, // 8 bytes

    /// Displayed to payers when the make payments to this payable.
    /// Set by the host.
    pub description: String, // MAX_PAYABLES_DESCRIPTION_LENGTH

    /// The allowed tokens (and their amounts) on this payable.
    /* TokenAndAmount::SPACE * MAX_PAYABLES_TOKENS */
    pub tokens_and_amounts: Vec<TokenAndAmount>,

    /// Records of how much is in this payable.
    /* TokenAndAmount::SPACE * MAX_PAYABLES_TOKENS */
    pub balances: Vec<TokenAndAmount>,

    /// Whether this payable allows payments any amount in any token.
    pub allows_free_payments: bool, // 1 byte

    /// The timestamp of when this payable was created.
    pub created_at: u64, // 8 bytes

    /// The total number of payments made to this payable.
    pub payments_count: u64, // 8 bytes

    /// The total number of withdrawals made from this payable.
    pub withdrawals_count: u64, // 8 bytes

    /// Whether this payable is currently accepting payments.
    pub is_closed: bool, // 1 byte
}

impl Payable {
    pub const SPACE: usize =
        8 +
        32 +
        8 +
        MAX_PAYABLES_DESCRIPTION_LENGTH +
        MAX_PAYABLES_TOKENS * TokenAndAmount::SPACE +
        MAX_PAYABLES_TOKENS * TokenAndAmount::SPACE +
        1 +
        8 +
        8 +
        8 +
        1;
}
