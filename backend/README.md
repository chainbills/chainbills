# Chainbills Backend v2

NestJS + Prisma + PostgreSQL service for Chainbills: chain indexing,
cross-chain relaying, wallet auth, email notifications and the public read
API. See [`docs/SPEC.md`](docs/SPEC.md) for the full specification and
[`CLAUDE.md`](CLAUDE.md) for the module map and current build status.

## Local quick start

Requires Node.js 24 (see `.nvmrc`), pnpm (enable with `corepack enable`; the version is pinned in `package.json#packageManager`) and Docker.

```bash
cd backend
cp .env.example .env
# Set ENABLED_CHAINS=anvil (once you fill in the diamond address after running
# evm/script/DeployLocalStack.s.sol) or ENABLED_CHAINS=solanadevnet for Solana
# devnet indexing. Set RPC_<SLUG> for each enabled chain (e.g. RPC_ANVIL=http://127.0.0.1:8545
# or RPC_SOLANADEVNET=https://api.devnet.solana.com). Fill in either real
# secrets or any 32+ character placeholder strings for JWT_ACCESS_SECRET /
# OTP_HMAC_SECRET / UNSUBSCRIBE_SECRET — see docs/ENV.md for exactly what
# each variable needs.

pnpm install
docker compose up -d postgres
pnpm prisma:migrate        # applies prisma/migrations/ to your local DB
pnpm start:dev             # nest start --watch

# in another terminal
curl http://localhost:8080/health
open http://localhost:8080/docs   # Swagger UI
```

## Tests

```bash
pnpm lint
pnpm build
pnpm test:cov           # unit tests + enforced coverage thresholds — no DB or network required
pnpm prisma validate
pnpm test:e2e           # needs: docker compose up -d postgres
```

## Deploying

### Cloud Run + Neon (current production setup)

One Cloud Run service, `ROLE=all`, `min-instances=1`, `max-instances=1`, CPU
always allocated (SPEC.md §15 / §2.2 — relaying must run on exactly one
instance). Secrets come from Secret Manager as env vars; `DATABASE_URL` is
Neon's pooled connection string, `DIRECT_URL` its direct one (both from the
Neon console's **Connect** panel). Build and push the image from this
directory's `Dockerfile`, then deploy it with those env vars set — see
[`docs/ENV.md`](docs/ENV.md) for every variable Cloud Run needs.

### VPS (docker compose)

```bash
cp .env.example .env   # fill in real values; set COOKIE_SECURE=true, NODE_ENV=production, MAIL_PROVIDER=zeptomail
docker compose up -d                   # Postgres + app only
docker compose --profile proxy up -d   # + Caddy, terminating TLS for api.<domain> (edit Caddyfile first)
```

The app container's `CMD` runs `prisma migrate deploy` automatically before
starting, so a fresh VPS only needs `docker compose up -d` once Postgres is
healthy.
