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

**Phase 2b (auth) complete.** SIWE + SIWS sign-in, JWT access tokens, rotating
httpOnly refresh-token cookies, global deny-by-default guard with `@Public()`
opt-out. `AuthModule` imported by `ApiModule` for `ROLE=api|all`.

**Phase 1b (diamond alignment) complete.** ABI updated to the ERC-2535
diamond ABI (`chainbillsAbi`). Registry updated to `arcmainnet`, `anvil`,
`solanadevnet`. `ENABLED_CHAINS` + `RPC_<SLUG>` replace the old per-chain
RPC vars. Second Prisma migration adds `requestedAmount`, `fee`,
`relayScanBlock`, and aligns `RelayJobType` and `RelayJob`. All checks pass.

**Phase 3a (Solana indexer and relay) complete.** Solana activity indexer
(Stats PDA cursor, ActivityRecord dispatch into the same tables as EVM).
Solana relay trigger detector (signature scanning for Wormhole and CCTP
messages, gated by `relayEnabled`). Solana submitter (stubs pointing to
the Wormhole SDK integration needed for postVAA). Relay processor updated
to route `SOLANA_PAYABLE_UPDATE_VIA_WORMHOLE` and
`SOLANA_PAYMENT_VIA_CCTP_WORMHOLE` jobs to the Solana submitter. Solana
gas-balance check added to the worker housekeeping loop. All checks pass
(433+ unit tests, coverage thresholds met).

