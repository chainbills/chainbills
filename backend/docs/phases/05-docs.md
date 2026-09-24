# Phase 5 — Documentation and Handover

**Branch:** `backend-v2-05-docs` (worktree from `main`) → merged locally into `main` after review
**Depends on:** all previous phases merged into `main`
**Read first:** `WORKER_RULES.md`, `SPEC.md`

## Goal

Documentation that lets a new developer run, deploy and extend the backend
without reading the source first.

## Tasks

1. `backend/README.md`: overview, architecture diagram, local development,
   testing, Cloud Run + Neon deployment (service settings: `ROLE=all`,
   min = max = 1, CPU always allocated, secrets), VPS deployment with
   `docker compose --profile proxy`, splitting into `api` + `worker`
   services later, operating notes (stuck relay jobs, failed outbox rows,
   cursor inspection with SQL snippets).
2. `backend/CLAUDE.md`: final pass so the module map, invariants and commands
   match the code exactly.
3. `backend/docs/ENV.md` and `.env.example`: final consistency check against
   `env.schema.ts` (add a unit test that fails if a schema key is missing from
   `.env.example`).
4. Root `CLAUDE.md`: add a `backend/` row to the "Active Subdirectories"
   table and a short "Backend" command block. Do not remove or change
   existing rows or sections.
5. Verify every source file has a header comment and every exported symbol has JSDoc; fill gaps.

## Acceptance criteria

- A fresh clone can follow `backend/README.md` to a running local stack.
- The `.env.example` consistency test passes.
- All checks in `WORKER_RULES.md` §5 pass.
