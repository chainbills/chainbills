use anchor_lang::prelude::*;
use crate::state::TokenAndAmount;

#[account]
pub struct Withdrawal {
    /// The nth count of global withdrawals at the point this
    /// withdrawal was made.
    pub global_count: u64, // 8 bytes

    /// The address of the Payable from which this Withdrawal was made.
    pub payable: Pubkey, // 32 bytes

    /// The address of the User account (payable's owner)
    /// that made this Withdrawal.
    pub host: Pubkey, // 32 bytes

    /// The nth count of withdrawals that the host has made
    /// at the point of making this withdrawal.
    pub host_count: u64, // 8 bytes

    /// The nth count of withdrawals that has been made from
    /// this payable at the point when this withdrawal was made.
    pub payable_count: u64, // 8 bytes

    /// When this withdrawal was made.
    pub timestamp: u64, // 8 bytes

    /// The amount and token that the host withdrew
    pub details: TokenAndAmount, // TokenAndAmount::SPACE
}

impl Withdrawal {
    pub const SPACE: usize = 8 + 32 + 32 + 8 + 8 + 8 + TokenAndAmount::SPACE;
}
