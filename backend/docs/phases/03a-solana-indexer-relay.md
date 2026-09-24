# Phase 3a — Solana Indexer and Relay

**Branch:** `backend-v2/03a-solana-indexer-relay` → PR into `backend-v2`
**Depends on:** phase 2a merged into `backend-v2`
**Runs in parallel with:** phase 3b (do not touch `src/users/`, `src/notifications/` except calling the outbox writer)
**Read first:** `WORKER_RULES.md`, `SPEC.md` §6–8, §11.1; reference code in
`relayer/src/solana/` and the Solana branches of `relayer/src/watchers.ts`,
`relayer/src/jobs/processor.ts`, `relayer/src/index.ts`

## Goal

The worker indexes Solana devnet into the same tables as EVM and relays to and
from Solana with the same semantics as `relayer/src/solana/`.

## Tasks

1. `src/indexer/solana/`: port `relayer/src/solana/indexer.ts`,
   `accounts.ts`, `client.ts` into Nest providers. Activity-based indexing
   into `Payable` (+ allowed tokens, balances), `UserPayment`,
   `PayablePayment`, `Withdrawal`, `Activity`; same per-activity transaction,
   cursor and outbox rules as the EVM indexer (reuse its helpers rather than
   duplicating them).
2. Solana relay-trigger detection (signature scanning for outbound Wormhole /
   CCTP messages) ported as is, writing `RelayJob` rows.
3. `src/relay/submitters/solana.submitter.ts`: port
   `relayer/src/solana/submitter.ts` and enable the Solana-destination job
   types in the processor.
4. Solana gas-balance check in the worker housekeeping loop.
5. Solana wallet keys (`solana:<base58>`) for hosts and payers.
6. Docs: `backend/CLAUDE.md` Solana section (PDAs, cursors, relay paths,
   ALT requirement for CCTP-only), header comments.

## Tests

- Activity decoding + dispatch with mocked `Connection` / coder fixtures.
- Payer / host wallet-key derivation.
- Processor routes Solana-destination jobs to the Solana submitter (mocked).

## Acceptance criteria

- With `ROLE=worker`, Solana devnet activity appears in the same tables and
  endpoints as EVM data.
- Solana-destination jobs are processed instead of left pending.
- All checks in `WORKER_RULES.md` §5 pass.
