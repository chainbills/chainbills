# Chainbills — Root CLAUDE.md

## What This Is

Cross-chain payment gateway. Users create **payables** (public invoices). Payers send crypto to payables. Hosts withdraw. 2% fee on withdrawals. Powered by Wormhole (VAAs) + Circle CCTP (USDC transfers).

## Active Subdirectories

| Dir           | Status         | Purpose                                                                                     |
| ------------- | -------------- | ------------------------------------------------------------------------------------------- |
| `evm/`        | **Active**     | Solidity contracts (Foundry). Deploy target for all EVM chains.                             |
| `solana/`     | **Active**     | Anchor 0.32.1 program (Rust). Phases 1–19 complete. Devnet deploy pending (Phase 20).      |
| `relayer/`    | **Active**     | Node.js event indexer + cross-chain relay service (Docker / Cloud Run). Solana support added. |
| `frontend/`   | **Active**     | Vue 3 + Pinia + Wagmi SPA. Solana store added.                                              |
| `server/`     | Active (minor) | Firebase Cloud Functions for descriptions + FCM tokens.                                     |
| `solana_old/` | **Ignore**     | Old Solana code — superseded by `solana/`.                                                  |
| `cosmwasm/`   | **Ignore**     | Old CosmWasm code — needs rebuilding.                                                       |

## Deployed Chains (as of May 2026)

| Chain            | Type        | cbChainId   | Wormhole     | CCTP          |
| ---------------- | ----------- | ----------- | ------------ | ------------- |
| MegaETH Mainnet  | mainnet EVM | `0x78b4...` | ✓ (id=64)    | ✗             |
| Ethereum Sepolia | testnet EVM | `0xafa9...` | ✓ (id=10002) | ✓ (domain=0)  |
| Arc Testnet      | testnet EVM | `0xfcfa...` | ✗            | ✓ (domain=26) |

Full addresses: `evm/DEPLOYED.md`

## cbChainId — The Universal Key

All cross-chain references use `cbChainId = keccak256("namespace:reference")` (CAIP-2).

- Ethereum Sepolia: `keccak256("eip155:11155111")`
- Arc Testnet: `keccak256("eip155:5042002")`
- MegaETH: `keccak256("eip155:4326")`
- Solana Mainnet: `keccak256("solana:5eykt4UsFv8P8NJdTREpY1vzqKqZKvdp")`
- Solana Devnet: `keccak256("solana:EtWTRABZaYq6iMfeYKouRu166VU2xqa1")`

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

# Solana
cd solana && anchor build
cd solana && npm test                    # Jest + LiteSVM unit tests
cd solana && cargo test -p chainbills   # Rust unit tests (payload, utils)
cd solana && anchor deploy --provider.cluster devnet

# Relayer
cd relayer && npm run dev       # tsx watch (hot reload)
cd relayer && npm run build     # compile TypeScript → lib/
cd relayer && npm run backfill  # backfill historical events

# Frontend
cd frontend && npm run dev
cd frontend && npm run build
cd frontend && npm run type-check
```

## Commit and PR Conventions

- Conventional Commits (`feat(scope): …`, `fix(scope): …`, `docs(scope): …`), present tense, describing what the change adds or does.
- Never mention AI, assistants, agents, sessions, Claude, models, test status, or history ("changed X from Y", "fixed previous") in commit messages, PR titles or PR bodies.
- No `Co-Authored-By` or `Claude-Session` trailers in commits; no "Generated with …" footers or session links in PR bodies.

## Backend v2 (in progress)

`backend/` is the NestJS + Prisma + PostgreSQL service replacing `relayer/` and `server/` (both stay in the repo until retired manually). Spec: `backend/docs/SPEC.md`. Contributor rules: `backend/docs/WORKER_RULES.md`. Phase tasks: `backend/docs/phases/`. Integration branch: `backend-v2`.
