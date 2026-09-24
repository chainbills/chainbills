# Phase 2a — EVM Indexer and Relay

**Branch:** `backend-v2/02a-evm-indexer-relay` → PR into `backend-v2`
**Depends on:** phase 1 merged into `backend-v2`
**Runs in parallel with:** phase 2b (do not touch `src/auth/`)
**Read first:** `WORKER_RULES.md`, `SPEC.md` §2, §6–8, §11.1, §14;
reference code in `relayer/src/` (`watchers.ts`, `indexer.ts`, `jobs/`,
`resolvers/`, `submitters/`, `utils/`, `index.ts`)

## Goal

The worker role indexes every EVM chain in the registry into Postgres via the
activity log, detects relay triggers, and relays payable updates and payments
between EVM chains with the same semantics as `relayer/src/`.

## Tasks

1. **Worker module** (`src/worker/`):
   - Advisory lock per SPEC §2.2 on a dedicated connection; loops start only
     while the lock is held.
   - Loop runner utility: start in `onApplicationBootstrap`, stop gracefully
     on shutdown, per-iteration try/catch + structured logging.
   - Gas-balance check and heartbeat ported from `relayer/src/index.ts`
     (EVM only here; Solana balance is added in phase 3a).
2. **EVM indexer** (`src/indexer/evm/`), SPEC §8.2:
   - Activity-driven indexing with the dispatch table in SPEC §8.2.
   - One `prisma.$transaction` per activity: entity upserts, `Activity` row,
     outbox rows (task 4), cursor increment.
   - Payer normalisation ported from `relayer/src/indexer.ts`, with unit tests
     for EVM and Solana payers.
   - Update `ChainCursor.lastTickAt` every tick; extend `/health` with
     per-chain `lastTickAt` and the staleness rule in SPEC §14.
3. **Relay** (`src/relay/`), SPEC §8.2 step 4 and §8.4:
   - Job store on `RelayJob` (create with dedupe, claim, patch artefacts,
     mark done / retry with backoff / failed).
   - Trigger detection ported from `watchers.ts` sections 5–7 and helpers,
     including `getLogsChunked`.
   - Resolvers ported from `relayer/src/resolvers/` (Wormhole VAA, Circle Iris).
   - EVM submitters ported from `relayer/src/submitters/`.
   - Processor ported from `relayer/src/jobs/processor.ts`: sequential,
     `notBefore` scheduling, 5 attempts, `StalePayableUpdateNonce` → `DONE`.
     Solana-destination job types are recognised but left `PENDING` with a
     log line until phase 3a adds the Solana submitter.
4. **Outbox writer** (`src/notifications/outbox.writer.ts`), SPEC §11.1 only:
   a function that, given the transaction client, notification type, entity
   id, recipient wallet key, event timestamp and payload, inserts an `Outbox`
   row if the age and verified-email conditions hold (conflict-ignore on
   `dedupeKey`). The processor, provider and templates are phase 3b.
5. **Docs:** `backend/CLAUDE.md` (worker, indexer, relay sections: loops,
   cursors, job lifecycle, invariants), header comments, ENV docs if anything
   changes.

## Tests

- Dispatch per activity type with a mocked getters client (entity rows,
  refreshed balances / allowed tokens, cursor advance, stop-on-failure).
- Outbox writer: age cut-off, no-verified-email skip, dedupe.
- Job store: dedupe, backoff schedule, max attempts, stale-nonce → done.
- Advisory lock: second holder stays idle (e2e against compose Postgres).

## Acceptance criteria

- With `ROLE=worker` and valid RPCs, the service indexes a chain from 0 into
  all entity tables and keeps up with new activity.
- A second worker process on the same DB stays idle.
- All checks in `WORKER_RULES.md` §5 pass.
