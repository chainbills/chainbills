//! Cross-chain payload encode/decode.
//! Both PaymentPayload and PayablePayload are byte-for-byte compatible with
//! EVM. See DESIGN.md §12 for exact byte layouts.

pub mod decode;
pub mod encode;
pub mod wormhole;

pub use decode::*;
pub use encode::*;
pub use wormhole::*;
