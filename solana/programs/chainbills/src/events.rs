//! Anchor events emitted by every instruction. Mirrors EVM's `CbEvents.sol`.
//! Every instruction calls both `emit!(...)` AND `msg!(...)` for dual indexing:
//! - `emit!` → Anchor event log, parseable by TypeScript clients + relayer
//! - `msg!`  → plain program log, visible in explorer and `solana logs`

use anchor_lang::prelude::*;

/// Emitted when a new UserRecord PDA is created for a wallet.
#[event]
pub struct UserInitialized {
  /// The wallet that was initialized.
  pub user: Pubkey,
  /// Unix timestamp of initialization.
  pub timestamp: i64,
}

/// Emitted when a new payable is created.
#[event]
pub struct CreatedPayable {
  /// The PDA address of the newly created payable.
  pub payable: Pubkey,
  /// The host wallet that created the payable.
  pub host: Pubkey,
  /// The host's payable creation index (host_count at time of creation).
  pub host_count: u64,
  /// Global payable count at time of creation (snapshot).
  pub chain_count: u64,
  /// Unix timestamp.
  pub timestamp: i64,
}

/// Emitted when a payable is closed by its host.
#[event]
pub struct ClosedPayable {
  /// The PDA address of the closed payable.
  pub payable: Pubkey,
  /// The host that closed it.
  pub host: Pubkey,
  /// Unix timestamp.
  pub timestamp: i64,
}

/// Emitted when a previously closed payable is reopened.
#[event]
pub struct ReopenedPayable {
  /// The PDA address of the reopened payable.
  pub payable: Pubkey,
  /// The host that reopened it.
  pub host: Pubkey,
  /// Unix timestamp.
  pub timestamp: i64,
}

/// Emitted when a payable's allowed tokens and amounts list is updated.
#[event]
pub struct UpdatedPayableAtaa {
  /// The PDA address of the updated payable.
  pub payable: Pubkey,
  /// The host that performed the update.
  pub host: Pubkey,
  /// Unix timestamp.
  pub timestamp: i64,
}

/// Emitted when a payable's auto-withdraw flag is toggled.
#[event]
pub struct UpdatedPayableAutoWithdraw {
  /// The PDA address of the updated payable.
  pub payable: Pubkey,
  /// The host that performed the update.
  pub host: Pubkey,
  /// The new value of the auto-withdraw flag.
  pub is_auto_withdraw: bool,
  /// Unix timestamp.
  pub timestamp: i64,
}

/// Emitted when a same-chain payment is made to a payable.
/// Also emitted for cross-chain outbound (Solana → EVM) payments.
#[event]
pub struct UserPaid {
  /// The UserPayment PDA address.
  pub payment: Pubkey,
  /// The payer's wallet address.
  pub payer: Pubkey,
  /// The payable that was paid into.
  pub payable: Pubkey,
  /// The token mint used for payment (system_program::ID for native SOL).
  pub token: Pubkey,
  /// The payment amount in token base units.
  pub amount: u64,
  /// Unix timestamp.
  pub timestamp: i64,
}

/// Emitted when a local payable receives a payment.
/// For cross-chain inbound, `payer` is Wormhole-normalized (32 bytes) from the
/// source chain.
#[event]
pub struct PayableReceived {
  /// The PayablePayment PDA address.
  pub payment: Pubkey,
  /// The payable that received the payment.
  pub payable: Pubkey,
  /// Wormhole-normalized payer address (32 bytes — Pubkey on Solana, padded
  /// address on EVM).
  pub payer: [u8; 32],
  /// The token mint credited to the payable vault.
  pub token: Pubkey,
  /// The payment amount in token base units.
  pub amount: u64,
  /// Unix timestamp.
  pub timestamp: i64,
}

/// Emitted when a host withdraws funds from a payable.
#[event]
pub struct Withdrew {
  /// The Withdrawal PDA address.
  pub withdrawal: Pubkey,
  /// The payable that was withdrawn from.
  pub payable: Pubkey,
  /// The host that performed the withdrawal.
  pub host: Pubkey,
  /// The token mint withdrawn.
  pub token: Pubkey,
  /// Gross withdrawal amount (before fees).
  pub amount: u64,
  /// Fee amount deducted.
  pub fees: u64,
  /// Net amount received by host (amount - fees).
  pub net_amount: u64,
  /// Unix timestamp.
  pub timestamp: i64,
}

/// Emitted when a payable's state is broadcast to foreign chains.
#[event]
pub struct PayableUpdateBroadcasted {
  /// The payable whose state was broadcast.
  pub payable: Pubkey,
  /// The nonce assigned to this broadcast (monotonically increasing).
  pub nonce: u64,
  /// The action type: 1=Create, 2=Close, 3=Reopen, 4=UpdateATAA.
  pub action_type: u8,
  /// Unix timestamp.
  pub timestamp: i64,
}

