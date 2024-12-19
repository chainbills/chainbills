pub mod activity_record;
pub mod chain_items;
pub mod chain_stats;
pub mod config;
pub mod registered_foreign_contract;
pub mod payable;
pub mod payable_foreign;
pub mod payable_items;
pub mod payable_payment;
pub mod token_and_amount;
pub mod token_and_amount_foreign;
pub mod token_details;
pub mod token_foreign_chain;
pub mod user;
pub mod user_activity_info;
pub mod user_payment;
pub mod withdrawal;
pub mod consumed_wormhole_message;

pub use activity_record::*;
pub use chain_items::*;
pub use chain_stats::*;
pub use config::*;
pub use registered_foreign_contract::*;
pub use payable::*;
pub use payable_foreign::*;
pub use payable_items::*;
pub use payable_payment::*;
pub use token_and_amount::*;
pub use token_and_amount_foreign::*;
pub use token_foreign_chain::*;
pub use token_details::*;
pub use user::*;
pub use user_activity_info::*;
pub use user_payment::*;
pub use withdrawal::*;
pub use consumed_wormhole_message::*;

/// AKA `b"sent"`.
pub const SEED_PREFIX_SENT: &[u8; 4] = b"sent";

use anchor_lang::prelude::*;

#[account]
pub struct Empty {}
