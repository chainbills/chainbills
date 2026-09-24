# Phase 1 — Scaffold

> **Status: merged into `main`.** The pnpm / Node.js 24 / Vitest tooling and the
> diamond alignment that follow it are in phase 1b.

**Branch:** `backend-v2-01-scaffold` (worktree from `main`) → merged locally into `main` after review
**Depends on:** nothing
**Read first:** `backend/docs/WORKER_RULES.md`, `backend/docs/SPEC.md` (§1–7, §13–16)

## Goal

A runnable NestJS service in `backend/` with validated configuration, the full
Prisma schema and first migration, the chain + token registry, logging,
Swagger, throttling, health check, role-based module loading, Docker and
docker compose. No indexing, auth, email or API business logic yet.

## Tasks

1. **Project.** Create `backend/` as a NestJS project (pnpm, Node 24,
   TypeScript strict, ESLint + Prettier matching `relayer/` style: 2 spaces,
   single quotes, 120 columns). Scripts: `start`, `start:dev`, `build`,
   `lint`, `test`, `test:e2e`, `prisma:generate`, `prisma:migrate`
   (`prisma migrate dev`), `prisma:deploy` (`prisma migrate deploy`).
2. **Config** (`src/config/`), per SPEC §5:
   - `env.schema.ts`: zod schema for **every** variable in SPEC §5.2 with the
     stated defaults, formats and role-conditional requirements. Include a
     duration parser (`30s`, `15m`, `12h`, `30d`) exposed as milliseconds.
     Reject `MAIL_PROVIDER=console` when `NODE_ENV=production`.
   - Validation prints all problems (name + reason, never values) and exits 1.
   - Typed access via `ConfigService<Env, true>` or an `AppConfig` wrapper.
   - `src/config/env.schema.spec.ts` covering SPEC §5.1 item 7.
3. **Env docs.** `backend/.env.example` (every var, grouped, commented, safe
   placeholder values) and `backend/docs/ENV.md` (table: name, required for
   roles, default, format, example, where to get it — e.g. Neon console for
   `DATABASE_URL`, ZeptoMail "Mail Agents → SMTP/API" for the API key,
   `openssl rand -base64 48` for secrets).
4. **Prisma.** `prisma/schema.prisma` exactly per SPEC §7 (all models, enums,
   relations, indexes, doc comments), snake_case `@@map`/`@map`,
   `datasource` using `DATABASE_URL` + `DIRECT_URL`. Generate the initial
   migration. `PrismaModule` + `PrismaService` (connect on init, disconnect
   on shutdown).
5. **Chains** (`src/chains/`), per SPEC §6: registry with the four current
   chains (slug `solanadevnet` for Solana devnet), tokens (add Solana devnet
   USDC mint `4zMMC9srt5Ri5X14GAgXhaHii3GnPAEERYPJgZJDncDU`, 6 decimals),
   lookups by `cbChainId` and slug, `mainAbi` / `gettersAbi` copied from
   `relayer/src/utils/abis.ts`, Solana IDL copied from
   `relayer/src/solana/chainbills-idl.json`, and factories for viem public /
   wallet clients and Solana `Connection` that take RPC URLs from config.
   Add a `walletKey(namespace, address)` helper + parser (EVM lowercased,
   Solana validated base58, 32 bytes) with unit tests.
6. **Common** (`src/common/`): global exception filter producing
   `{ statusCode, error, message }`; cursor pagination helpers (encode/decode +
   DTO); amount formatting helper (raw integer string + decimals → decimal
   string, no floating point) with unit tests; `@Public()` decorator
   (metadata only — the guard arrives in phase 2b).
7. **Bootstrap** (`src/main.ts`, `src/app.module.ts`):
   - `nestjs-pino` (JSON; pretty when `NODE_ENV=development`; redact
     `authorization`, `cookie`, `set-cookie` and secret-bearing keys).
   - `cookie-parser`, CORS with `CORS_ORIGINS` + `credentials: true`, body
     size limit 100 kB, security headers (`helmet`), global
     `ValidationPipe({ whitelist, forbidNonWhitelisted, transform })`,
     `@nestjs/throttler` from `THROTTLE_*`, shutdown hooks.
   - Swagger at `/docs` and `/docs-json` with title, version, server
     `PUBLIC_API_URL`, bearer auth + cookie auth schemes declared.
   - Role gating per SPEC §2.1: an empty `WorkerModule` placeholder imported
     only for `worker|all`; an `ApiModule` placeholder imported only for
     `api|all`.
8. **Health** (`src/health/`): `GET /health` → `{ status, role, db }`;
   `503` if `SELECT 1` fails. (Chain freshness is added in phase 2a.)
9. **Docker** per SPEC §15: `Dockerfile`, `.dockerignore`,
   `docker-compose.yml` (postgres with volume + healthcheck; app with
   `env_file`; `caddy` under profile `proxy` with a sample `Caddyfile`).
10. **Docs.** `backend/CLAUDE.md` (overview, module map, invariants, commands,
    link to SPEC and WORKER_RULES) and a short `backend/README.md` (local quick
    start: copy `.env.example`, `docker compose up -d postgres`,
    `pnpm prisma:migrate`, `pnpm start:dev`, open `/docs`).

## Acceptance criteria

- `pnpm lint`, `pnpm build`, `pnpm test:cov`, `pnpm prisma validate` pass.
- With Postgres from compose and a valid `.env`, `pnpm start:dev` boots,
  `GET /health` returns `200` with `db: "ok"`, `/docs` renders.
- Starting with a missing / malformed required var prints every problem and
  exits 1; with `ROLE=api` the relayer keys are not required.
- `docker build` succeeds and the container starts, runs migrations and
  serves `/health`.
- No `process.env` outside `src/config/` (Prisma schema excepted).
- `.env.example`, `docs/ENV.md` and `CLAUDE.md` are complete for everything above.
