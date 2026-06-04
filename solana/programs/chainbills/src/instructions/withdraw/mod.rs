//! Withdrawal instructions: withdraw (SPL/Token-2022) and withdraw_native
//! (SOL).

pub mod withdraw;
pub mod withdraw_native;

pub use withdraw::*;
pub use withdraw_native::*;
