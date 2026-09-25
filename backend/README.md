# Chainbills Backend

## Overview

This service indexes Chainbills smart-contract activity across every enabled chain, relays cross-chain messages (Wormhole VAAs and Circle CCTP attestations), authenticates wallets via Sign-In With Ethereum (SIWE) and Sign-In With Solana (SIWS), delivers email notifications through a transactional outbox, and exposes a public JSON read API for cross-chain data that on-chain getters cannot answer. It is a NestJS application backed by Prisma and PostgreSQL, packaged as a single Docker image. It replaces the older `relayer/` (Node.js event indexer + relay service) and `server/` (Firebase Cloud Functions) for all chains that use the ERC-2535 diamond contracts in `evm/`.

## Architecture

The same Docker image runs in one of three roles, chosen by the `ROLE` environment variable:

| ROLE     | HTTP API                   | Chain indexers, relay, outbox | Needs private keys |
| -------- | -------------------------- | ----------------------------- | ------------------ |
| `all`    | yes                        | yes                           | yes                |
| `api`    | yes                        | no                            | no                 |
| `worker` | `/health` only             | yes                           | yes                |

Today the service runs as `ROLE=all` on a single Cloud Run instance. Splitting into an `api` role (scales freely, holds no keys) and a `worker` role (exactly one instance) is a deployment-config change only — no code change needed. See "Splitting into api + worker services" below.

Worker-side providers are registered by `WorkerModule`, imported only when `ROLE` is `worker` or `all`. HTTP controllers other than `HealthController` are registered only when `ROLE` is `api` or `all`.

## Quick start (local)

**Prerequisites:** Node.js 24 (see `.nvmrc`), pnpm via Corepack, Docker.

```bash
# 1. Enable pnpm (once per machine)
corepack enable

# 2. Install dependencies
cd backend
pnpm install

# 3. Create your local env file
cp .env.example .env
# Edit .env — at minimum set ENABLED_CHAINS, the matching RPC_ var,
# and the three secret vars (JWT_ACCESS_SECRET, OTP_HMAC_SECRET,
# UNSUBSCRIBE_SECRET). See docs/ENV.md for every variable.

# 4. Start Postgres
docker compose up -d postgres

# 5. Apply migrations
pnpm prisma:deploy

# 6. Start the app in watch mode
pnpm start:dev
```

Visit `http://localhost:8080/health` to confirm the service is running, or open `http://localhost:8080/docs` for the Swagger UI.

### Local EVM indexing with Anvil

To index the local Chainbills diamond:

1. In a separate terminal, start Anvil and run `evm/script/DeployLocalStack.s.sol` (see `evm/README.md`).
2. Set `ENABLED_CHAINS=anvil` and `RPC_ANVIL=http://127.0.0.1:8545` in your `.env`.
3. Fill in the deployed diamond address in `src/chains/registry.ts` under the `anvil` entry.
4. Restart `pnpm start:dev`.

## Environment variables

See `docs/ENV.md` for the full reference — type, default, which role needs it, and where to obtain each value.

Three groups matter most:

**Core** (`NODE_ENV`, `ROLE`, `PORT`, `LOG_LEVEL`, `APP_URL`, `PUBLIC_API_URL`, `CORS_ORIGINS`, `DATABASE_URL`, `DIRECT_URL`) — required for every role.

**Chains** (`ENABLED_CHAINS`, `RPC_<SLUG>` per enabled chain) — required for every role; the api role needs them for on-chain signature and ownership verification.

**Auth and notification secrets** (`JWT_ACCESS_SECRET`, `OTP_HMAC_SECRET`, `UNSUBSCRIBE_SECRET`, `RELAYER_PRIVATE_KEY`, `SOLANA_RELAYER_KEYPAIR`, ZeptoMail vars) — required for the roles that use them.

## Testing

Unit tests (no database or network required):

```bash
pnpm test        # run unit tests once
pnpm test:cov    # run unit tests with enforced coverage thresholds
```

End-to-end tests (require a running Postgres):

```bash
docker compose up -d postgres
pnpm prisma:deploy
TEST_DATABASE_URL="postgresql://chainbills:chainbills@localhost:5432/chainbills" pnpm test:e2e
```

Coverage thresholds are enforced in `vitest.config.ts`: lines, functions, and statements >= 90%; branches >= 85%.

## Cloud Run deployment

Deploy one Cloud Run service with these settings:

- `ROLE=all`
- `min-instances=1`, `max-instances=1` (relaying must run on exactly one instance)
- CPU always allocated (background loops must not be suspended)
- All secrets from Google Secret Manager as environment variables (never bake them into the image)
- `DATABASE_URL`: Neon pooled connection string (from the Neon console "Connect" panel)
- `DIRECT_URL`: Neon direct (non-pooled) connection string (same panel, "Direct connection" tab)

Build and push the image from this directory's `Dockerfile`, then deploy with the full set of env vars from `docs/ENV.md`.

The `CMD` in the Dockerfile runs `prisma migrate deploy` before starting the server, so a new image version automatically applies any pending migrations on startup.

## VPS deployment

```bash
cp .env.example .env
# Fill in all values; set NODE_ENV=production, COOKIE_SECURE=true, MAIL_PROVIDER=zeptomail

docker compose up -d                    # Postgres + app
docker compose --profile proxy up -d   # + Caddy for TLS (edit Caddyfile first)
```

The app container's `CMD` runs `prisma migrate deploy` automatically, so a fresh VPS only needs the above commands once Postgres is healthy.

## Splitting into api + worker services

When traffic grows, you can split the single `ROLE=all` service into two separate deployments:

- **api service** (`ROLE=api`): scales freely (multiple instances), holds no private keys, points at the same Postgres. Handles all HTTP traffic except health on the worker.
- **worker service** (`ROLE=worker`): exactly one instance (set `min-instances=max-instances=1`), holds the relayer keys, owns indexing and relay processing.

Both deployments use the same Docker image. The only change is the `ROLE` env var and the instance-count settings. The single-worker invariant is enforced by a Postgres advisory lock (`pg_try_advisory_lock`): a second process pointed at the same database will see the lock is taken, log a warning, and stay idle — relaying is never duplicated.

## Operations

### Inspect relay job queue

```sql
SELECT status, count(*) FROM relay_jobs GROUP BY status;
```

### Retry a stuck relay job

```sql
UPDATE relay_jobs
SET status = 'PENDING', not_before = now(), attempts = 0
WHERE id = '<job-id>';
```

### Inspect the email outbox

```sql
SELECT status, count(*) FROM outbox GROUP BY status;
```

### Inspect chain cursors

```sql
SELECT chain_id, activities_indexed, relay_scan_block, last_tick_at
FROM chain_cursors;
```

### Force re-index from block N

```sql
UPDATE chain_cursors
SET relay_scan_block = <N>
WHERE chain_id = '<cbChainId>';
```

Replace `<N>` with the block number to resume from. The indexer will re-scan relay-trigger events from that block on the next tick.
