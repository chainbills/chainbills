# Phase 4 — Public API

**Branch:** `backend-v2/04-public-api` → PR into `backend-v2`
**Depends on:** phases 2a, 2b, 3a merged into `backend-v2`
**Read first:** `WORKER_RULES.md`, `SPEC.md` §7, §12, §13

## Goal

Complete, well-documented read endpoints over the indexed data across all
chains, plus the host-only description write.

## Tasks

1. `src/api/`: controllers + services for every endpoint in SPEC §12.2 not
   already provided by earlier phases, following the conventions in §12.1
   (pagination, amount objects, chain objects, address formatting, errors).
2. `PUT /payables/:id/description`: authenticated; host check against the
   indexed payable, or on-chain (EVM getters `getPayable` / Solana payable
   account) when not yet indexed; sanitise to plain text; 3–3000 chars;
   upsert `PayableDescription`.
3. `GET /stats` aggregates in SQL (Prisma `groupBy` or `$queryRaw`), not in memory.
4. `GET /chains` from the registry.
5. Swagger completeness: every route has tags, operation summary, params,
   query DTOs, response DTOs with examples, and error responses.
6. Add missing DB indexes for the query patterns (new migration allowed in
   this phase; state it in the PR).
7. Docs: `backend/CLAUDE.md` API section (conventions, endpoint map).

## Tests

- e2e with seeded data for every endpoint: filters, pagination round-trip,
  amount formatting, EVM + Solana address output, 404s.
- Description write: host allowed, non-host `403`, unindexed payable path
  with mocked chain read, sanitisation.

## Acceptance criteria

- `/docs-json` validates as OpenAPI 3 and documents every public route.
- All checks in `WORKER_RULES.md` §5 pass.
