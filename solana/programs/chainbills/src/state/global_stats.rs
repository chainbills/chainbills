use anchor_lang::prelude::*;

#[account]
pub struct GlobalStats {
    /// Total number of users that have ever been initialized.
    pub users_count: u64, // 8 bytes

    /// Total number of payables that have ever been created.
    pub payables_count: u64, // 8 bytes

    /// Total number of payments that have ever been made.
    pub payments_count: u64, // 8 bytes

    /// Total number of withdrawals that have ever been made.
    pub withdrawals_count: u64, // 8 bytes
}

impl GlobalStats {
    pub const SPACE: usize = 8 + 8 + 8 + 8;

    pub fn initialize(&mut self) {
        self.users_count = 0;
        self.payables_count = 0;
        self.payments_count = 0;
        self.withdrawals_count = 0;
    }
}
