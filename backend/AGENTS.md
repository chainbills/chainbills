# Chainbills Backend v2

NestJS + Prisma + PostgreSQL service. Read [`docs/SPEC.md`](docs/SPEC.md) (source of truth for behaviour) and [`docs/WORKER_RULES.md`](docs/WORKER_RULES.md) (contributor rules) before changing anything here. The module map and quick start are in the README.

## Invariants

- **`process.env` only inside `src/config/`.** Everything else reads `AppConfigService.env`. Prisma's own `env()` calls in `schema.prisma` are the sole additional exception.
- **Diamond-only, no legacy ABIs.** The backend uses only `chainbillsAbi` (the ERC-2535 diamond ABI). The old `mainAbi` / `gettersAbi` are gone. The ABI sync test fails if the copy drifts from `evm/abi/chainbills.json`.
- **RPC URLs are never a mutated global.** `chains/registry.ts` holds no `rpcUrl` field; `ChainsService` joins the static registry with `AppConfigService`'s RPC URLs once at construction, and the client factories in `chains/clients.ts` take a URL as an explicit argument.
- **`ENABLED_CHAINS` gate.** A chain cannot run until it is listed in `ENABLED_CHAINS` and its `diamondAddress` (EVM) or `programId` (Solana) is non-null in the registry. Config validation rejects all problems at once, never silently.
- **Networks never mix.** `sameNetwork(a, b)` must be true before creating a relay job between two chains. Mainnet, testnet, and local chains are fully isolated from each other's relay paths.
- **Role gating happens at module-decoration time, not through DI.** `app.module.ts` calls `loadEnv()` to decide whether to include `WorkerModule` / `ApiModule`, because Nest's module graph is fixed once `@Module({ imports: [...] })` is evaluated. An injected `ConfigService` is too late for that decision.
- **A wallet key is `"evm:0x<lowercase>"` or `"solana:<base58>"`.** Built and parsed only via `chains/wallet-key.ts`; one EVM address is the same wallet on every EVM chain, Solana addresses are namespaced separately.
- **Token amounts are raw integer strings end-to-end** (`Decimal @db.Decimal(78, 0)` in Postgres, `string` in TypeScript). Never a JS `number`. `common/amount/format-amount.ts` does raw-string -> decimal-string formatting with no floating point.
- **Global modules still need an explicit `imports` edge to consume each other's providers.** `@Global()` only controls who can inject from a module; a global module that depends on another global module's provider must still import it explicitly.
- **Global exception filter never leaks internals.** Anything that is not a Nest `HttpException` becomes a bare `500 Internal Server Error` to the client; the real error is logged server-side only.
- **JWT guard is global and deny-by-default.** Every route is protected unless decorated with `@Public()`. To protect a route: do nothing. To make a route public: add `@Public()`. The guard verifies the Bearer token and does one indexed `Session` lookup to confirm the session is not revoked.
- **Auth token model:** access token is HS256 JWT with `sub=userId`, `wlt=walletKey`, `sid=sessionId`, TTL from `ACCESS_TOKEN_TTL`. Refresh token is 32 random bytes as base64url; only its sha256 is stored in `Session.refreshTokenHash`. Cookie name: `cb_refresh`, path `/auth`, HttpOnly, SameSite=Lax.
- **Reuse detection:** presenting an already-rotated refresh token signals theft; the session is revoked immediately and the request rejected with 401.
- **SIWE:** uses viem's `parseSiweMessage` + `publicClient.verifyMessage`, which handles EOA, ERC-1271, and ERC-6492 wallets. Only chain IDs in the EVM registry are accepted.
- **SIWS:** custom parser in `siws-parser.ts` + tweetnacl ed25519 verify. Signature accepted as base58 (Solana wallet-standard) or base64.
- **Tooling is Node.js 24 + pnpm + Vitest.** Never use npm/yarn or commit a `package-lock.json`. Dependency install scripts run only when approved in `pnpm-workspace.yaml#allowBuilds`. Vitest uses SWC (`unplugin-swc`) because esbuild drops the decorator metadata Nest's DI needs.
- **Advisory lock guards the single-worker invariant.** `pg_try_advisory_lock(CHAINBILLS_WORKER_LOCK)` is taken on a dedicated pg connection in `WorkerModule.onApplicationBootstrap`. A second process pointed at the same DB sees `false` and stays idle, retrying every 30s.
- **Relay jobs deduplicate on (type, txHash, destChainId).** `createJob` uses `createMany` with `skipDuplicates: true`. The `txHash` for `PAYABLE_UPDATE_VIA_CCTP` jobs has the dest cbChainId appended to handle multiple `SentPayableUpdateViaCctp` events in one tx.
- **`relayScanBlock` advances after each 9000-block chunk**, not after the full scan, so a crash mid-scan resumes cleanly from the last safe block.
- **Artefacts (VAA, CCTP message, attestation) are persisted on the job** as soon as they are resolved so a retry never re-fetches from the external API.
- **Idempotent errors mark jobs DONE, not retried.** `StalePayableUpdateNonce`, `WormholeMessageAlreadyConsumed`, `CctpBurnNonceAlreadyConsumed`, `CctpDataNonceAlreadyConsumed`, `PaymentNonceAlreadyConsumed` mean the message was already applied.
- **RelayerOnly errors mark jobs FAILED immediately** with a clear log. The operator must grant `RELAYER_ROLE` on the destination diamond before relay can proceed.
- **Outbox rows are written inside the same Prisma transaction** as the entity upserts that trigger them, so a crash between entity write and outbox write never leaves orphaned or missing notifications.
- **Coverage thresholds are enforced** in `vitest.config.ts` (lines/functions/statements >= 90%, branches >= 85%). New code ships with tests that keep it there; thresholds are never lowered and exclusions are never widened.
- **Schema changes add a new migration.** Do not rewrite existing migrations.

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

## Docker

```bash
docker build -t chainbills-backend .
docker compose up -d postgres            # Postgres only, for local pnpm start:dev
docker compose up -d                     # Postgres + app
docker compose --profile proxy up -d    # + Caddy (TLS termination for a VPS)
```
