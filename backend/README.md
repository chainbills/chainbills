# Chainbills Backend

NestJS + Prisma + PostgreSQL service for Chainbills: chain indexing, cross-chain relaying, wallet auth, email notifications, and the public read API. 

## Table of Contents

- [Module map](#module-map)
- [Local quick start](#local-quick-start)
- [Tests](#tests)
- [Deploying](#deploying)

## Module map

```
src/
  main.ts                 Bootstrap: pino, cookies, CORS, body limit, helmet,
                           validation pipe, Swagger (/docs, /docs-json), shutdown hooks
  app.module.ts            Root module; imports WorkerModule only for ROLE=worker|all,
                           ApiModule only for ROLE=api|all; HealthModule always
  config/
    env.schema.ts           zod schema for every env var (SPEC.md §5); validateEnv()
                           prints all problems and exits 1; loadEnv() for the
                           role gate in app.module.ts; rpcVarName() converts a
                           slug to its RPC_<SLUG> env var name
    app-config.service.ts   Typed AppConfigService, the only way the app reads config;
                           exposes rpcUrl(slug) for per-chain RPC URL lookup
    config.module.ts        Wraps ConfigModule.forRoot({ validate: validateEnv }), global
  prisma/
    prisma.service.ts       PrismaClient wrapper: connects on init, disconnects on shutdown
    prisma.module.ts        Global PrismaModule
  chains/
    types.ts                ChainConfig / EvmChainConfig / SolanaChainConfig types;
                           EvmChainConfig has diamondAddress, caip2, network;
                           SolanaChainConfig has relayEnabled; Network union type
    registry.ts              arcmainnet, anvil, solanadevnet; CHAINS, CHAIN_BY_CB_CHAIN_ID,
                           CHAIN_BY_SLUG, EVM_CHAINS, SOLANA_CHAINS;
                           enabledChains(slugs), sameNetwork(a, b),
                           requireChainByCbChainId(id)
    tokens.ts                Token registry (address/mint, symbol, decimals) per chain;
                           resolveToken(), resolveTokenFromRegistry();
                           injectable TokenResolverService with ERC-20 fallback + cache
    abi/
      chainbills.ts          chainbillsAbi — verbatim copy of evm/abi/chainbills.ts;
                           the only ABI used by the backend (no legacy mainAbi/gettersAbi)
      abi-sync.spec.ts       Fails when chainbills.ts diverges from evm/abi/chainbills.json;
                           skipped when that file is absent (Docker build, CI without evm/)
    idl/chainbills-idl.json  Solana program IDL, copied from relayer/src/solana/
    clients.ts               viem public/wallet client + Solana Connection factories
                           (take an RPC URL as an argument; never a mutated global)
    chains.service.ts        Joins the registry with AppConfigService's ENABLED_CHAINS +
                           RPC URLs; global; exposes enabled chains and getRpcUrl(chain)
    chains.module.ts
    wallet-key.ts             walletKey()/parseWalletKey() for "evm:0x..." | "solana:..."
  common/
    filters/                 GlobalExceptionFilter -> { statusCode, error, message }
    pagination/               Cursor encode/decode + PaginationQueryDto
    amount/                   formatAmount(): raw integer string + decimals -> decimal string
    decorators/               @Public() route metadata; IS_PUBLIC_KEY read by JwtAuthGuard
  health/                    GET /health -> { status, role, db, chains[{slug,lastTickAt,stale}] };
                             503 when DB unreachable or any enabled chain's lastTickAt older than 5x
                             its pollIntervalMs; registered for every role
  notifications/
    outbox.writer.ts          enqueueOutbox(): inserts Outbox row inside a Prisma transaction; skips
                             when event is older than EMAIL_MAX_EVENT_AGE or recipient has no verified
                             email; dedupes on "<TYPE>:<entityId>:<walletKey>"
    index.ts                  Re-exports enqueueOutbox, PrismaTransactionClient
  indexer/
    evm/
      evm.indexer.ts          Activity-driven EVM indexer; one tick per enabled EVM chain; dispatches
                             each ActivityType to entity upserts + Activity row + Outbox rows +
                             cursor increment inside one prisma.$transaction; stops on first failure;
                             calls detectRelayTriggers after each activity page; updates lastTickAt every tick
      payer-normalise.ts      normalisePayerBytes32(): bytes32 -> EVM hex address (last 20 bytes) or
                             Solana base58 (all 32 bytes) based on the payer's chain
      evm-indexer.module.ts   Provides EvmIndexer; imported by WorkerModule
  relay/
    job.store.ts              RelayJob CRUD: createJob (skipDuplicates), claimJob (FOR UPDATE SKIP LOCKED),
                             patchArtefacts, markDone, markFailed, retryLater (backoff = 30s * 2^attempts
                             capped at 10 min; after 8 attempts -> FAILED), countByStatus
    trigger.detector.ts       detectRelayTriggers(): scans diamond logs in 9000-block chunks from
                             cursor.relayScanBlock+1; creates PAYABLE_UPDATE_VIA_WORMHOLE,
                             PAYABLE_UPDATE_VIA_CCTP, and PAYMENT_VIA_CCTP jobs; advances relayScanBlock
                             after each chunk; dedupes via unique key (type,txHash,destChainId)
    relay.processor.ts        RelayProcessor: claims one job, resolves artefacts (VAA/CCTP attestation),
                             submits to dest diamond, classifies result; idempotent errors -> DONE;
                             RelayerOnly -> FAILED; InsufficientFinality + pending -> retry; Solana
                             job types left PENDING (Solana relay not yet implemented); processOne() returns bool
    relay.module.ts           Provides RelayProcessor; imported by WorkerModule
    resolvers/
      wormhole.resolver.ts    fetchVaa(): fetches signed VAA from WormholeScan by (chainId, emitter, seq);
                             returns null when not yet available; mainnet/sandbox URLs by network
      cctp.resolver.ts        fetchCctpAttestation(): polls Circle Iris V2 API; picks message by
                             destinationDomain; returns null when not yet complete; mainnet/sandbox by network
    submitters/
      evm.submitter.ts        submitReceivePayableUpdate{ViaWormhole,ViaCctp} and
                             submitReceiveForeignPaymentViaCctp: simulate then writeContract on dest diamond;
                             decodes custom ABI errors; strips abi from viem errors before logging
  worker/
    advisory-lock.ts          acquireAdvisoryLock(): pg_try_advisory_lock on a dedicated connection;
                             retries every 30s; releaseAdvisoryLock(): pg_advisory_unlock + end connection
    loop-runner.ts            runLoop(): starts a named async loop; catches iteration errors without crashing;
                             returns a stop() function that waits for the current iteration to finish
    worker.module.ts          WorkerModule: acquires advisory lock on bootstrap; checks RELAYER_ROLE on each
                             enabled EVM chain; starts per-chain indexer loops, relay processor loop,
                             gas-balance check (every 5 min), and heartbeat (every 15 min); stops gracefully
  api/
    api.module.ts             Imports AuthModule; placeholder for public API controllers
  auth/
    auth.module.ts            Registers JwtAuthGuard as APP_GUARD (global, deny-by-default)
    auth.controller.ts        POST /auth/nonce | /verify | /refresh | /logout | /logout-all
    auth.service.ts           Nonce issue, verify orchestration, refresh rotation, revoke
    nonce.service.ts          Generate, find, mark-used, opportunistic cleanup of AuthNonce rows
    session.service.ts        Create, rotate, revoke sessions; sha256 token hashing
    siwe-verifier.ts          viem parseSiweMessage + publicClient.verifyMessage (EOA/ERC-1271/ERC-6492)
    siws-verifier.ts          tweetnacl ed25519 verify; signature as base58 or base64
    siws-parser.ts            SIWS text-format message parser (all fields, typed result)
    jwt-auth.guard.ts         Global guard: reads Bearer token, verifies JWT, checks session in DB
    current-user.decorator.ts @CurrentUser() param decorator; returns { userId, walletKey, sessionId }
    auth.dto.ts               DTOs: NonceResponse, VerifyRequest/Response, RefreshResponse
prisma/
  schema.prisma              Full data model (SPEC.md §7)
  migrations/
    20260924165704_init/      Initial schema
    20260924220000_diamond_alignment/  Adds requestedAmount, fee, relayScanBlock;
                             aligns RelayJobType (PAYMENT_VIA_CCTP replaces two legacy
                             types); adds cctpMessage/cctpAttestation to RelayJob
```

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

One Cloud Run service, `ROLE=all`, `min-instances=1`, `max-instances=1`, CPU always allocated (SPEC.md §15 / §2.2 — relaying must run on exactly one instance). Secrets come from Secret Manager as env vars; `DATABASE_URL` is Neon's pooled connection string, `DIRECT_URL` its direct one (both from the Neon console's **Connect** panel). Build and push the image from this directory's `Dockerfile`, then deploy it with those env vars set — see [`docs/ENV.md`](docs/ENV.md) for every variable Cloud Run needs.

### VPS (docker compose)

```bash
cp .env.example .env   # fill in real values; set COOKIE_SECURE=true, NODE_ENV=production, MAIL_PROVIDER=zeptomail
docker compose up -d                   # Postgres + app only
docker compose --profile proxy up -d   # + Caddy, terminating TLS for api.<domain> (edit Caddyfile first)
```

The app container's `CMD` runs `prisma migrate deploy` automatically before starting, so a fresh VPS only needs `docker compose up -d` once Postgres is healthy.
