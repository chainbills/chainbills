//! External CPI helpers for Circle CCTP and Wormhole Post-Message Shim.
//!
//! All functions are gated with `#[cfg(not(feature = "skip-external-cpi"))]`
//! so the program still compiles and state logic tests pass without live
//! external programs. On devnet/mainnet the feature is absent and CPIs fire.

pub mod cctp;
pub mod wormhole;
