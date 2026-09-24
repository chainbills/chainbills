# Chainbills Backend v2 — CLAUDE.md

NestJS + Prisma + PostgreSQL service that will replace `relayer/` and
`server/`: chain indexing, cross-chain relaying, wallet auth, email
notifications and a public read API, behind one Docker image.

Read [`docs/SPEC.md`](docs/SPEC.md) (the source of truth for behaviour) and
[`docs/WORKER_RULES.md`](docs/WORKER_RULES.md) (contributor rules) before
changing anything here. [`docs/phases/`](docs/phases) has one task file per
build phase; this file is kept current with whatever the latest merged phase
added.

## Status

**Phase 1b (diamond alignment) complete.** ABI updated to the ERC-2535
diamond ABI (`chainbillsAbi`). Registry updated to `arcmainnet`, `anvil`,
`solanadevnet`. `ENABLED_CHAINS` + `RPC_<SLUG>` replace the old per-chain
RPC vars. Second Prisma migration adds `requestedAmount`, `fee`,
`relayScanBlock`, and aligns `RelayJobType` and `RelayJob`. All checks pass.

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
    app-config.service.ts   Typed AppConfigService — the only way the app reads config;
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
                           (take an RPC URL as an argument — never a mutated global)
    chains.service.ts        Joins the registry with AppConfigService's ENABLED_CHAINS +
                           RPC URLs; global; exposes enabled chains and getRpcUrl(chain)
    chains.module.ts
    wallet-key.ts             walletKey()/parseWalletKey() for "evm:0x…" | "solana:…"
  common/
    filters/                 GlobalExceptionFilter -> { statusCode, error, message }
    pagination/               Cursor encode/decode + PaginationQueryDto
    amount/                   formatAmount(): raw integer string + decimals -> decimal string
    decorators/               @Public() route metadata (read by the guard from phase 2b)
  health/                    GET /health -> { status, role, db }; registered for every role
  worker/                    Empty placeholder — indexers, relay processor, outbox (2a/3a/3b)
  api/                       Empty placeholder — auth, users, public API controllers (2b/3b/4)
prisma/
  schema.prisma              Full data model (SPEC.md §7) — phase 1b added second migration
  migrations/
    20260924165704_init/      Initial schema
    20260924220000_diamond_alignment/  Adds requestedAmount, fee, relayScanBlock;
                             aligns RelayJobType (PAYMENT_VIA_CCTP replaces two legacy
                             types); adds cctpMessage/cctpAttestation to RelayJob
```

## Invariants

- **`process.env` only inside `src/config/`.** Everything else reads
  `AppConfigService.env`. Prisma's own `env()` calls in `schema.prisma` are
  the sole additional exception.
- **Diamond-only, no legacy ABIs.** The backend uses only `chainbillsAbi`
  (the ERC-2535 diamond ABI). The old `mainAbi` / `gettersAbi` (legacy single-proxy
  contracts) are gone. The ABI sync test fails if the copy drifts from `evm/abi/chainbills.json`.
- **RPC URLs are never a mutated global.** `chains/registry.ts` holds no
  `rpcUrl` field; `ChainsService` joins the static registry with
  `AppConfigService`'s RPC URLs once at construction, and the client
  factories in `chains/clients.ts` take a URL as an explicit argument.
- **`ENABLED_CHAINS` gate.** A chain cannot run until it is listed in
  `ENABLED_CHAINS` and its `diamondAddress` (EVM) or `programId` (Solana) is
  non-null in the registry. Config validation rejects all problems at once,
  never silently.
- **Networks never mix.** `sameNetwork(a, b)` must be true before creating
  a relay job between two chains. Mainnet, testnet, and local chains are fully
  isolated from each other's relay paths.
- **Role gating happens at module-decoration time**, not through DI:
  `app.module.ts` calls `loadEnv()` (which itself calls `validateEnv(process.env)`)
  to decide whether to include `WorkerModule` / `ApiModule`, because Nest's
  module graph is fixed once `@Module({ imports: [...] })` is evaluated —
  an injected `ConfigService` is too late for that decision.
- **A wallet key is `"evm:0x<lowercase>"` or `"solana:<base58>"`.** Built and
  parsed only via `chains/wallet-key.ts`; one EVM address is the same wallet
  on every EVM chain, Solana addresses are namespaced separately.
- **Token amounts are raw integer strings end-to-end** (`Decimal @db.Decimal(78, 0)`
  in Postgres, `string` in TypeScript) — never a JS `number`. `common/amount/format-amount.ts`
  does raw-string -> decimal-string formatting with no floating point.
- **Global modules still need an explicit `imports` edge to consume each
  other's providers.** `@Global()` only controls who can *inject from* a
  module; a global module that itself depends on another global module's
  provider (e.g. `ChainsModule` on `AppConfigModule`) must still import it.
- **Global exception filter never leaks internals.** Anything that is not a
  Nest `HttpException` becomes a bare `500 Internal Server Error` to the
  client; the real error is logged server-side only.
- **Tooling is Node.js 24 + pnpm + Vitest.** Never use npm/yarn or commit a
  `package-lock.json`. Dependency install scripts run only when approved in
  `pnpm-workspace.yaml#allowBuilds`. Vitest uses SWC (`unplugin-swc`)
  because esbuild drops the decorator metadata Nest's DI needs.
- **Coverage thresholds are enforced** in `vitest.config.ts` (lines /
  functions / statements >= 90 %, branches >= 85 %). New code ships with tests
  that keep it there; thresholds are never lowered and exclusions are never
  widened.
- **Prisma schema and migrations are phase-1-owned.** A later phase that
  needs a schema change adds a new migration and says so in its PR
  description, per SPEC.md §17 — it does not rewrite phase 1 or 1b migrations.

## Commands

```bash
cd backend
corepack enable           # once; pnpm version is pinned in package.json#packageManager
pnpm install
pnpm start:dev            # nest start --watch
pnpm build                # nest build -> dist/
pnpm start                # node dist/main.js (after build)
pnpm lint / lint:fix
pnpm test                 # Vitest unit tests (no DB/network needed)
pnpm test:cov             # unit tests + enforced coverage thresholds (see vitest.config.ts)
pnpm test:e2e             # Vitest e2e tests (needs: docker compose up -d postgres)
pnpm prisma:generate      # prisma generate
pnpm prisma:migrate       # prisma migrate dev (local, creates a new migration)
pnpm prisma:deploy        # prisma migrate deploy (applies existing migrations)
```

## Docker / Compose

```bash
docker build -t chainbills-backend .
docker compose up -d postgres            # Postgres only, for local `pnpm start:dev`
docker compose up -d                     # Postgres + app
docker compose --profile proxy up -d     # + Caddy (TLS termination for a VPS)
```

The image is multi-stage (`base` -> `build` -> `runtime`) on `node:24-slim`
with pnpm via Corepack. `node_modules` is taken from the build stage after
`pnpm prune --prod`, so the generated Prisma client ships and dev
dependencies do not. It runs as a non-root user, and its `CMD` runs `prisma migrate deploy` before starting
the server (`exec node dist/main.js`, so `SIGTERM` reaches Nest's shutdown
hooks directly).

## Env vars

See [`docs/ENV.md`](docs/ENV.md) for the full reference table and
[`.env.example`](.env.example) for a ready-to-copy local file.
