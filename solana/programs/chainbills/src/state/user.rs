use anchor_lang::prelude::*;

#[account]
pub struct User {
    /// The wallet address of the person who owns this User account.
    pub address: Pubkey, // 32 bytes

    /// The nth count of global users at the point this user was initialized.
    pub global_count: u64, // 8 bytes

    /// Total number of payables that this user has ever created.
    pub payables_count: u64, // 8 bytes

    /// Total number of payments that this user has ever made.
    pub payments_count: u64, // 8 bytes

    /// Total number of withdrawals that this user has ever made.
    pub withdrawals_count: u64, // 8 bytes
}

impl User {
    pub const SPACE: usize = 32 + 8 + 8 + 8 + 8;

    pub fn initialize(&mut self, address: Pubkey, global_count: u64) {
        self.address = address;
        self.global_count = global_count;
        self.payables_count = 0;
        self.payments_count = 0;
        self.withdrawals_count = 0;
    }
}
