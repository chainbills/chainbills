//! Payable management instructions: create, update ATAA, toggle auto-withdraw,
//! close, and reopen payables.

pub mod close_payable;
pub mod create_payable;
pub mod reopen_payable;
pub mod update_payable_ataa;
pub mod update_payable_auto_withdraw;

pub use close_payable::*;
pub use create_payable::*;
pub use reopen_payable::*;
pub use update_payable_ataa::*;
pub use update_payable_auto_withdraw::*;
