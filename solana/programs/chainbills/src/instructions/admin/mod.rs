//! Admin instructions: initialize, allow_token, disallow_token,
//! update_fee_settings, register_chain, update_chain,
//! admin_sync_foreign_payable.

pub mod admin_sync_foreign_payable;
pub mod allow_token;
pub mod disallow_token;
pub mod initialize;
pub mod register_chain;
pub mod update_chain;
pub mod update_fee_settings;

pub use admin_sync_foreign_payable::*;
pub use allow_token::*;
pub use disallow_token::*;
pub use initialize::*;
pub use register_chain::*;
pub use update_chain::*;
pub use update_fee_settings::*;
