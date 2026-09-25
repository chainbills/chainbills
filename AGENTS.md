# Chainbills — Root CLAUDE.md

## What This Is

Cross-chain payment gateway. Users create **payables** (public invoices). Payers send crypto to payables. Hosts withdraw. 2% fee on withdrawals. Powered by Wormhole (VAAs) + Circle CCTP V2 (USDC transfers).

## Active Subdirectories

| Dir           | Status         | Purpose                                                                                     |
| ------------- | -------------- | ------------------------------------------------------------------------------------------- |
| `evm/`        | **Active**     | Solidity contracts (Foundry). ERC-2535 diamond. Deploy target for all EVM chains.          |
| `solana/`     | **Active**     | Anchor 0.32.1 program (Rust). Devnet deploy pending.                                        |
| `backend/`    | **Active**     | NestJS + Prisma + PostgreSQL service: chain indexing, cross-chain relay, wallet auth, email notifications, public read API. Replaces `relayer/` and `server/`. |
| `frontend/`   | **Active**     | Vue 3 + Pinia + Wagmi SPA.                                                                  |
| `relayer/`    | Legacy         | Old Node.js event indexer + relay service. Superseded by `backend/`. Not retired yet.      |
| `server/`     | Legacy         | Old Firebase Cloud Functions for descriptions + FCM tokens. Superseded by `backend/`.      |
| `solana_old/` | **Ignore**     | Old Solana code — superseded by `solana/`.                                                  |
| `cosmwasm/`   | **Ignore**     | Old CosmWasm code — needs rebuilding.                                                       |

## Deployed Chains (EVM testnet, as of Sep 2026)

| Chain           | Type        | cbChainId   | Wormhole      | CCTP          | Diamond |
| --------------- | ----------- | ----------- | ------------- | ------------- | ------- |
| MegaETH Mainnet | mainnet EVM | `0x78b4...` | ✓ (id=64)     | none          | not deployed yet |
| Arc Testnet     | testnet EVM | `0xfcfa...` | none          | ✓ (domain=26) | `0x3E473E5812542A865086Cb5Cb80D8f3DD3D692A7` |
| Base Sepolia    | testnet EVM | `0x8a9a...` | ✓ (id=10004)  | ✓ (domain=6)  | `0x3E473E5812542A865086Cb5Cb80D8f3DD3D692A7` |

Full addresses and all chain parameters: `evm/DEPLOYED.md`

## cbChainId — The Universal Key

All cross-chain references use `cbChainId = keccak256("namespace:reference")` (CAIP-2).

- Arc Testnet: `keccak256("eip155:5042002")` = `0xfcfa255b...`
- Arc Mainnet: `keccak256("eip155:5042")` = `0xb8aed675...`
- Base Sepolia: `keccak256("eip155:84532")` = `0x8a9a9c58...`
- Base Mainnet: `keccak256("eip155:8453")` = `0x43b48883...`
- MegaETH: `keccak256("eip155:4326")` = `0x78b49881...`
- Solana Mainnet: `keccak256("solana:5eykt4UsFv8P8NJdTREpY1vzqKqZKvdp")`
- Solana Devnet: `keccak256("solana:EtWTRABZaYq6iMfeYKouRu166VU2xqa1")`

Never use Wormhole uint16 IDs or Circle uint32 domains as cross-chain keys in app logic — always use cbChainId.

## Cross-Chain Flow

### Same-chain payment

`pay(payableId, token, amount)` — direct, no bridge.

### Cross-chain payment (different EVM chains)

1. Payer calls `payForeignViaCctp(payableId, token, amount, maxFee)` on source chain.
2. Contract burns USDC via Circle CCTP V2 `depositForBurnWithHook`, carrying the payment payload as hook data.
3. Backend detects `UserPaid` event, creates a `PAYMENT_VIA_CCTP_WORMHOLE` or `PAYMENT_VIA_CCTP_ONLY` relay job.
4. Backend fetches Circle attestation (and Wormhole VAA where applicable), calls `receiveForeignPaymentViaCctp(params)` on dest chain.

### Payable update sync

