# Phase 3a — Solana Indexer and Relay

**Branch:** `backend-v2-03a-solana-indexer-relay` (worktree from `main`) → merged locally into `main` after review
**Depends on:** phase 2a merged into `main`
**Runs in parallel with:** phase 3b (do not touch `src/users/`, `src/notifications/` except calling the outbox writer)
**Read first:** `WORKER_RULES.md`, `SPEC.md` §6–8, §11.1; reference code in
`relayer/src/solana/` and the Solana branches of `relayer/src/watchers.ts`,
`relayer/src/jobs/processor.ts`, `relayer/src/index.ts`

## Goal

The worker indexes Solana devnet into the same tables as EVM. Solana relaying
is ported and tested but ships **disabled** (`relayEnabled: false` on
`solanadevnet`): the Solana program still uses CCTP V1 + Wormhole payments
while the EVM diamond uses CCTP V2 hook payments, and no same-network diamond
exists for Solana devnet (SPEC §8.3).

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
   `relayer/src/solana/submitter.ts` and route the Solana job types to it in
   the processor. Trigger detection and job creation for a Solana chain run
   only when its `relayEnabled` is true; with the default `false` no Solana
   relay jobs are created.
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
- With `relayEnabled: true` in a test registry, Solana-destination jobs are
  routed to the Solana submitter; with the shipped default, no Solana relay
  jobs are created.
- All checks in `WORKER_RULES.md` §5 pass.
