use crate::payload::CbPayloadMessage;
use anchor_lang::prelude::*;
use wormhole_anchor_sdk::wormhole::PostedVaa;

#[account]
#[derive(Default)]
/// Foreign Contract Account Data.
pub struct ForeignContract {
  /// Contract's chain. Cannot equal `1` (Solana's Chain ID).
  pub chain: u16, // 2 bytes
  /// Contract's address. Cannot be zero address.
  pub address: [u8; 32], // 32 bytes
  /// Token Bridge program's foreign endpoint account key.
  pub token_bridge_foreign_endpoint: Pubkey, // 32 bytes
}

impl ForeignContract {
  // discriminator first
  pub const SPACE: usize = 8 + 2 + 32 + 32;

  /// AKA `b"foreign_contract"`.
  pub const SEED_PREFIX: &'static [u8] = b"foreign_contract";

  /// Convenience method to check whether an address equals the one saved in
  /// this account.
  pub fn verify(&self, vaa: Box<Account<PostedVaa<CbPayloadMessage>>>) -> bool {
    vaa.emitter_chain() == self.chain && *vaa.emitter_address() == self.address
  }
}
