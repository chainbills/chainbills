# Chainbills Relayer — CLAUDE.md

## Overview

Long-lived Node.js process deployed on Cloud Run (`min-instances=1`). Watches EVM chains, indexes on-chain entities into Firestore, and relays cross-chain payable updates + payments.

## File Map

```
src/
  index.ts               Entry point — starts watchers, job processor, balance checker, heartbeat
  config.ts              Loads + validates env vars, injects RPC URLs into chain configs
  chains.ts              Chain registry: ChainConfig type + arcTestnet/sepolia/megaeth constants
  watchers.ts            Per-chain polling loop using contract stats counters as cursors
  indexer.ts             Writes Firestore records for payables/payments/withdrawals
  jobs/
    store.ts             Firestore job queue CRUD (createJob, markDone, markFailed, etc.)
    processor.ts         Picks up PENDING jobs, dispatches to submitters, handles retries
  resolvers/
    cctp.ts              Polls Circle Iris API for CCTP attestations
    wormhole.ts          Fetches Wormhole VAAs from Wormhole API
  submitters/
    payable-update.ts    submitPayableUpdateViaWormhole / submitPayableUpdateViaCctp / submitAdminSyncPayable
    payment.ts           submitForeignPayment (Wormhole+CCTP) / submitForeignPaymentViaCctp (CCTP-only)
  notify/
    host.ts              FCM push notifications to payable hosts on PayableReceived
  utils/
    abis.ts              mainAbi (Chainbills proxy ABI) + gettersAbi (CbGetters ABI)
    activity.ts          Tracks last-activity timestamp for heartbeat idle detection
    clients.ts           makePublicClient / makeWalletClient / relayerAccount helpers
    encoding.ts          Byte normalization utils (EVM address strip, Solana b58)
    firebase.ts          Firebase Admin init: db (Firestore) + messaging (FCM)
    logger.ts            Pino logger config
    tokens.ts            Token address → { name, decimals } lookup per chain
  scripts/
    backfill.ts          One-shot backfill script for historical events
```

## Chains Watched

Defined in `src/chains.ts`. Add a new chain by adding one `ChainConfig` object there and the env var in `config.ts`. No other files need changing.

| Chain | Poll Interval | Wormhole | CCTP | Deployment Block |
|-------|--------------|----------|------|-----------------|
| arcTestnet | 5s | ✗ | ✓ (domain=26) | 42188119 |
| sepolia | 10s | ✓ (id=10002) | ✓ (domain=0) | 10850296 |
| megaeth | 5s | ✓ (id=64) | ✗ | 0 |

## Indexing: How It Works

Watcher polls `getChainStats()` (one RPC call) each tick. Compares counts vs in-memory cursor. Fetches new IDs via `chainPayableIdsPaginated` / `chainUserPaymentIdsPaginated` etc. Writes to Firestore with `{ merge: true }`. Persists cursor to `relayerCursors/{chainName}` only on change.

Cursor fields per chain:
- `payablesIndexed`, `userPaymentsIndexed`, `payablePaymentsIndexed`, `withdrawalsIndexed`
- `wormholeRelayed` (publishedWormholeMessagesCount high-watermark)
- `cctpPaymentsRelayed` (emittedCctpPaymentMessagesCount high-watermark)
- `cctpPayableUpdatesRelayed` (emittedCctpPayableUpdateMessagesCount high-watermark)

## Job Queue

`/relayerJobs/{docId}` in Firestore. Lifecycle: `PENDING → PROCESSING → DONE | FAILED`.

| Job Type | Trigger | What It Does |
|----------|---------|--------------|
| `PAYABLE_UPDATE_VIA_WORMHOLE` | New `publishedWormholeMessagesCount` | Fetch VAA → `receivePayableUpdateViaWormhole()` on dest |
| `PAYABLE_UPDATE_VIA_CCTP` | New `PayableUpdateBroadcasted` event | Fetch CCTP attestation → `receivePayableUpdateViaCctp()` on dest |
| `PAYMENT_VIA_CCTP_WORMHOLE` | Cross-chain `UserPaid` event (both chains have both protocols) | Fetch VAA + CCTP attestation in parallel → `receiveForeignPaymentViaCctp()` on dest |
| `PAYMENT_VIA_CCTP_ONLY` | Cross-chain `UserPaid` event (CCTP-only path) | Fetch 2 CCTP attestations → `receiveForeignPaymentViaCctp()` on dest |
| `ADMIN_SYNC` | Manual / backfill | Decode VAA → `adminSyncForeignPayable()` on dest |

Max 5 attempts. `StalePayableUpdateNonce` error → mark DONE (already applied by other protocol path).

## Dedup

- CCTP/Wormhole relay jobs: `jobExistsForTx(txHash, destChain)` query before creating.
- Wormhole-only chains: synthetic key `wormhole-seq-{chain}-{sequence}` as txHash.
- Payment nonces: contract enforces `consumedPaymentNonces` on-chain.

## Firestore Layout

```
relayerCursors/{chainName}         Polling cursors per chain
relayerJobs/{jobId}                Job queue (PENDING/PROCESSING/DONE/FAILED)
payables/{payableId}               Indexed payable (merge with server's description field)
userPayments/{paymentId}           User payment receipts
payablePayments/{paymentId}        Payable payment receipts
withdrawals/{withdrawalId}         Withdrawal records
```

All indexer writes use `{ merge: true }` — safe to race with server's `/payable` POST.

## Required Env Vars

```
RELAYER_PRIVATE_KEY=0x...      Wallet with gas + ADMIN_ROLE on all chains
RPC_ARC_TESTNET=https://...
RPC_SEPOLIA=https://...
RPC_MEGAETH=https://...
POLL_INTERVAL_MS=12000          Optional global override
PORT=8080                       Cloud Run health check port (default 8080)
GOOGLE_APPLICATION_CREDENTIALS  Auto-set in Cloud Run; for local use a service account key
```

## Development

```bash
npm run dev          # tsx watch src/index.ts (hot reload)
npm run build        # tsc → lib/
npm run start        # node lib/index.js (production)
npm run backfill     # backfill historical events
```

## Docker / Cloud Run

```bash
docker build -t chainbills-relayer .
docker run -e RELAYER_PRIVATE_KEY=... -e RPC_ARC_TESTNET=... ... chainbills-relayer
```

Two-stage build: builder compiles TS, runner copies `lib/` only. Runs as `node` user.

## Key Invariants

- Process jobs sequentially in `processJobs()` to avoid wallet nonce conflicts.
- Cursors are loaded from Firestore once at startup; heartbeat reload (`reloadCursorsFromFirestore`) lets manual Firestore edits (cursor resets for backfill) take effect without restart.
- CCTP attestation polling: Circle Iris sandbox testnet ~30–90s. `cctpAttestationMinAgeMs` on `sepolia` defers young jobs.
- Gas balance checked every 5 minutes; warns below `chain.minGasBalance`.
- `getLogsChunked` splits ranges into 9,000-block pages to avoid RPC 10k-block cap.
- Viem errors have `abi` field stripped before logging to avoid log floods.
