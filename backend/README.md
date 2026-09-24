# Chainbills Backend v2

NestJS + Prisma + PostgreSQL service for Chainbills: chain indexing,
cross-chain relaying, wallet auth, email notifications and the public read
API. See [`docs/SPEC.md`](docs/SPEC.md) for the full specification and
[`CLAUDE.md`](CLAUDE.md) for the module map and current build status.

## Local quick start

Requires Node.js 22 and Docker.

```bash
cd backend
cp .env.example .env
# Fill in RPC_*, and either real secrets or any 32+ character placeholder
# strings for JWT_ACCESS_SECRET / OTP_HMAC_SECRET / UNSUBSCRIBE_SECRET —
# see docs/ENV.md for exactly what each variable needs and where to get it.

npm install
docker compose up -d postgres
npm run prisma:migrate     # applies prisma/migrations/ to your local DB
npm run start:dev          # nest start --watch

# in another terminal
curl http://localhost:8080/health
open http://localhost:8080/docs   # Swagger UI
```

## Tests

```bash
npm run lint
npm run build
npm test                # unit tests — no DB or network required
npx prisma validate
npm run test:e2e         # needs: docker compose up -d postgres
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