/// Emitted when a PayablePayload is received from a foreign chain and applied
/// to a ForeignPayable PDA.
#[event]
pub struct ReceivedPayableUpdate {
  /// The payable_id from the payload (foreign chain's payable address as
  /// bytes32).
  pub foreign_payable_id: [u8; 32],
  /// The cbChainId of the chain that sent this update.
  pub src_cb_chain_id: [u8; 32],
  /// The nonce of the update (used for ordering / replay protection).
  pub nonce: u64,
  /// The action type applied: 1=Create, 2=Close, 3=Reopen, 4=UpdateATAA.
  pub action_type: u8,
  /// Unix timestamp.
  pub timestamp: i64,
}

/// Emitted when a cross-chain payment (EVM → Solana) is received and processed.
#[event]
pub struct ForeignPaymentReceived {
  /// The PayablePayment PDA created for this inbound payment.
  pub payable_payment: Pubkey,
  /// The ForeignPayable that received the payment.
  pub payable: Pubkey,
  /// Wormhole-normalized payer address on the source chain.
  pub payer: [u8; 32],
  /// The cbChainId of the payer's chain.
  pub payer_chain_id: [u8; 32],
  /// USDC amount credited (after CCTP fee deduction).
  pub amount: u64,
  /// Unix timestamp.
  pub timestamp: i64,
}

// ── Admin / Config Events ────────────────────────────────────────────────────
// Mirrors EVM events: AllowedPaymentsForToken, StoppedPaymentsForToken,
// SetWithdrawalFeePercentage, SetFeeCollectorAddress, RegisteredForeignContract,
// RegisteredChainWormholeId, RegisteredChainCircleDomain.

/// Emitted when the program is initialized for the first time.
/// Captures the full initial configuration.
#[event]
pub struct ProgramInitialized {
  /// The program owner (upgrade authority at init time).
  pub owner: Pubkey,
  /// Default withdrawal fee in basis points (200 = 2%).
  pub fee_bps: u16,
  /// cbChainId of this Solana deployment (mainnet or devnet).
  pub cb_chain_id: [u8; 32],
  /// Whether this deployment supports Wormhole outbound messages.
  pub has_wormhole: bool,
  /// Whether this deployment supports CCTP outbound messages.
  pub has_cctp: bool,
  /// Unix timestamp of initialization.
  pub timestamp: i64,
}

/// Emitted when a token mint is allowed for payments. Mirrors EVM
/// `AllowedPaymentsForToken`.
#[event]
pub struct TokenAllowed {
  /// The mint address of the newly allowed token.
  pub mint: Pubkey,
  /// The maximum withdrawal fee cap for this token (in base units).
  pub max_withdrawal_fee: u64,
  /// Unix timestamp.
  pub timestamp: i64,
}

/// Emitted when a token mint is disallowed (payments blocked). Mirrors EVM
/// `StoppedPaymentsForToken`.
#[event]
pub struct TokenDisallowed {
  /// The mint address of the disallowed token.
  pub mint: Pubkey,
  /// Unix timestamp.
  pub timestamp: i64,
}

/// Emitted when global fee settings are updated. Mirrors EVM
/// `SetWithdrawalFeePercentage` + `SetFeeCollectorAddress`.
#[event]
pub struct FeeSettingsUpdated {
  /// New fee in basis points.
  pub fee_bps: u16,
  /// New fee collector wallet that receives the fee portion on withdrawals.
  pub fee_collector: Pubkey,
  /// Unix timestamp.
  pub timestamp: i64,
}

/// Emitted when a foreign chain is registered. Mirrors EVM
/// `RegisteredForeignContract` + `RegisteredChainWormholeId` +
/// `RegisteredChainCircleDomain`.
#[event]
pub struct ChainRegistered {
  /// Universal cross-chain key for the registered chain (CAIP-2 keccak256).
  pub cb_chain_id: [u8; 32],
  /// Whether this chain uses Wormhole for data messaging.
  pub has_wormhole: bool,
  /// Wormhole's uint16 chain ID for this chain (0 if not applicable).
  pub wormhole_chain_id: u16,
  /// Whether this chain uses Circle CCTP.
  pub has_cctp: bool,
  /// Circle's uint32 domain for this chain (0 if not applicable).
  pub circle_domain: u32,
  /// 32-byte normalized address of Chainbills contract on this chain.
  pub registered_contract: [u8; 32],
  /// Unix timestamp.
  pub timestamp: i64,
}

/// Emitted when an existing foreign chain's parameters are updated. Mirrors EVM
/// `RegisteredForeignContract` update path.
#[event]
pub struct ChainUpdated {
  /// Universal cross-chain key for the updated chain.
  pub cb_chain_id: [u8; 32],
  /// New Wormhole flag.
  pub has_wormhole: bool,
  /// New Wormhole chain ID.
  pub wormhole_chain_id: u16,
  /// New CCTP flag.
  pub has_cctp: bool,
  /// New Circle domain.
  pub circle_domain: u32,
  /// New registered contract address (32 bytes normalized).
  pub registered_contract: [u8; 32],
  /// Unix timestamp.
  pub timestamp: i64,
}
