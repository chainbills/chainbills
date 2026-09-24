# Phase 2a — EVM Indexer and Relay

**Branch:** `backend-v2-02a-evm-indexer-relay` (worktree from `main`) → merged locally into `main` after review
**Depends on:** phase 1b merged into `main`
**Runs in parallel with:** phase 2b (do not touch `src/auth/`)
**Read first:** `WORKER_RULES.md`, `SPEC.md` §2, §6–8, §11.1, §14;
the contract interface in `evm/CLAUDE.md` ("Cross-chain messaging"),
`evm/src/interfaces/ICbEvents.sol`, `ICbErrors.sol`, `ICbPayments.sol`,
`ICbPayableSync.sol`, `ICb*Views.sol`, `evm/src/types/CbTypes.sol`;
processing patterns in `relayer/src/` (`watchers.ts`, `jobs/`, `resolvers/`,
`index.ts`) — its contract calls target the legacy contracts and must not be
copied as is.

## Goal

The worker role indexes every enabled EVM chain into Postgres through the
diamond's activity log, detects relay triggers from diamond events, and relays
payable updates (Wormhole and CCTP V2) and payments (CCTP V2 with hook data)
between enabled EVM chains of the same network.

## Tasks

1. **Worker module** (`src/worker/`):
   - Advisory lock per SPEC §2.2 on a dedicated connection; loops start only
     while the lock is held.
   - Loop runner utility: start in `onApplicationBootstrap`, stop gracefully
     on shutdown, per-iteration try/catch + structured logging.
   - Gas-balance check and heartbeat ported from `relayer/src/index.ts`
     (EVM only here; Solana balance is added in phase 3a).
2. **EVM indexer** (`src/indexer/evm/`), SPEC §8.2:
   - Activity-driven indexing with `getChainActivities` and the dispatch table
     in SPEC §8.2 (`getPayableView`, `getUserPayment`, `getPayablePayment`,
     `getWithdrawal`, and their `*Bulk` variants), storing `requestedAmount`,
     `amount` and `fee` as the SPEC schema defines.
   - One `prisma.$transaction` per activity: entity upserts, `Activity` row,
     outbox rows (task 4), cursor increment.
   - Payer normalisation (bytes32 → EVM address or Solana base58 by
     `payerChainId`), with unit tests for both.
   - Update `ChainCursor.lastTickAt` every tick; extend `/health` with
     per-chain `lastTickAt` and the staleness rule in SPEC §14.
3. **Relay** (`src/relay/`), SPEC §8.2 step 4 and §8.4:
   - Job store on `RelayJob` (create with dedupe, claim, patch artefacts,
     mark done / retry with backoff / failed).
   - Trigger detection by event logs: `PayableUpdateBroadcasted`,
     `SentPayableUpdateViaCctp`, `SentForeignPaymentViaCctp` scanned from
     `ChainCursor.relayScanBlock` in 9 000-block chunks, creating
     `PAYABLE_UPDATE_VIA_WORMHOLE`, `PAYABLE_UPDATE_VIA_CCTP` and
     `PAYMENT_VIA_CCTP` jobs only towards enabled, same-network destinations.
   - Resolvers: Wormholescan VAA by (chain id, diamond emitter, sequence);
     Circle Iris V2 `GET /v2/messages/{sourceDomain}?transactionHash=` picking
     the message for the job's destination domain; mainnet vs sandbox hosts by
     network.
   - EVM submitter: simulate + send `receivePayableUpdateViaWormhole`,
     `receivePayableUpdateViaCctp` or `receiveForeignPaymentViaCctp` on the
     destination diamond; decode custom errors with the diamond ABI.
   - Processor: sequential, `notBefore` scheduling, 8 attempts, idempotent
     errors → `DONE` and `RelayerOnly` → `FAILED` exactly as SPEC §8.4 lists.
     Solana-destination job types are recognised but left `PENDING` with a log
     line (phase 3a).
   - Startup check: warn per enabled chain when relaying is restricted and the
     relayer lacks `RELAYER_ROLE` (SPEC §6.1).
4. **Outbox writer** (`src/notifications/outbox.writer.ts`), SPEC §11.1 only:
   a function that, given the transaction client, notification type, entity
   id, recipient wallet key, event timestamp and payload, inserts an `Outbox`
   row if the age and verified-email conditions hold (conflict-ignore on
   `dedupeKey`). The processor, provider and templates are phase 3b.
5. **Docs:** `backend/CLAUDE.md` (worker, indexer, relay sections: loops,
   cursors, job lifecycle, invariants), header comments, ENV docs if anything
   changes.

## Tests

- Dispatch per activity type with a mocked diamond client (entity rows,
  refreshed balances / allowed tokens, cursor advance, stop-on-failure).
- Trigger detection: each event → the right job type / destination; multiple
  `SentPayableUpdateViaCctp` in one tx; cross-network and disabled destinations
  skipped; `relayScanBlock` advance.
- Resolvers with mocked `fetch` (pending → complete, destination-domain pick).
- Error classification for every error named in SPEC §8.4.
- Outbox writer: age cut-off, no-verified-email skip, dedupe.
- Job store: dedupe, backoff schedule, max attempts, stale-nonce → done.
- Advisory lock: second holder stays idle (e2e against compose Postgres).

## Acceptance criteria

- With `ROLE=worker`, `ENABLED_CHAINS=anvil` and a diamond deployed by
  `evm/script/DeployLocalStack.s.sol`, the service indexes the chain from 0
  into all entity tables and keeps up with new activity (document the steps in
  `backend/README.md`).
- A second worker process on the same DB stays idle.
- All checks in `WORKER_RULES.md` §5 pass.
