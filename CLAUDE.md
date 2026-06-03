# Chainbills — Root CLAUDE.md

## What This Is

Cross-chain payment gateway. Users create **payables** (public invoices). Payers send crypto to payables. Hosts withdraw. 2% fee on withdrawals. Powered by Wormhole (VAAs) + Circle CCTP (USDC transfers).

## Active Subdirectories

| Dir | Status | Purpose |
|-----|--------|---------|
| `evm/` | **Active** | Solidity contracts (Foundry). Deploy target for all EVM chains. |
| `relayer/` | **Active** | Node.js event indexer + cross-chain relay service (Docker / Cloud Run). |
| `frontend/` | **Active** | Vue 3 + Pinia + Wagmi SPA. |
| `server/` | Active (minor) | Firebase Cloud Functions for descriptions + FCM tokens. |
| `solana_old/` | **Ignore** | Old Solana code — needs rebuilding. |
| `cosmwasm/` | **Ignore** | Old CosmWasm code — needs rebuilding. |

## Deployed Chains (as of May 2026)

| Chain | Type | cbChainId | Wormhole | CCTP |
|-------|------|-----------|----------|------|
| MegaETH Mainnet | mainnet EVM | `0x78b4...` | ✓ (id=64) | ✗ |
| Ethereum Sepolia | testnet EVM | `0xafa9...` | ✓ (id=10002) | ✓ (domain=0) |
| Arc Testnet | testnet EVM | `0xfcfa...` | ✗ | ✓ (domain=26) |

Full addresses: `evm/DEPLOYED.md`

## cbChainId — The Universal Key

All cross-chain references use `cbChainId = keccak256("namespace:reference")` (CAIP-2).
- Ethereum Sepolia: `keccak256("eip155:11155111")`
- Arc Testnet: `keccak256("eip155:5042002")`
- MegaETH: `keccak256("eip155:4326")`

Never use Wormhole uint16 IDs or Circle uint32 domains as cross-chain keys in app logic — always use cbChainId.

## Cross-Chain Flow

### Same-chain payment
`pay(payableId, token, amount)` — direct, no bridge.

### Cross-chain payment (different EVM chains)
1. Payer calls `payForeignViaCctp(payableId, token, amount, maxFee)` on source chain.
2. Contract burns USDC via Circle CCTP + publishes Wormhole VAA (or second CCTP message).
3. Relayer detects `UserPaid` event, creates a `PAYMENT_VIA_CCTP_WORMHOLE` or `PAYMENT_VIA_CCTP_ONLY` job.
4. Relayer fetches attestations, calls `receiveForeignPaymentViaCctp(params)` on dest chain.

### Payable update sync
When a payable is created/updated, `PayableUpdateBroadcasted` fires. Relayer creates relay jobs to push the `PayablePayload` to all other chains (via Wormhole VAA or CCTP message).

## Key Data Structures (shared across all code)

- `Payable` — public invoice, has host, allowedTokensAndAmounts, balances, isAutoWithdraw, isClosed
- `UserPayment` — payer's receipt, lives on payer's chain
- `PayablePayment` — payable's receipt, lives on payable's chain
- `Withdrawal` — host withdrawal record
- `ActivityRecord` — audit log entry (enum ActivityType)
- `PayablePayload` (type=1) — cross-chain sync message for payable state
- `PaymentPayload` (type=2) — cross-chain sync message for payment data

## Architecture Invariants

1. All writes use `{ merge: true }` in Firestore — relayer and server write different fields to same doc.
2. `destinationCaller = address(this)` on CCTP payment burns — only Chainbills contract can submit, preventing griefing.
3. `destinationCaller = bytes32(0)` on payable update messages — anyone can submit (no funds involved).
4. Nonce dedup: both Wormhole and CCTP paths share `payableUpdateNonces` — whichever arrives first wins.
5. Native token represented by `address(this)` (contract address) in all token mappings.

## Common Commands

```bash
# EVM
cd evm && forge build
cd evm && forge test
cd evm && ./script/run.sh <chain> <ScriptName>

# Relayer
cd relayer && npm run dev       # tsx watch (hot reload)
cd relayer && npm run build     # compile TypeScript → lib/
cd relayer && npm run backfill  # backfill historical events

# Frontend
cd frontend && npm run dev
cd frontend && npm run build
cd frontend && npm run type-check
```