**Phase 2a (EVM indexer and relay) complete.** Worker module with advisory
lock, loop runner, gas-balance and heartbeat loops. EVM activity indexer
(activity-driven, one transaction per activity, stop-on-failure). Relay
trigger detector (event-log-based, 9000-block chunks, per-chunk cursor
advance). Relay job store with dedup, backoff, and max-attempts. Wormhole
and CCTP V2 resolvers. EVM submitter with custom error decoding. Relay
processor with idempotent-error classification. Outbox writer. Health check
extended with per-chain lastTickAt staleness. `pg` added for advisory lock.
All checks pass (246 unit tests, coverage thresholds met).

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
    solana/
      solana.client.ts        makeConnection() / makeCoder() / makeProgram() / getPDA() / decodeAccount():
                             wraps @coral-xyz/anchor BorshAccountsCoder and @solana/web3.js Connection;
                             takes RPC URL as an argument, never a global
      solana.accounts.ts      Pure PDA derivation helpers mirroring the Rust seed constants:
                             statsPDA, activityRecordPDA, payablePaymentPDA, and all others needed
                             by the indexer and submitter
      solana.indexer.ts       Activity-driven Solana indexer; reads Stats PDA cursor each tick;
                             dispatches ActivityRecord variants to upserts of Payable, UserPayment,
                             PayablePayment, Withdrawal, and Activity rows (same tables as EVM);
                             calls detectSolanaRelayTriggers only when chain.relayEnabled is true;
                             Solana hosts/payers use walletKey('solana', base58)
      solana-indexer.module.ts  Provides SolanaIndexer; imported by WorkerModule
  relay/
    job.store.ts              RelayJob CRUD: createJob (skipDuplicates), claimJob (FOR UPDATE SKIP LOCKED),
                             patchArtefacts, markDone, markFailed, retryLater (backoff = 30s × 2^attempts
                             capped at 10 min; after 8 attempts -> FAILED), countByStatus
    trigger.detector.ts       detectRelayTriggers(): scans diamond logs in 9000-block chunks from
                             cursor.relayScanBlock+1; creates PAYABLE_UPDATE_VIA_WORMHOLE,
                             PAYABLE_UPDATE_VIA_CCTP, and PAYMENT_VIA_CCTP jobs; advances relayScanBlock
                             after each chunk; dedupes via unique key (type,txHash,destChainId)
    solana-trigger.detector.ts  detectSolanaRelayTriggers(): compares Stats PDA counters to
                             cursor.wormholeRelayed/cctpPaymentsRelayed/cctpPayableUpdatesRelayed;
                             creates SOLANA_PAYABLE_UPDATE_VIA_WORMHOLE and SOLANA_PAYMENT_VIA_CCTP_WORMHOLE
                             jobs; gated on chain.relayEnabled (currently false for solanadevnet);
                             uses circleDomain === undefined check (not !x) so domain=0 is valid
    relay.processor.ts        RelayProcessor: claims one job, resolves artefacts (VAA/CCTP attestation),
                             submits to dest diamond, classifies result; idempotent errors -> DONE;
                             RelayerOnly -> FAILED; InsufficientFinality + pending -> retry;
                             SOLANA_* job types routed to SolanaSubmitter;
                             SolanaSubmitterNotImplemented is a retryable error (Wormhole SDK pending);
                             processOne() returns bool
    relay.module.ts           Provides RelayProcessor; imports AppConfigModule for keypair access
    resolvers/
      wormhole.resolver.ts    fetchVaa(): fetches signed VAA from WormholeScan by (chainId, emitter, seq);
                             returns null when not yet available; mainnet/sandbox URLs by network
      cctp.resolver.ts        fetchCctpAttestation(): polls Circle Iris V2 API; picks message by
                             destinationDomain; returns null when not yet complete; mainnet/sandbox by network
    submitters/
      evm.submitter.ts        submitReceivePayableUpdate{ViaWormhole,ViaCctp} and
                             submitReceiveForeignPaymentViaCctp: simulate then writeContract on dest diamond;
                             decodes custom ABI errors; strips abi from viem errors before logging
      solana.submitter.ts     submitPaymentToSolana() and submitPayableUpdateToSolana(): Solana relay
                             submission stubs; return SOLANA_NOT_IMPLEMENTED until @wormhole-foundation/sdk-
                             solana-core is integrated for the postVAA step; validate inputs eagerly
  worker/
    advisory-lock.ts          acquireAdvisoryLock(): pg_try_advisory_lock on a dedicated connection;
                             retries every 30s; releaseAdvisoryLock(): pg_advisory_unlock + end connection
    loop-runner.ts            runLoop(): starts a named async loop; catches iteration errors without crashing;
                             returns a stop() function that waits for the current iteration to finish
    worker.module.ts          WorkerModule: acquires advisory lock on bootstrap; checks RELAYER_ROLE on each
                             enabled EVM chain; starts per-chain EVM and Solana indexer loops, relay processor
                             loop, gas-balance check (every 5 min, covers both EVM wei and Solana lamports),
                             and heartbeat (every 15 min); stops gracefully
  api/
    api.module.ts             Imports AuthModule; placeholder for public API controllers (phases 3b/4)
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
    current-user.decorator.ts @CurrentUser() param decorator — returns { userId, walletKey, sessionId }
    auth.dto.ts               DTOs: NonceResponse, VerifyRequest/Response, RefreshResponse
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
- **JWT guard is global and deny-by-default.** Every route is protected unless
  decorated with `@Public()`. To protect a route: do nothing (default). To make a
  route public: add `@Public()` to the handler or controller class. The guard
  verifies the Bearer token with `@nestjs/jwt` and does one indexed `Session`
  lookup to confirm the session is not revoked (SPEC.md §9.2).
- **Auth token model:** access token is HS256 JWT with `sub=userId`, `wlt=walletKey`,
  `sid=sessionId`, TTL from `ACCESS_TOKEN_TTL`. Refresh token is 32 random bytes as
  base64url; only its sha256 is stored in `Session.refreshTokenHash`. Cookie name:
  `cb_refresh`, path `/auth`, HttpOnly, SameSite=Lax.
- **Reuse detection:** presenting an already-rotated refresh token signals theft;
  the session is revoked immediately and the request rejected with 401.