When a payable is created/updated, `PayableUpdateBroadcasted` fires. Backend creates relay jobs to push the `PayablePayload` to all other chains via Wormhole VAA or CCTP `sendMessage`.

## Key Data Structures (shared across all code)

- `Payable` — public invoice, has host, allowedTokensAndAmounts, balances, isAutoWithdraw, isClosed
- `UserPayment` — payer's receipt, lives on payer's chain
- `PayablePayment` — payable's receipt, lives on payable's chain
- `Withdrawal` — host withdrawal record
- `ActivityRecord` — audit log entry (enum ActivityType)
- `PayablePayload` (type=1) — cross-chain sync message for payable state
- `PaymentPayload` (type=2) — cross-chain sync message for payment data

## Architecture Invariants

1. `destinationCaller = address(this)` on CCTP payment burns — only the Chainbills contract can submit the attestation, preventing griefing.
2. `destinationCaller = bytes32(0)` on payable update messages — anyone can submit (no funds involved).
3. Nonce dedup: `payableUpdateNonces` tracks which update nonces have landed on each chain — whichever attestation arrives first wins; the second is a no-op.
4. Native token represented by `address(this)` (the diamond's own address) in all token mappings.
5. `cbChainId` is the only cross-chain identity key — Wormhole chain IDs and Circle domains are wire-format details stored in `ForeignChain.config.protocolIds`, never used as map keys in app logic.

## CCTP V2 Fast Transfers

CCTP V2 `finalityThreshold` controls attestation speed and cost:
- `1000` = fast / soft-finality (seconds, Circle charges a fee)
- `2000` = finalized / hard-finality (minutes, no extra fee)

`ForeignChainFinality` has four fields: `outboundUpdateFinality`, `outboundPaymentFinality` (what this chain requests when sending), `minInboundUpdateFinality`, `minInboundPaymentFinality` (what this chain accepts when receiving). Setting all four to `1000` enables fast transfers in both directions. Set via `RegisterForeignChain` or `SetForeignChainFinality` admin script.

## Common Commands

```bash
# EVM
cd evm && forge build
cd evm && forge test
cd evm && ./script/run.sh <chain> <ScriptName>         # deploy or admin
cd evm && ./script/run.sh <chain> <ScriptName> --dry-run

# Solana
cd solana && anchor build
cd solana && npm test                    # Jest + LiteSVM unit tests
cd solana && cargo test -p chainbills   # Rust unit tests (payload, utils)
cd solana && anchor deploy --provider.cluster devnet

# Backend
cd backend && pnpm install
cd backend && pnpm start:dev          # NestJS watch mode
cd backend && pnpm build              # compile to dist/
cd backend && pnpm lint
cd backend && pnpm test:cov           # unit tests + coverage thresholds
cd backend && pnpm test:e2e           # e2e (needs: docker compose up -d postgres)
cd backend && pnpm prisma:deploy      # apply migrations
cd backend && docker compose up -d postgres   # Postgres only
cd backend && docker compose up -d            # Postgres + app

# Frontend
cd frontend && npm run dev
cd frontend && npm run build
cd frontend && npm run type-check
```

## Commit and PR Conventions

- Conventional Commits (`feat(scope): ...`, `fix(scope): ...`, `docs(scope): ...`), present tense, describing what the change adds or does.
- Never mention AI, assistants, agents, sessions, Claude, models, test status, or history ("changed X from Y", "fixed previous") in commit messages, PR titles or PR bodies.
- No `Co-Authored-By` or `Claude-Session` trailers in commits; no "Generated with ..." footers or session links in PR bodies.

## Backend

`backend/` is the NestJS + Prisma + PostgreSQL service (pnpm, Node.js 24, Vitest) that replaces `relayer/` and `server/` for the ERC-2535 diamond contracts in `evm/`. Spec: `backend/docs/SPEC.md`. Contributor rules: `backend/docs/WORKER_RULES.md`. Both legacy services stay in the repo until manually retired. Enabled chains and RPC URLs are hardcoded in `backend/src/chains/registry.ts` — no `ENABLED_CHAINS` or `RPC_*` env vars needed.
