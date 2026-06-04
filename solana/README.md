# Chainbills - Solana

Chainbills is a cross-chain payment gateway that allows anyone (hosts) to receive any amount of cryptocurrency from everybody (payers), powered by [Wormhole](https://wormhole.com) and [Circle CCTP](https://www.circle.com/cross-chain-transfer-protocol). Chainbills deducts 2% from all withdrawals for fees and maintenance.

This subdirectory contains the Anchor/Rust program for the Solana blockchain.

Chainbills uses Anchor and Rust best practices to write, document, and test the program. The logic flows and data structures are in sync with the EVM contracts. Multiple carefully designed PDAs power the program to serve its features.

For more about Chainbills' features and how things work overall, check the [top-level README](../README.md).

To understand the data structures and architecture of Chainbills' contracts, check the [ARCHITECTURE doc](../ARCHITECTURE.md).

Here you will find engineering specifics that apply to this Solana program.

## Table of Contents

- [Native SOL and SPL Tokens](#native-sol-and-spl-tokens)
- [Token Interface Strategy](#token-interface-strategy)
- [PDAs as IDs](#pdas-as-ids)
- [cbChainId for Solana](#cbchainid-for-solana)
- [Modularity](#modularity)
- [Input Validation](#input-validation)
- [Activity System](#activity-system)
- [Fee Calculation](#fee-calculation)
- [Cross-Chain Messaging](#cross-chain-messaging)
  - [Wormhole Emission — Post-Message Shim](#wormhole-emission--post-message-shim)
  - [Wormhole Receipt — Three Transactions](#wormhole-receipt--three-transactions)
  - [Payload Type Discriminator](#payload-type-discriminator)
  - [Payload Format](#payload-format)
  - [CPI `remaining_accounts` Conventions](#cpi-remaining_accounts-conventions)
  - [Nonce Ordering for Payable Updates](#nonce-ordering-for-payable-updates)
- [Stack and Compute Budget Management](#stack-and-compute-budget-management)
  - [Box\<\> for Heap Allocation](#box-for-heap-allocation)
  - [Function Decomposition](#function-decomposition)
  - [remaining_accounts for Dynamic Account Sets](#remaining_accounts-for-dynamic-account-sets)
  - [Address Lookup Tables](#address-lookup-tables)
  - [Compute Budget](#compute-budget)
- [Testing](#testing)
  - [Layer 1 — Rust Unit Tests (mollusk-svm)](#layer-1--rust-unit-tests-mollusk-svm)
  - [Layer 2 — Rust Integration Tests (litesvm)](#layer-2--rust-integration-tests-litesvm)
  - [Layer 3 — TypeScript E2E Tests (litesvm npm + Jest)](#layer-3--typescript-e2e-tests-litesvm-npm--jest)
- [About Anchor](#about-anchor)
- [Deploy Commands](#deploy-commands)
  - [Post-Deploy Admin Setup](#post-deploy-admin-setup)

---

## Native SOL and SPL Tokens

Chainbills supports both native SOL and SPL tokens (including Token-2022) for payments and withdrawals.

Solana uses `system_program::ID` (`11111111111111111111111111111111`) as the sentinel pubkey representing native SOL — the same role `address(this)` plays for native ETH on EVM.

When the `token_mint` field equals `system_program::ID`, the instruction is routed through the native SOL variants: `pay_native` and `withdraw_native`. For all other mints, the SPL/Token-2022 variants (`pay` and `withdraw`) are used.

For SPL token payments, the payer's associated token account is debited and the payable's vault ATA (owned by the `PayableVaultAuthority` PDA) is credited via `transfer_checked`:

```rust
transfer_checked(
    CpiContext::new(
        ctx.accounts.token_program.to_account_info(),
        TransferChecked {
            from: ctx.accounts.payer_token_account.to_account_info(),
            mint: ctx.accounts.token_mint.to_account_info(),
            to: ctx.accounts.vault_token_account.to_account_info(),
            authority: ctx.accounts.payer.to_account_info(),
        },
    ),
    amount,
    decimals,
)
```

For native SOL payments, lamports are transferred directly to the `PayableVaultAuthority` PDA, which accumulates lamports without needing a token account. The payable's `balances` vec uses `system_program::ID` as the key to track the SOL balance.

For withdrawals, the vault authority PDA signs with its seeds to authorize the transfer out:

```rust
CpiContext::new_with_signer(
    ctx.accounts.token_program.to_account_info(),
    TransferChecked { from: vault_ata, to: host_ata, authority: vault_authority, ... },
    &[&[Payable::VAULT_SEED_PREFIX, payable_key.as_ref(), &[vault_bump]]],
)
```

---

## Token Interface Strategy

All token-handling instructions use `anchor_spl::token_interface` instead of `anchor_spl::token`. This provides transparent compatibility with both SPL Token and Token-2022 without any branching logic in the program:

```rust
// Account types
pub token_account: InterfaceAccount<'info, TokenAccount>,
pub token_mint: InterfaceAccount<'info, Mint>,
pub token_program: Interface<'info, TokenInterface>,

// CPI call
anchor_spl::token_interface::transfer_checked(
    CpiContext::new_with_signer(...),
    amount,
    decimals,
)?;
```

USDC on Solana is SPL Token (not Token-2022), so it works with this interface transparently. Any future Token-2022 tokens (with transfer fees, interest, etc.) are also supported without program changes.

---

## PDAs as IDs

PDA addresses serve as entity IDs. The deterministic derivation from seeds means the address is both globally unique and derivable by any client without an index — no separate ID computation needed.

| Account                  | Seeds                                                                    | Notes                                                             |
| ------------------------ | ------------------------------------------------------------------------ | ----------------------------------------------------------------- |
| `Config`                 | `[b"config"]`                                                            | One per deployment                                                |
| `Stats`                  | `[b"stats"]`                                                             | One per deployment — all 13 chain-wide counters                   |
| `SenderAuthority`        | `[b"sender_authority"]`                                                  | No data — signs CCTP `deposit_for_burn` CPIs                      |
| `ChainRegistry`          | `[b"chain_registry", cb_chain_id: [u8;32]]`                              | One per registered foreign chain                                  |
| `TokenConfig`            | `[b"token_cfg", mint: Pubkey]`                                           | One per supported token mint                                      |
| `UserRecord`             | `[b"user", wallet: Pubkey]`                                              | One per wallet                                                    |
| `Payable`                | `[b"payable", host: Pubkey, host_count_le: [u8;8]]`                      | `host_count` = `user_record.payables_count` BEFORE increment      |
| `PayableVaultAuthority`  | `[b"vault", payable: Pubkey]`                                            | No data — owns all vault ATAs for the payable                     |
| `ForeignPayable`         | `[b"foreign_payable", payable_id: [u8;32]]`                              | Synced state of a foreign-chain payable                           |
| `UserPayment`            | `[b"up", payer: Pubkey, payment_count_le: [u8;8]]`                       | `payment_count` = `user_record.payments_count` BEFORE increment   |
| `PayablePayment`         | `[b"pp", payable: Pubkey, payment_count_le: [u8;8]]`                     | `payment_count` = `payable.payments_count` BEFORE increment       |
| `Withdrawal`             | `[b"wdl", payable: Pubkey, withdrawal_count_le: [u8;8]]`                 | `withdrawal_count` = `payable.withdrawals_count` BEFORE increment |
| `ActivityRecord`         | `[b"activity", b"global", global_index_le: [u8;8]]`                      | Global audit event                                                |
| `UserActivityPointer`    | `[b"activity", b"user", user: Pubkey, user_index_le: [u8;8]]`            | Links user's nth activity → global index                          |
| `PayableActivityPointer` | `[b"activity", b"payable", payable: Pubkey, payable_index_le: [u8;8]]`   | Links payable's nth activity → global index                       |
| `ConsumedVaa`            | `[b"consumed_vaa", vaa_hash: [u8;32]]`                                   | Replay protection — never closed                                  |
| `PaymentNonce`           | `[b"pnonce", payer_chain_id: [u8;32], payer: [u8;32], nonce_le: [u8;8]]` | Replay protection — never closed                                  |
| `CctpTokenBurnNonce`     | `[b"cctp_bnonce", circle_domain: [u8;4], nonce_le: [u8;8]]`              | CCTP burn replay protection                                       |
| `CctpDataNonce`          | `[b"cctp_dnonce", circle_domain: [u8;4], nonce_le: [u8;8]]`              | CCTP data message replay protection                               |

Count seeds use little-endian bytes (`count.to_le_bytes()`). The count value used in the seed is captured _before_ incrementing — so the first payable for a host uses `host_count = 0`, the second uses `host_count = 1`, and so on.

Replay protection PDAs (`ConsumedVaa`, `PaymentNonce`, CCTP nonce PDAs) are created with `init` — not `init_if_needed`. If the PDA already exists, `init` fails, which is the replay rejection. This is atomic: either the entire instruction succeeds, or the state rolls back entirely.

---

## cbChainId for Solana

Chainbills uses `cbChainId = keccak256("namespace:reference")` (CAIP-2) as the universal chain key — see [ARCHITECTURE.md](../ARCHITECTURE.md#caip-2-chain-identifiers-cbchainid) for the full table and rationale. For Solana specifically, CAIP-2 uses the genesis block hash as the chain reference — the first 32 characters of the Base58-encoded genesis hash — since Solana has no numeric chain ID. Both Solana values are stored as `[u8; 32]` constants in `constants.rs` and the program selects the correct one at initialization time.

---

## Modularity

The Chainbills program is a single Anchor program (no `delegatecall` split needed — Solana has no 24KB limit). The source is organized into modules by responsibility:

```
programs/chainbills/src/
  lib.rs                    — #[program] dispatchers, declare_id!
  constants.rs              — program IDs, sentinel values, limits
  errors.rs                 — ChainbillsError enum (all revert-equivalent errors)
  events.rs                 — all Anchor events (mirror of EVM CbEvents.sol)
  utils.rs                  — compute_fee, normalize_pubkey, get_current_timestamp

  state/                    — all PDA account types
    config.rs               — Config [b"config"]
    stats.rs                — Stats [b"stats"] (13 chain-wide counters)
    sender_authority.rs     — SenderAuthority [b"sender_authority"]
    chain_registry.rs       — ChainRegistry per registered foreign chain
    token_config.rs         — TokenConfig per supported mint
    token_and_amount.rs     — TokenAndAmount helper struct
    user_record.rs          — UserRecord per wallet
    payable.rs              — Payable + PayableVaultAuthority
    foreign_payable.rs      — ForeignPayable (synced foreign-chain payable state)
    user_payment.rs         — UserPayment
    payable_payment.rs      — PayablePayment
    withdrawal.rs           — Withdrawal
    activity.rs             — ActivityRecord, UserActivityPointer, PayableActivityPointer
    consumed_vaa.rs         — ConsumedVaa (Wormhole replay protection)
    payment_nonce.rs        — PaymentNonce (payment replay protection)
    cctp_token_burn_nonce.rs — CctpTokenBurnNonce (CCTP burn replay protection)
    cctp_data_nonce.rs      — CctpDataNonce (CCTP data message replay protection)

  payload/                  — cross-chain message encoding/decoding
    encode.rs               — encode_payment_payload, encode_payable_payload
    decode.rs               — decode_payment_payload, decode_payable_payload
    wormhole.rs             — PostedVaa account type
    mod.rs

  instructions/             — one file per instruction, grouped by domain
    admin/                  — initialize, allow_token, disallow_token,
    |                         update_fee_settings, register_chain, update_chain,
    |                         admin_sync_foreign_payable
    payable/                — create_payable, update_payable_ataa,
    |                         update_payable_auto_withdraw, close_payable, reopen_payable
    payment/                — pay, pay_native, pay_foreign_via_cctp
    withdraw/               — withdraw, withdraw_native
    relay/                  — broadcast_payable_update, recv_payable_update_via_wormhole,
                              recv_payable_update_via_cctp, recv_payment_via_cctp_wormhole,
                              recv_payment_via_cctp_only
```

The three protocol-level PDAs separate concerns cleanly:

| PDA               | Role                                                                                      |
| ----------------- | ----------------------------------------------------------------------------------------- |
| `Config`          | Admin settings: owner, fee_bps, fee_collector, cb_chain_id, nonce counter, protocol flags |
| `Stats`           | All 13 chain-wide counters (users, payables, payments, withdrawals, Wormhole, CCTP)       |
| `SenderAuthority` | Keyless PDA — signs `deposit_for_burn` CPI when paying cross-chain                        |

---

## Input Validation

Anchor's account constraint system handles most structural validation at the account-loading level, before the handler runs:

```rust
#[account(
    constraint = !payable.is_closed @ ChainbillsError::PayableClosed,
    constraint = token_config.is_allowed @ ChainbillsError::TokenNotAllowed,
    constraint = payable.host == host.key() @ ChainbillsError::UnauthorizedHost,
)]
```

Business-logic validation uses `require!` macros inside handlers:

```rust
require!(amount > 0, ChainbillsError::ZeroAmount);
require!(
    ataa.len() <= MAX_ATAA_COUNT as usize,
    ChainbillsError::MaxAtaaExceeded
);
```

For ATAA (allowed tokens and amounts) validation:

```rust
// Empty ATAA = accept any token in any amount
if payable.allowed_tokens_and_amounts.is_empty() {
    return true;
}
// Otherwise: token match + amount >= required minimum
payable.allowed_tokens_and_amounts
    .iter()
    .any(|entry| entry.token == token && amount >= entry.amount)
```

A `UserRecord` is created automatically on first action (`init_if_needed`). There is no separate user-initialization instruction — users do not need to call anything before creating a payable or making a payment.

---

## Activity System

Every state change in Chainbills creates an on-chain activity record. This gives a full audit trail without relying on transaction logs or off-chain indexing.

Each activity involves three account types:

- **`ActivityRecord`** — the event itself, globally indexed. Stores: `global_index`, `activity_type`, `entity` (the payable or payment PDA), `actor` (the wallet that triggered it), `timestamp`.
- **`UserActivityPointer`** — links the user's nth activity to a global `ActivityRecord` index. Allows paginating all activities for a wallet.
- **`PayableActivityPointer`** — links the payable's nth activity to a global `ActivityRecord` index. Allows paginating all activities for a payable.

The `ActivityType` enum covers all state transitions:

```
UserInitialized, PayableCreated, PayableClosed, PayableReopened,
PayableAtaaUpdated, PayableAutoWithdrawUpdated,
UserPaid, PayableReceived, Withdrew,
ForeignPayableCreated, ForeignPayableUpdated
```

Pointer accounts are cheap (16 bytes each: discriminator + `global_index: u64`). The `ActivityRecord` stores the canonical data; pointers are just cross-references. This pattern lets clients fetch all global activities in order, or paginate per-entity by deriving pointer PDAs from the entity's count fields.

---

## Fee Calculation

See [ARCHITECTURE.md](../ARCHITECTURE.md#withdrawals) for the fee formula. The Rust implementation uses `u128` intermediate arithmetic to avoid overflow, and all operations use `checked_*` methods that return `ChainbillsError::MathOverflow` or `ChainbillsError::MathUnderflow` on failure. `overflow-checks = true` is also set in the workspace `Cargo.toml` profile as a second line of defence. The fee cap per token is stored in `TokenConfig.max_withdrawal_fee` and set by the owner via `allow_token`.

---

## Cross-Chain Messaging

### Wormhole Emission — Post-Message Shim

For outbound Wormhole messages (payable updates broadcast, cross-chain payment payload), the program CPIs into the **Wormhole Post-Message Shim** (`EtZMZM22ViKMo4r5y4Anovs3wKQ2owUmDpjygnMMcdEX`) instead of the Core Bridge directly. The shim reuses a single per-emitter PDA rather than creating a new account per message, saving ~0.002 SOL per broadcast.

### Wormhole Receipt — Three Transactions

Receiving a Wormhole VAA on Solana requires three separate transactions due to Ed25519 signature verification constraints. The relayer handles all three:

1. **`verify_signatures`** (Core Bridge) — submits Ed25519 precompile instructions alongside Guardian signatures. Creates a `SignatureSet` PDA.
2. **`post_vaa`** (Core Bridge) — reads the `SignatureSet`, creates a `PostedVAA` PDA owned by the Core Bridge program.
3. **`recv_payment_via_cctp_wormhole`** or **`recv_payable_update_via_wormhole`** (Chainbills) — reads the `PostedVAA` account.

Chainbills uses Anchor's `Account<'info, PostedVaa>` type for the VAA account. Anchor validates that the account is owned by the Core Bridge program at the type level — a fake `PostedVAA` from any other program is rejected before any handler code runs.

### Payload Type Discriminator

Every cross-chain message body begins with a `payloadType` byte — see [ARCHITECTURE.md](../ARCHITECTURE.md#payload-discriminator) for the byte values. The Rust decode functions validate this byte first and return `ChainbillsError::InvalidPayloadType` on mismatch.

### Payload Format

`PaymentPayload` is 251 bytes. `PayablePayload` is variable length.

```
PaymentPayload (251 bytes):
[0]      payloadType:       u8  = 0x02
[1]      version:           u8  = 0x01
[2]      actionType:        u8  = 0x05
[3..35]  payable_id:        [u8;32]
[35..43] nonce:             u64 big-endian
[43..51] initiated_at:      i64 big-endian
[51..59] amount:            u64 big-endian
[59..91] payable_chain_token: [u8;32]
[91..123] payable_chain_id: [u8;32]
[123..155] payer:           [u8;32]
[155..187] payer_chain_token: [u8;32]
[187..219] payer_chain_id:  [u8;32]
[219..251] payer_payment_id: [u8;32]
```

Solana `Pubkey` values are already 32 bytes — no left-padding is needed, unlike EVM's 20-byte addresses which require padding in Wormhole's `bytes32` format.

All multi-byte integers are big-endian, matching EVM's ABI encoding. Encoding and decoding live in `payload/encode.rs` and `payload/decode.rs`.

### CCTP V2

For cross-chain USDC transfers, the program uses Circle CCTP V2:

- Mainnet: `CCTPV2Sm4AdWt5296sk4P66VBZ7bEhcARwFaaS9YPbeC` (MessageTransmitter)
- Devnet: `CCTPmbSD7gX1bxKPAmg77w8oFzNFpaQiQUWD43TKaecd` (V1, used for testnet compatibility)

On cross-chain payment send (`pay_foreign_via_cctp`), the `SenderAuthority` PDA signs the `deposit_for_burn` CPI. `destination_caller` is set to the registered Chainbills contract on the destination chain — only that contract can submit the burn on the destination, preventing griefing attacks.

### CPI `remaining_accounts` Conventions

Cross-chain instructions that call external programs (CCTP, Wormhole) pass the
required external accounts via Anchor's `remaining_accounts` slice, since the
number of accounts is either path-dependent or dynamic (one per chain). This
section documents the exact layouts that relayers must provide.

#### `pay_foreign_via_cctp`

Path selection: `config.has_wormhole && chain_registry.has_wormhole`.
Pass only the accounts for the **active path** (Option B — no padding for the inactive path).

**Wormhole path** (16 total):

```
[0..7]   deposit_for_burn accounts (CCTP TokenMessengerMinter):
  [0] message_transmitter_state   (mut)
  [1] token_messenger_state
  [2] remote_token_messenger      (for dest circle_domain)
  [3] token_minter_state
  [4] local_token                 (for USDC, mut)
  [5] message_sent_event_data     (new Keypair, signer)
  [6] message_transmitter_program
  [7] token_messenger_minter_program

[8..15]  post_message accounts (Wormhole Post-Message Shim):
  [8]  wormhole_shim_program
  [9]  wormhole_core_program
  [10] wormhole_bridge             (PDA [b"Bridge"] in core bridge)
  [11] wormhole_message            (PDA [emitter.key] in shim — reusable)
  [12] wormhole_sequence           (PDA [b"Sequence", emitter] in core bridge)
  [13] wormhole_fee_collector      (PDA [b"fee_collector"] in core bridge, mut)
  [14] clock                       (sysvar::clock::ID)
  [15] event_authority             (PDA [b"__event_authority"] in shim)
```

**CCTP-only path** (10 total):

```
[0..7]  deposit_for_burn accounts (same layout as above)
[8]     message_sent_event_data_payload  (new Keypair, signer — for data msg)
[9]     sender_program                   (Chainbills program ID, executable)
```

`message_transmitter_state [0]` and `message_transmitter_program [6]` from the
deposit_for_burn slice are reused by `send_message`.

#### `broadcast_payable_update`

Named accounts include `sender_authority`, `message_transmitter_program`, and
`chainbills_program`. `remaining_accounts` layout:

```
[0..7]    Wormhole post_message accounts (if config.has_wormhole, same layout as above)

[8..end]  N × 3 per-chain CCTP accounts (if config.has_cctp):
           N = stats.registered_cctp_chain_count
  per chain [n]:
    [8 + n*3 + 0] chain_registry PDA          (read — program validates PDA key)
    [8 + n*3 + 1] message_sent_event_data      (new Keypair, signer)
    [8 + n*3 + 2] message_transmitter_state    (mut)
```

If `config.has_wormhole = false`, the CCTP chunks start at `[0]` instead of `[8]`.
The program validates each `chain_registry` is the canonical PDA for its
`cb_chain_id` and that `has_cctp = true`.

#### `recv_payable_update_via_cctp` (5 accounts)

```
[0] message_transmitter_program
[1] message_transmitter_state   (mut)
[2] used_nonce                  (PDA in MessageTransmitter, init'd by CCTP)
[3] authority_pda               (PDA [b"message_transmitter_authority",
                                      chainbills_program] in MessageTransmitter)
[4] chainbills_program          (receiver — CCTP calls handle_receive_message)
```

#### `recv_payment_via_cctp_wormhole` (13 accounts)

```
[0]  message_transmitter_program
[1]  message_transmitter_state   (mut)
[2]  used_nonce_burn             (PDA in MessageTransmitter, init'd by CCTP)
[3]  authority_pda               (PDA [b"message_transmitter_authority", TMM])
[4]  token_messenger_minter_prog (receiver = TMM — mints USDC)
[5]  token_messenger_state
[6]  remote_token_messenger      (for src_domain)
[7]  token_minter_state
[8]  local_token                 (for USDC, mut)
[9]  token_pair                  (for src_domain + src_token)
[10] custody_token_account       (CCTP USDC custody, mut)
[11] event_authority             (PDA [b"__event_authority"] in TMM)
[12] token_program
```

#### `recv_payment_via_cctp_only` (18 accounts)

Indices 0–4 = **data message** receive (same 5-account layout as
`recv_payable_update_via_cctp` except `used_nonce` is keyed to `data_nonce`).
Indices 5–17 = **burn message** receive (same 13-account layout as
`recv_payment_via_cctp_wormhole` except `used_nonce` is keyed to `burn_nonce`).

#### CCTP PDA derivations (relayer reference)

| Account                     | Seeds                                          | Program              |
| --------------------------- | ---------------------------------------------- | -------------------- |
| `message_transmitter_state` | `[b"message_transmitter"]`                     | MessageTransmitter   |
| `token_messenger_state`     | `[b"token_messenger"]`                         | TokenMessengerMinter |
| `remote_token_messenger`    | `[b"remote_token_messenger", domain_be4]`      | TMM                  |
| `token_minter_state`        | `[b"token_minter"]`                            | TMM                  |
| `local_token`               | `[b"local_token", usdc_mint]`                  | TMM                  |
| `token_pair`                | `[b"token_pair", src_domain_be4, src_token]`   | TMM                  |
| `used_nonce`                | `[b"used_nonces", src_domain_be4, nonce_32]`   | MessageTransmitter   |
| `authority_pda`             | `[b"message_transmitter_authority", receiver]` | MessageTransmitter   |
| `event_authority`           | `[b"__event_authority"]`                       | TMM                  |

#### Instruction discriminators (sha256("global:\<name\>")[0..8])

| Instruction                           | Discriminator                           |
| ------------------------------------- | --------------------------------------- |
| `deposit_for_burn` (TMM)              | `[215, 60, 61, 46, 114, 55, 128, 176]`  |
| `send_message` (MT)                   | `[57, 40, 34, 178, 189, 10, 65, 26]`    |
| `receive_message` (MT)                | `[38, 144, 127, 225, 31, 225, 238, 25]` |
| `post_message` (Wormhole shim)        | `[214, 50, 100, 209, 38, 34, 7, 76]`    |
| `handle_receive_message` (Chainbills) | `[133, 102, 1, 180, 145, 11, 138, 180]` |

#### Testing without live programs (`skip-external-cpi` feature)

Unit tests (LiteSVM) compile the program with `--features skip-external-cpi`.
All CPI call sites are cfg-gated and replaced with `msg!()` stubs. State logic,
payload decoding, replay protection, and counter increments are fully exercised
without needing Circle attestation services or Wormhole guardians.

For broadcast, `skip-external-cpi` also skips the `remaining_accounts` count
check and chain_registry validation — those are tested in live devnet runs.

### Nonce Ordering for Payable Updates

When receiving payable state sync messages, the program enforces monotonically increasing nonces:

```rust
require!(
    payload.nonce > foreign_payable.payable_update_nonce,
    ChainbillsError::StalePayableUpdateNonce
);
```

Both Wormhole and CCTP delivery paths share the same `payable_update_nonce` field — whichever arrives first wins, and the later message is rejected as stale. This prevents out-of-order delivery from regressing payable state.

---

## Stack and Compute Budget Management

Solana's default stack frame is 4KB per function. Complex instructions with many `Account<>` types can overflow this. Three strategies are used throughout:

### Box<> for Heap Allocation

Large accounts are heap-allocated by wrapping in `Box<>`, moving them off the stack:

```rust
pub payable: Box<Account<'info, Payable>>,
pub global_config: Box<Account<'info, Config>>,
```

### Function Decomposition

Each instruction handler is split into sub-functions, each with its own stack frame:

```rust
pub fn process_pay(ctx: Context<Pay>, amount: u64) -> Result<()> {
    validate_payment(&ctx.accounts.payable.allowed_tokens_and_amounts, ...)?;
    execute_transfer(&ctx, amount, decimals)?;
    record_payment(ctx, payer_key, payable_key, token_mint_key, amount)?;
    Ok(())
}
```

All instruction dispatchers in `lib.rs` are annotated `#[inline(never)]` to prevent the compiler from inlining them and inflating the call site's stack frame.

### remaining_accounts for Dynamic Account Sets

CCTP requires ~15 program accounts that vary per operation. These are passed as `remaining_accounts` and validated by key check inside the handler:

```rust
let cctp_accounts = ctx.remaining_accounts;
// Validate each account key against expected program-derived addresses before use
```

### Address Lookup Tables

For the cross-chain payment receive instruction (`recv_payment_via_cctp_wormhole`), the account list exceeds 20 entries. The relayer creates and uses an Address Lookup Table (ALT) to compress account references from 32 bytes each to 1 byte each, keeping the transaction within the 1,232-byte size limit.

### Compute Budget

Cross-chain receive instructions request an elevated compute budget:

```typescript
ComputeBudgetProgram.setComputeUnitLimit({ units: 1_000_000 }),
ComputeBudgetProgram.setComputeUnitPrice({ microLamports: 10_000 }),
```

Wormhole VAA deserialization + CCTP `receive_message` + state updates consume roughly 400k–800k CU. Profile with `simulateTransaction` when adjusting.

---

## Testing

Three layers, each fully isolated. Every test creates its own SVM instance from scratch — no shared validator state, no order dependencies.

### Layer 1 — Rust Unit Tests (mollusk-svm)

In-process SVM execution, no external validator. Tests run per-instruction in isolation with a built-in CU profiler.

```bash
cargo test -p chainbills                     # all unit tests
cargo test -p chainbills test_payload        # single module
```

Test files live at `programs/chainbills/tests/`:

- **`test_admin.rs`** — allow_token, register_chain, fee settings (7 tests)
- **`test_state.rs`** — placeholder (0 tests)
- **Unit tests in `src/`** — payload encode/decode, utils, state helpers (25 tests via `cargo test -p chainbills`)

Each Mollusk test creates a fresh `Mollusk::new(program_id, "chainbills")` — fully isolated.

### Layer 2 — TypeScript E2E Tests (litesvm npm + Jest)

In-process SVM loaded from the compiled `.so`, driven by TypeScript using the Anchor IDL. Each `describe` block calls `LiteSvm.new()` in `beforeEach` — fresh VM, fresh accounts, zero shared state. No `anchor test` or local validator needed.

```bash
cd solana && npm test                                        # all Jest tests
cd solana && npm test -- --testNamePattern="create payable"  # filter by name
cd solana && npm test -- --coverage                          # with coverage
```

Test helpers in `tests/helpers/`:

- **`svm.ts`** — shared LiteSVM setup, loads the `.so`
- **`mock-vaa.ts`** — constructs fake `PostedVAA` account data signed by a test guardian key. Injected into LiteSVM via `svm.setAccount()`. No real Wormhole program needed.
- **`mock-vaa.ts`** — builds fake `PostedVAA` accounts + CCTP message buffers (big-endian wire format). No real Wormhole or Circle attestation needed.
- **`setup.ts`** — bootstraps a standard test environment (initialize, allow_token, register_chain)

---

## About Anchor

This program uses [Anchor](https://www.anchor-lang.com/) `0.32.1` with Rust 2021 edition.

```bash
# Build the program
anchor build

# Build for mainnet (feature flag selects mainnet constants)
anchor build -- --features mainnet

# Run TypeScript e2e tests
cd solana && npm test

# Run Rust unit tests
cargo test -p chainbills

# Show program ID
anchor keys list

# Check compiled program size (should be well under the ~200KB limit)
ls -la target/deploy/chainbills.so

# Inspect a PDA account
anchor account chainbills.Config <PDA_ADDRESS>
```

After any `cargo update` or fresh clone, pin the crates that adopted `edition2024` before platform-tools supports it:

```bash
cargo update -p blake3 --precise 1.8.2
cargo update -p indexmap --precise 2.13.0
cargo update -p "proc-macro-crate@3.5.0" --precise 3.2.0
cargo update -p unicode-segmentation --precise 1.12.0
```

This is required because Solana platform-tools v1.51 bundles Cargo 1.84, which cannot parse `edition2024` manifests. This will be resolved when platform-tools upgrades to Cargo 1.85+.

---

## Deploy Commands

```bash
# Deploy to devnet
anchor deploy --provider.cluster devnet

# Deploy to mainnet
anchor deploy --provider.cluster mainnet

# Upload IDL after deployment
anchor idl init \
  --filepath target/idl/chainbills.json \
  --provider.cluster devnet \
  <PROGRAM_ID>

# Upgrade IDL after a program upgrade
anchor idl upgrade \
  --filepath target/idl/chainbills.json \
  --provider.cluster devnet \
  <PROGRAM_ID>

# Upgrade the program binary
anchor upgrade target/deploy/chainbills.so \
  --program-id <PROGRAM_ID> \
  --provider.cluster devnet

# Create an Address Lookup Table (required for cross-chain receive)
solana address-lookup-table create

# Extend ALT with accounts for the receive instruction
solana address-lookup-table extend <TABLE_ADDRESS> \
  --addresses <ADDR1> <ADDR2> ...

# Simulate a transaction to check compute units consumed
solana simulate <TX_SIGNATURE>
```

### Post-Deploy Admin Setup

After deploying, run these in order to make the program operational:

```bash
# 1. Initialize program (one-time, upgrade authority must sign)
#    Creates Config, Stats, and SenderAuthority PDAs.
# Call initialize instruction via your deploy script or Anchor client.

# 2. Allow USDC for payments
# Call allow_token with the USDC mint address and max_withdrawal_fee.

# 3. Register each foreign chain
# Call register_chain with cb_chain_id, wormhole_chain_id, circle_domain,
# and registered_contract for each EVM chain (Sepolia, Arc Testnet, MegaETH).

# 4. Create Address Lookup Table for cross-chain receive instructions
# Extend with: Config, Stats, ForeignPayable, ConsumedVaa, PaymentNonce,
# CctpTokenBurnNonce, vault_authority, vault_usdc_ata, and all CCTP program accounts.
```

All deployed program IDs, ALT addresses, USDC mints, and cbChainId values are tracked in [DEPLOYED.md](./DEPLOYED.md). Update that file after every deployment or admin call.