- **SIWE:** uses viem's `parseSiweMessage` + `publicClient.verifyMessage` which
  handles EOA, ERC-1271 and ERC-6492 wallets. Only chain IDs in the EVM registry
  are accepted.
- **SIWS:** custom parser in `siws-parser.ts` + tweetnacl ed25519 verify. Signature
  accepted as base58 (Solana wallet-standard) or base64.
- **Solana indexing uses PDAs, not contract calls.** The indexer reads the Stats
  PDA for the activity count, then fetches each ActivityRecord PDA by global index.
  Account data is decoded with `BorshAccountsCoder` from the Chainbills IDL.
  The activity-id is `"<cbChainId>-<globalIndex>"` (not a public key) because
  the Solana program does not expose a native activity-id field.
- **Solana relay is disabled by default (`relayEnabled: false`).** The Solana
  program uses CCTP V1 + Wormhole for payments while the EVM diamond uses CCTP V2.
  The relay code is fully ported and tested but gated by `relayEnabled` in the
  chain registry. The relay trigger detector is only called when `relayEnabled`
  is true. When enabled, the Solana submitter returns `SOLANA_NOT_IMPLEMENTED`
  (a retryable error) until @wormhole-foundation/sdk-solana-core is integrated
  for the postVAA step.
- **`circleDomain === undefined` not `!circleDomain`.** Domain 0 is a valid
  Circle CCTP domain (Ethereum Sepolia). All circleDomain presence checks use
  `=== undefined` guards, never falsy `!x` checks.
- **Solana payer address in `PayablePayment`:** `payer` is stored as `[u8; 32]`
  on the Solana program. For cross-chain payments the payer's chain determines
  encoding: Solana payers use base58 (all 32 bytes); EVM payers use the last
  20 bytes as lowercase hex. `normalisePayerBytes32` from `payer-normalise.ts`
  handles both cases.
- **Tooling is Node.js 24 + pnpm + Vitest.** Never use npm/yarn or commit a
  `package-lock.json`. Dependency install scripts run only when approved in
  `pnpm-workspace.yaml#allowBuilds`. Vitest uses SWC (`unplugin-swc`)
  because esbuild drops the decorator metadata Nest's DI needs.
- **Advisory lock guards single-worker invariant.** `pg_try_advisory_lock(CHAINBILLS_WORKER_LOCK)` is
  taken on a dedicated pg connection in `WorkerModule.onApplicationBootstrap`. Indexer and relay loops
  start only after the lock is held. A second process pointed at the same DB sees `false` from
  `pg_try_advisory_lock` and stays idle, retrying every 30 s.
- **Relay jobs deduplicate on (type, txHash, destChainId).** `createJob` uses `createMany` with
  `skipDuplicates: true`. The `txHash` for PAYABLE_UPDATE_VIA_CCTP jobs has the dest cbChainId
  appended to handle multiple `SentPayableUpdateViaCctp` events in one tx.
- **relayScanBlock advances after each 9000-block chunk**, not after the full scan, so a crash
  mid-scan resumes cleanly from the last safe block.
- **Artefacts (VAA, CCTP message, attestation) are persisted on the job** as soon as they are
  resolved so a retry never re-fetches them from the external API.
- **Idempotent errors mark jobs DONE, not retried.** `StalePayableUpdateNonce`,
  `WormholeMessageAlreadyConsumed`, `CctpBurnNonceAlreadyConsumed`, `CctpDataNonceAlreadyConsumed`,
  `PaymentNonceAlreadyConsumed` mean the message was already applied — another delivery path won.
- **RelayerOnly errors mark jobs FAILED immediately** with a clear log. The operator must grant
  `RELAYER_ROLE` on the destination diamond before relay can proceed.
- **Outbox rows are written inside the same Prisma transaction** as the entity upserts that trigger
  them, so a crash between entity write and outbox write never leaves orphaned notifications or
  missing notifications.
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
