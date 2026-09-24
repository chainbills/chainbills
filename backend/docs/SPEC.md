# Chainbills Backend v2 — Specification

This document is the single source of truth for `backend/`: a NestJS + Prisma +
PostgreSQL service that indexes Chainbills contracts on every supported chain,
relays cross-chain messages, authenticates wallets, sends email notifications
and serves a public HTTP API.

Every phase task in [`phases/`](./phases) implements a slice of this spec. When
a phase file and this spec disagree, this spec wins. When this spec is silent,
follow the existing behaviour of `relayer/src/` for chain logic and the
conventions in [`WORKER_RULES.md`](./WORKER_RULES.md) for everything else.

---

## 1. Scope

### In scope

- Chain indexing into Postgres for every enabled chain in the registry: EVM
  chains through the Chainbills ERC-2535 diamond (§6.1), Solana through the
  existing program.
- Cross-chain relaying (Wormhole VAAs, Circle CCTP attestations), with the
  same semantics as `relayer/src/`.
- Wallet sign-in: SIWE (EIP-4361) for EVM and SIWS (Sign-In With Solana).
- Own session tokens (JWT access token + rotating refresh token). No Firebase.
- User settings: email address verified by one-time code, notification
  preferences.
- Email notifications through a transactional outbox, sent via Zoho ZeptoMail.
- Public read API for data the on-chain getters cannot answer (cross-chain
  lists, per-host / per-payer history, aggregates) plus payable descriptions.
- Auto-generated OpenAPI documentation.
- Portable Docker image; runs on Cloud Run + Neon today and on any VPS
  (docker compose) later with no code change.

### Out of scope

- Any change in `frontend/`, `relayer/`, `server/`, `evm/`, `solana/`.
  The legacy `relayer/` and `server/` stay in the repository untouched.
- Browser / push notifications (no FCM, no Web Push).
- Firestore or any Firebase dependency.
- Indexing the legacy single-proxy EVM contracts (`evm/legacy/`); `relayer/`
  keeps serving them until they are retired.
- Data migration from Firestore. Postgres starts empty; indexing starts from
  each chain's configured deployment block / activity 0.
- Linking several wallets to one user (schema allows it later; not built now).
- Recurring payments / subscriptions.

---

## 2. Architecture

```
                         ┌────────────────────────── backend (one image) ─────────────────────────┐
                         │                                                                        │
  frontend ── HTTPS ───▶ │  api layer (ROLE=api|all)                                              │
  (chainbills.xyz)       │    AuthModule   UsersModule   PublicApiModule   HealthModule   Swagger │
                         │          │            │               │                                │
                         │          ▼            ▼               ▼                                │
                         │    ┌──────────────── PrismaService ───────────────┐                    │
                         │    │                 PostgreSQL                   │                    │
                         │    └──────────────────────────────────────────────┘                    │
                         │          ▲            ▲               ▲                                │
                         │  worker layer (ROLE=worker|all) — guarded by a Postgres advisory lock  │
                         │    EvmIndexer    SolanaIndexer    RelayProcessor    OutboxProcessor    │
                         │        │               │               │                  │            │
                         └────────┼───────────────┼───────────────┼──────────────────┼────────────┘
                                  ▼               ▼               ▼                  ▼
                              EVM RPCs      Solana RPC     Wormhole API /       ZeptoMail API
                                                           Circle Iris API
```

### 2.1 Roles

The same image runs in one of three roles, chosen by the `ROLE` env var:

| ROLE     | HTTP API | Indexers + relay + outbox | Needs private keys |
| -------- | -------- | ------------------------- | ------------------ |
| `all`    | yes      | yes                       | yes                |
| `api`    | yes      | no                        | no                 |
| `worker` | health only | yes                    | yes                |

Today we deploy one Cloud Run service with `ROLE=all`, `min-instances=1`,
`max-instances=1`, CPU always allocated. Splitting later into an `api` service
(scales freely, holds no keys) and a `worker` service (exactly one instance) is
a deployment change only.

Implementation: worker-side providers are registered by a `WorkerModule` that
`AppModule` imports only when `ROLE` is `worker` or `all`. HTTP controllers
other than `HealthController` are registered only when `ROLE` is `api` or `all`.

### 2.2 Single-worker guarantee

Relaying must be strictly sequential per relayer wallet (nonce safety). On
startup the worker layer takes `pg_try_advisory_lock(<constant>)` on a
dedicated connection. If it does not get the lock it logs a warning, stays
idle and retries every 30 s. This makes an accidental second worker harmless
on any host (Cloud Run scale-out, a duplicated VPS container, a local dev
process pointed at the production DB).

### 2.3 Loops

All background work runs as long-lived async loops started in
`onApplicationBootstrap` and stopped in `onApplicationShutdown` (graceful
SIGTERM: finish the current iteration, then exit). A failure in one iteration
is logged and retried next tick; it never crashes the process. One loop per
chain indexer, one relay processor, one outbox processor, one gas-balance
checker (every 5 min), one heartbeat (every 15 min).

---

## 3. Tech stack

| Concern         | Choice                                                                 |
| --------------- | ---------------------------------------------------------------------- |
| Runtime         | Node.js 24 LTS (`.nvmrc`), TypeScript `strict: true`                   |
| Framework       | NestJS (latest stable major) on the Express adapter                    |
| ORM / DB        | Prisma (latest stable major) + PostgreSQL 16                           |
| Validation      | `zod` for env; `class-validator` + `class-transformer` for request DTOs |
| API docs        | `@nestjs/swagger` (OpenAPI 3) at `/docs` and `/docs-json`              |
| Logging         | `nestjs-pino` (JSON to stdout, pretty in development)                  |
| Rate limiting   | `@nestjs/throttler`                                                     |
| Auth            | `@nestjs/jwt`; `viem` (SIWE); `tweetnacl` + `bs58` (SIWS)               |
| EVM             | `viem`                                                                  |
| Solana          | `@solana/web3.js` v1, `@coral-xyz/anchor` 0.32.x, `@solana/spl-token`   |
| Email           | ZeptoMail HTTP API via `fetch` behind a `MailProvider` interface        |
| Tests           | Vitest (SWC transform for decorator metadata) + `@vitest/coverage-v8`; `supertest` for e2e; Postgres via docker compose |
| Package manager | pnpm via Corepack (`packageManager` field), exact versions pinned, `pnpm-lock.yaml` committed; install scripts allowed only via `pnpm-workspace.yaml#allowBuilds` |

Use the versions current at implementation time; follow each library's
official docs for its current API (notably Prisma's generator/config format).

---

## 4. Directory layout

```
backend/
  CLAUDE.md                 Module map, invariants, commands (kept current by every phase)
  README.md                 Human quick start, deploy guide
  .env.example              Every env var, commented
  Dockerfile                Multi-stage build; runs migrations then the app
  docker-compose.yml        app + postgres (+ optional caddy profile) for local / VPS
  prisma/
    schema.prisma
    migrations/
  docs/
    SPEC.md                 This file
    WORKER_RULES.md         Rules for every contributor / agent
    ENV.md                  Env var reference table
    phases/                 One task file per phase
  src/
    main.ts                 Bootstrap: pino, cookie-parser, CORS, validation pipe, swagger, shutdown hooks
    app.module.ts           Root module; conditional imports by ROLE
    config/                 env.schema.ts (zod), config.module.ts, typed accessor
    prisma/                 PrismaModule, PrismaService
    common/                 Decorators, guards, filters, DTO helpers, pagination, amount formatting
    chains/                 Chain + token registry, ABIs, Solana IDL, viem / web3 client factories
    indexer/
      evm/                  EVM activity indexer + relay-trigger detection
      solana/               Solana activity indexer + relay-trigger detection
    relay/                  Job store, processor, resolvers (wormhole, cctp), submitters (evm, solana)
    worker/                 WorkerModule, advisory lock, gas balance + heartbeat loops
    auth/                   Nonce, SIWE / SIWS verification, sessions, JWT guard
    users/                  /me endpoints, email verification, preferences
    notifications/          Outbox writer + processor, MailProvider, ZeptoMail, templates, unsubscribe
    api/                    Public read controllers (payables, payments, withdrawals, stats, chains)
    health/                 /health
  test/                     e2e tests
```

---

## 5. Configuration

### 5.1 Rules

1. `src/config/env.schema.ts` holds one `zod` schema that is the single source
   of truth for every env var: type, format, default, and which roles require it.
2. `ConfigModule.forRoot({ validate })` runs the schema at boot. On failure the
   process prints **every** problem (name + reason, never the value) and exits
   with code 1 before any module initialises.
3. Role-conditional requirements use `superRefine`: e.g. `RELAYER_PRIVATE_KEY`
   is required when `ROLE` is `worker` or `all`, optional for `api`.
4. The parsed, typed object is exposed through `ConfigService<Env, true>`
   (or a thin `AppConfig` wrapper). **No code outside `src/config/` reads
   `process.env`.** Prisma's own `env()` in `schema.prisma` is the only exception.
5. Secrets are never logged. The pino `redact` list covers auth headers,
   cookies and every secret-bearing key.
6. `.env.example` lists every variable with a comment; `docs/ENV.md` has the
   full table. Both are updated in the same change as any schema change.
7. Unit tests cover the schema: valid minimal config per role, each required
   var missing, malformed values (bad URL, bad hex key, bad keypair JSON,
   bad duration).

### 5.2 Variables

"every" = required whatever `ROLE` is; otherwise the listed roles.

| Name                        | Roles requiring it | Default                     | Format / notes |
| --------------------------- | ------------------ | --------------------------- | -------------- |
| `NODE_ENV`                  | –                  | `production`                | `development` \| `test` \| `production` |
| `ROLE`                      | –                  | `all`                       | `all` \| `api` \| `worker` |
| `PORT`                      | –                  | `8080`                      | integer |
| `LOG_LEVEL`                 | –                  | `info`                      | pino level |
| `APP_URL`                   | every                | –                           | `https://chainbills.xyz`; SIWE/SIWS domain + URI, email links |
| `PUBLIC_API_URL`            | every                | –                           | `https://api.chainbills.xyz`; OpenAPI server URL, unsubscribe links |
| `CORS_ORIGINS`              | api, all           | –                           | comma-separated origins |
| `DATABASE_URL`              | every                | –                           | Postgres URL (Neon: pooled URL) |
| `DIRECT_URL`                | every                | = `DATABASE_URL`            | Direct (non-pooled) URL for migrations |
| `JWT_ACCESS_SECRET`         | api, all           | –                           | ≥ 32 chars |
| `ACCESS_TOKEN_TTL`          | –                  | `15m`                       | duration (`30s`, `15m`, `12h`, `30d`) |
| `REFRESH_TOKEN_TTL`         | –                  | `30d`                       | duration |
| `COOKIE_DOMAIN`             | –                  | unset (host-only cookie)    | only if the API host differs from the cookie host |
| `COOKIE_SECURE`             | –                  | `true`                      | `false` only for local http |
| `SIGN_IN_MESSAGE_TTL`       | –                  | `10m`                       | max age of a SIWE/SIWS `Issued At` |
| `ENABLED_CHAINS`            | every                | –                           | comma-separated registry slugs, e.g. `arcmainnet` or `anvil,solanadevnet` (§6.2) |
| `RPC_<SLUG>`                | every enabled chain  | –                           | https URL per enabled chain: `RPC_ARCMAINNET`, `RPC_ANVIL`, `RPC_SOLANADEVNET` |
| `RELAYER_PRIVATE_KEY`       | worker, all        | –                           | `0x` + 64 hex |
| `SOLANA_RELAYER_KEYPAIR`    | worker, all        | –                           | JSON array of 64 integers 0–255 |
| `POLL_INTERVAL_MS`          | –                  | per-chain registry value    | global override, integer ms |
| `MAIL_PROVIDER`             | –                  | `console`                   | `zeptomail` \| `console` (logs emails, dev only) |
| `ZEPTOMAIL_API_URL`         | if `zeptomail`     | `https://api.zeptomail.com` | region host (`.eu`, `.in`, `.com.au`, …) matching the Zoho account |
| `ZEPTOMAIL_API_KEY`         | if `zeptomail`     | –                           | ZeptoMail "Send Mail" token |
| `MAIL_FROM_ADDRESS`         | if `zeptomail`     | –                           | e.g. `notify@notify.chainbills.xyz` |
| `MAIL_FROM_NAME`            | –                  | `Chainbills`                | |
| `OTP_HMAC_SECRET`           | api, all           | –                           | ≥ 32 chars |
| `UNSUBSCRIBE_SECRET`        | every                | –                           | ≥ 32 chars |
| `EMAIL_MAX_EVENT_AGE`       | –                  | `1h`                        | on-chain events older than this never produce emails |
| `THROTTLE_TTL`              | –                  | `60s`                       | throttler window |
| `THROTTLE_LIMIT`            | –                  | `120`                       | requests per window per IP |

RPC URLs of every enabled chain are required for every role because the API verifies smart-contract
wallet signatures (ERC-1271 / ERC-6492) and payable ownership on-chain.

Contract addresses, program IDs, deployment blocks and token addresses are
**not** env vars: they live in the chain registry in code (§6), reviewed and
versioned with the code that depends on them.

---

## 6. Chains, contracts and tokens

`src/chains/registry.ts` is the single place that lists chains, contract
addresses, deployment blocks and tokens.

### 6.1 EVM contract: the Chainbills diamond

On every EVM chain Chainbills is **one ERC-2535 diamond** (`evm/`). All
writes, views and events go through the diamond address; there is no separate
getters contract. The same diamond address is used on every chain deployed with
the same `CB_SALT` and `OWNER` (CREATE2). `evm/CLAUDE.md` and `evm/README.md`
describe the contracts; `evm/src/types/CbTypes.sol` defines every struct and
enum the backend decodes.

- **ABI source of truth:** `evm/abi/chainbills.ts` (`chainbillsAbi`, generated
  by `evm/script/export-abi.mjs` from `IChainbills`). The backend keeps a
  verbatim copy at `src/chains/abi/chainbills.ts` and a unit test that fails
  when the copy differs from `../evm/abi/chainbills.json` (skipped when the
  `evm/` directory is absent, e.g. inside the Docker build). The legacy
  `mainAbi` / `gettersAbi` (single-proxy contracts in `evm/legacy/`) are not
  used by the backend.
- **Legacy deployments are not indexed.** The old single-proxy contracts on
  Sepolia, Arc Testnet and MegaETH (`evm/legacy/`, `relayer/`) stay served by
  `relayer/` until retired. The backend only talks to diamonds.
- **Relayer permissions:** when the diamond has relaying restricted
  (`setRelayerRestricted(true)`), the relayer EVM address must hold
  `RELAYER_ROLE` on every destination diamond. The worker logs a warning at
  startup (via `hasRole(RELAYER_ROLE, relayer)`) for any enabled chain where it
  lacks the role while relaying is restricted.

### 6.2 Chain registry

Each EVM entry: `slug`, `displayName`, `caip2`, `cbChainId`, `network`
(`mainnet` | `testnet` | `local`), viem chain object, `diamondAddress`,
`deploymentBlock`, `wormholeChainId?`, `circleDomain?`, `pollIntervalMs`,
`minGasBalance`. Solana entries keep the fields of
`relayer/src/chains/solana-devnet.ts`.

| Slug | CAIP-2 | cbChainId | Network | Wormhole | CCTP | Status |
| --- | --- | --- | --- | --- | --- | --- |
| `arcmainnet` | `eip155:5042` | `0xb8aed675f862d651b4a8c85f23a045faa0faaa1d162e6eb15d732231df3dc250` | mainnet | not yet (see `evm/DEPLOYED.md`) | V2, domain 26 | diamond address + deployment block filled in after deploy (`evm/deploys/arcmainnet.json`) |
| `anvil` | `eip155:31337` | `keccak256("eip155:31337")` | local | mock | mock | local development against `evm/script/DeployLocalStack.s.sol` |
| `solanadevnet` | `solana:EtWTRABZaYq6iMfeYKouRu166VU2xqa1` | `0x318e886b7d5a2e6f89c50cd1cdc3614e5f66532f673b5f14448b9b58c12e0e6e` | testnet | id 1 | V1 program | indexing only, see §8.3 |

Rules:

- **Chain key.** Database columns referencing a chain store the `cbChainId`.
  The slug is for logs, config and API output only.
- **Enabled chains.** `ENABLED_CHAINS` (comma-separated slugs, §5.2) selects
  which registry entries an instance runs; an entry without a diamond address
  (or program id) cannot be enabled and fails config validation.
- **Networks never mix.** Relay jobs are created only between chains of the
  same `network`. A mainnet chain never relays to or from a testnet or local
  chain (Circle and Wormhole are separate per network anyway).
- **RPC URLs** come from config (`RPC_<SLUG>` per enabled chain), never
  mutated globals.

### 6.3 Tokens

- The diamond is the source of truth for **which** tokens are supported
  (`getSupportedTokens`, `getTokenDetails`). The native token is the diamond
  address (`nativeToken()`).
- **Symbol and decimals** come from the code registry per chain (native:
  chain's native symbol and 18 decimals, or 6 for Arc where USDC is the native
  gas token as exposed by its ERC-20 interface — confirm against
  `evm/DEPLOYED.md` when filled in). A token seen on chain but missing from the
  registry is resolved once via ERC-20 `symbol()` / `decimals()` and cached in
  memory; failure logs an error and formats with 0 decimals.
- Solana devnet USDC (6 decimals) stays registered.
- The Solana IDL is copied from `relayer/src/solana/chainbills-idl.json`
  (unchanged program).

---

## 7. Data model

Conventions:

- `bytes32` ids and hashes: lowercase `0x`-prefixed hex `String`.
- EVM addresses: lowercase hex `String` in the DB; API output uses checksum
  format (`getAddress`). Solana addresses: base58 `String`, case preserved.
- Token amounts: `Decimal @db.Decimal(78, 0)` holding the raw integer amount.
  Never JavaScript `number`.
- On-chain timestamps: `DateTime` (converted from unix seconds).
- Wallet key: `"evm:0x<lowercase>"` or `"solana:<base58>"`. One EVM address is
  the same wallet on every EVM chain.
- Every model has a doc comment (`///`) on the model and every non-obvious field.

The schema below is normative for names, types, keys and relations. The
initial migration predates the diamond alignment (phase 1b); phase 1b adds a
second migration that brings the database to exactly this schema. The
implementer adds `@map`/`@@map` to snake_case table and column names and any
extra indexes the queries in §12 need.

```prisma
// ── Chain indexing ────────────────────────────────────────────────────────────

/// Indexing + relay cursors per chain. Counters are high-watermarks of the
/// on-chain stats counters already processed.
model ChainCursor {
  chainId                   String   @id              // cbChainId
  activitiesIndexed         BigInt   @default(0)
  relayScanBlock            BigInt   @default(0)      // EVM: last block scanned for relay-trigger events (§8.2 step 4)
  wormholeRelayed           BigInt   @default(0)      // Solana only: published Wormhole messages handled
  cctpPaymentsRelayed       BigInt   @default(0)      // Solana only
  cctpPayableUpdatesRelayed BigInt   @default(0)      // Solana only
  lastTickAt                DateTime?
  updatedAt                 DateTime @updatedAt
}

/// A payable on its home chain.
model Payable {
  id                String   @id                       // bytes32 payable id
  chainId           String                             // home chain cbChainId
  host              String                             // EVM lowercase hex or Solana base58
  hostWalletKey     String                             // "evm:0x…" | "solana:…"
  chainCount        BigInt
  hostCount         BigInt
  paymentsCount     BigInt   @default(0)
  withdrawalsCount  BigInt   @default(0)
  isClosed          Boolean  @default(false)
  isAutoWithdraw    Boolean  @default(false)
  createdAt         DateTime                           // on-chain creation time
  indexedAt         DateTime @default(now())
  updatedAt         DateTime @updatedAt
  allowedTokens     PayableAllowedToken[]
  balances          PayableBalance[]
  payments          PayablePayment[]
  withdrawals       Withdrawal[]
  @@index([hostWalletKey, createdAt])
  @@index([chainId, createdAt])
}

model PayableAllowedToken {
  payableId String
  token     String                                     // token address / mint
  amount    Decimal @db.Decimal(78, 0)                  // 0 = any amount
  payable   Payable @relation(fields: [payableId], references: [id], onDelete: Cascade)
  @@id([payableId, token])
}

model PayableBalance {
  payableId String
  token     String
  amount    Decimal @db.Decimal(78, 0)
  payable   Payable @relation(fields: [payableId], references: [id], onDelete: Cascade)
  @@id([payableId, token])
}

/// Host-written description. Separate from Payable so it can be saved before
/// the indexer has seen the payable, without racing indexer upserts.
model PayableDescription {
  payableId     String   @id
  description   String
  updatedByKey  String                                 // wallet key that wrote it
  updatedAt     DateTime @updatedAt
}

/// Payer's receipt, on the payer's chain.
model UserPayment {
  id              String   @id
  chainId         String                               // payer's chain
  payer           String
  payerWalletKey  String
  payerCount      BigInt
  chainCount      BigInt
  payableId       String                               // may live on another chain: no FK
  payableChainId  String
  token           String
  requestedAmount Decimal  @db.Decimal(78, 0)          // price matched against the payable's allowed amounts
  amount          Decimal  @db.Decimal(78, 0)          // total debited from the payer (incl. transfer-tax buffer / CCTP fee allowance)
  timestamp       DateTime
  indexedAt       DateTime @default(now())
  @@index([payerWalletKey, timestamp])
  @@index([payableId])
}

/// Payable's receipt, on the payable's chain.
model PayablePayment {
  id              String   @id
  chainId         String                               // payable's chain
  payableId       String
  payable         Payable  @relation(fields: [payableId], references: [id])
  payer           String                               // denormalised (EVM hex / Solana base58)
  payerChainId    String
  payerWalletKey  String
  payerPaymentId  String                               // UserPayment.id on the payer's chain
  chainCount      BigInt
  localChainCount BigInt
  payableCount    BigInt
  token           String
  requestedAmount Decimal  @db.Decimal(78, 0)          // price of the payment
  amount          Decimal  @db.Decimal(78, 0)          // amount actually credited to the payable
  timestamp       DateTime
  indexedAt       DateTime @default(now())
  @@index([payableId, timestamp])
  @@index([payerPaymentId])
}

model Withdrawal {
  id            String   @id
  chainId       String
  payableId     String
  payable       Payable  @relation(fields: [payableId], references: [id])
  host          String
  hostWalletKey String
  chainCount    BigInt
  hostCount     BigInt
  payableCount  BigInt
  token         String
  amount        Decimal  @db.Decimal(78, 0)            // deducted from the payable balance
  fee           Decimal  @db.Decimal(78, 0)            // sent to the fee collector; host receives amount - fee
  timestamp     DateTime
  indexedAt     DateTime @default(now())
  @@index([payableId, timestamp])
  @@index([hostWalletKey, timestamp])
}

enum ActivityType {
  INITIALIZED_USER
  CREATED_PAYABLE
  USER_PAID
  PAYABLE_RECEIVED
  WITHDREW
  CLOSED_PAYABLE
  REOPENED_PAYABLE
  UPDATED_PAYABLE_ALLOWED_TOKENS_AND_AMOUNTS
  UPDATED_PAYABLE_AUTO_WITHDRAW_STATUS
}

/// Raw on-chain activity log, one row per ActivityRecord.
model Activity {
  id            String       @id
  chainId       String
  chainCount    BigInt
  userCount     BigInt
  payableCount  BigInt
  entity        String                                 // id of payable / payment / withdrawal
  type          ActivityType
  timestamp     DateTime
  indexedAt     DateTime     @default(now())
  @@unique([chainId, chainCount])
  @@index([entity])
}

// ── Relay jobs ────────────────────────────────────────────────────────────────

enum RelayJobType {
  PAYABLE_UPDATE_VIA_WORMHOLE
  PAYABLE_UPDATE_VIA_CCTP
  PAYMENT_VIA_CCTP
  ADMIN_SYNC
  SOLANA_PAYABLE_UPDATE_VIA_WORMHOLE
  SOLANA_PAYMENT_VIA_CCTP_WORMHOLE
}

enum RelayJobStatus {
  PENDING
  PROCESSING
  DONE
  FAILED
}

model RelayJob {
  id                  String         @id @default(cuid())
  type                RelayJobType
  status              RelayJobStatus @default(PENDING)
  sourceChainId       String
  destChainId         String
  txHash              String                           // or synthetic "wormhole-seq-<chain>-<seq>"
  blockNumber         BigInt?
  eventData           Json
  attempts            Int            @default(0)
  notBefore           DateTime       @default(now())   // earliest next attempt (min-age + backoff)
  lastError           String?
  vaa                 String?
  cctpMessage         String?
  cctpAttestation     String?
  createdAt           DateTime       @default(now())
  lastAttemptAt       DateTime?
  completedAt         DateTime?
  @@unique([type, txHash, destChainId])
  @@index([status, notBefore])
}

// ── Users and auth ────────────────────────────────────────────────────────────

model User {
  id              String    @id @default(cuid())
  email           String?                              // normalised (trimmed, lowercased); set only after verification
  emailVerifiedAt DateTime?
  createdAt       DateTime  @default(now())
  updatedAt       DateTime  @updatedAt
  wallets         Wallet[]
  sessions        Session[]
  preferences     NotificationPreference[]
  verifications   EmailVerification[]
}

enum WalletNamespace {
  EVM
  SOLANA
}

model Wallet {
  key          String          @id                     // "evm:0x…" | "solana:…"
  namespace    WalletNamespace
  address      String
  userId       String
  user         User            @relation(fields: [userId], references: [id], onDelete: Cascade)
  createdAt    DateTime        @default(now())
  lastSignInAt DateTime?
  @@index([userId])
}

/// Single-use sign-in nonce.
model AuthNonce {
  nonce     String    @id
  expiresAt DateTime
  usedAt    DateTime?
  createdAt DateTime  @default(now())
}

model Session {
  id               String    @id @default(cuid())
  userId           String
  user             User      @relation(fields: [userId], references: [id], onDelete: Cascade)
  walletKey        String
  refreshTokenHash String    @unique                    // sha256 of the current refresh token
  expiresAt        DateTime
  revokedAt        DateTime?
  userAgent        String?
  ip               String?
  createdAt        DateTime  @default(now())
  lastUsedAt       DateTime  @default(now())
  @@index([userId])
}

model EmailVerification {
  id         String    @id @default(cuid())
  userId     String
  user       User      @relation(fields: [userId], references: [id], onDelete: Cascade)
  email      String                                    // normalised target address
  codeHash   String                                    // HMAC-SHA256, never the code
  attempts   Int       @default(0)
  expiresAt  DateTime
  consumedAt DateTime?
  createdAt  DateTime  @default(now())
  @@index([userId, createdAt])
  @@index([email, createdAt])
}

// ── Notifications ─────────────────────────────────────────────────────────────

enum NotificationType {
  PAYABLE_CREATED
  PAYMENT_RECEIVED
  PAYMENT_RECEIPT
  WITHDRAWAL_COMPLETED
}

/// Absent row = enabled (default on).
model NotificationPreference {
  userId  String
  type    NotificationType
  email   Boolean  @default(true)
  user    User     @relation(fields: [userId], references: [id], onDelete: Cascade)
  @@id([userId, type])
}

enum OutboxStatus {
  PENDING
  SENDING
  SENT
  FAILED
  SKIPPED
}

model Outbox {
  id                String           @id @default(cuid())
  dedupeKey         String           @unique            // "<TYPE>:<entityId>:<walletKey>"
  type              NotificationType
  walletKey         String                              // recipient; resolved to a user + email at send time
  payload           Json                                // template data (ids, amounts as strings, chain ids)
  status            OutboxStatus     @default(PENDING)
  attempts          Int              @default(0)
  nextAttemptAt     DateTime         @default(now())
  lastError         String?
  providerMessageId String?
  createdAt         DateTime         @default(now())
  sentAt            DateTime?
  @@index([status, nextAttemptAt])
}
```

---

## 8. Indexing and relaying

### 8.1 Principles

- **Behavioural parity.** Relay-trigger detection, VAA / attestation
  resolution and submission are ported from `relayer/src/` with the same
  semantics: sequential processing, max 5 attempts, `StalePayableUpdateNonce`
  → `DONE`, CCTP min-age deferral, 9 000-block `getLogs` chunks, viem error
  `abi` stripping before logging.
- **Cursors in Postgres.** `ChainCursor` replaces `relayerCursors/*`. A cursor
  only advances after the rows for that item are committed.
- **Stop on first failure.** Within a batch, stop at the first item that
  fails and retry from it next tick (existing behaviour), so ordering holds.
- **Idempotent writes.** All indexing writes are `upsert`s keyed by on-chain id.
  Re-processing an item is always safe.
- **Transactions.** Indexing one activity = one `prisma.$transaction` that
  writes the entity rows, the `Activity` row, any `Outbox` rows (§11) and the
  cursor increment together.

### 8.2 EVM indexing — activity-driven

v2 indexes from the diamond's single activity log, so payable state changes
(close, reopen, token / amount changes, auto-withdraw toggles, balance
changes) are captured along with payments and withdrawals.

Per tick for each enabled EVM chain:

1. `getChainStats()` → `activitiesCount` (or `getChainActivityCount()`).
2. If `activitiesCount > cursor.activitiesIndexed`, fetch the next page with
   `getChainActivities(offset, limit)` (ascending; returns `ids` and
   `ActivityRecord` items in one call; page size ≤ 50).
3. For each activity in order, dispatch by `activityType`
   (`evm/src/types/CbTypes.sol` `ActivityType`, same order as before):

| ActivityType | Action |
| --- | --- |
| `InitializedUser` | Store `Activity` only (`entity` is the user). |
| `CreatedPayable` | `getPayableView(id)` (info + allowed tokens + balances in one call) → upsert `Payable` + children. Enqueue `PAYABLE_CREATED` for the host. |
| `UserPaid` | `getUserPayment` → upsert `UserPayment` (with `requestedAmount` and `amount`). Enqueue `PAYMENT_RECEIPT` for the payer. |
| `PayableReceived` | `getPayablePayment` → upsert `PayablePayment` (with `requestedAmount` and `amount`); refresh the payable via `getPayableView`. Enqueue `PAYMENT_RECEIVED` for the host. |
| `Withdrew` | `getWithdrawal` → upsert `Withdrawal` (with `amount` and `fee`); refresh the payable. Enqueue `WITHDRAWAL_COMPLETED` for the host. |
| `ClosedPayable`, `ReopenedPayable`, `UpdatedPayableAllowedTokensAndAmounts`, `UpdatedPayableAutoWithdrawStatus` | Refresh the payable via `getPayableView`. |

Refreshing replaces the payable's `PayableAllowedToken` / `PayableBalance`
rows with the current on-chain values inside the same transaction. Use the
`*Bulk` views (`getPayableViewsBulk`, `getUserPaymentsBulk`, …) when a page
references several entities of one kind.

Payer normalisation for `PayablePayment.payer` (bytes32): an EVM payer is the
last 20 bytes; a Solana payer is the base58 of the 32 bytes. The payer's chain
(`payerChainId`) decides which.

4. **Relay-trigger detection by event logs.** Scan the diamond's logs from
   `cursor.relayScanBlock + 1` to the latest block (9 000-block chunks), then
   advance `relayScanBlock`. Events and the jobs they create (destination
   chains must be enabled, registered on the source diamond, and on the same
   network):

| Event | Job(s) | Destination call |
| --- | --- | --- |
| `PayableUpdateBroadcasted(payableId, nonce, actionType, wormholeSequence, cctpMessagesCount)` with Wormhole active on the source | one `PAYABLE_UPDATE_VIA_WORMHOLE` per destination chain that has Wormhole | fetch the VAA by (source Wormhole chain id, diamond address as 32-byte emitter, `wormholeSequence`) → `receivePayableUpdateViaWormhole(vaa)` |
| `SentPayableUpdateViaCctp(payableId, cbChainId, nonce)` | one `PAYABLE_UPDATE_VIA_CCTP` for `cbChainId` | fetch the CCTP V2 message + attestation for the tx → `receivePayableUpdateViaCctp(message, attestation)` |
| `SentForeignPaymentViaCctp(payableId, payableChainId, userPaymentId, paymentNonce, burnAmount, maxFee, minFinalityThreshold)` | one `PAYMENT_VIA_CCTP` for `payableChainId` | fetch the CCTP V2 burn message + attestation for the tx → `receiveForeignPaymentViaCctp(burnMessage, attestation)` |

   A transaction can emit several `SentPayableUpdateViaCctp` events (one per
   destination); each maps to its own job and its own CCTP message, matched by
   destination domain in the Iris response. Dedupe with the `RelayJob` unique
   key (`createMany` with `skipDuplicates` or catch `P2002`).

   The stats counters (`getWormholeStats`, `getCctpStats`) are logged in the
   heartbeat as a cross-check; they are not used as cursors.

### 8.3 Solana

- **Indexing:** port `relayer/src/solana/*` (indexer, accounts, client) keeping
  its activity-based strategy, mapping each decoded entity into the same tables
  as EVM.
- **Relaying:** the Solana program in `solana/` still uses the previous
  transport (CCTP V1 plus Wormhole for payments). The EVM diamond uses CCTP V2
  with the payment carried as burn hook data, so **EVM ↔ Solana payments are
  not wire-compatible** until the Solana program adopts CCTP V2 hooks. Payable
  payload bytes are unchanged across VMs, but Solana devnet is a testnet and
  the only diamond chain is mainnet, so no Solana relay pair is valid today
  (§6.2 "networks never mix"). Port the Solana relay code (signature scanning,
  `relayer/src/solana/submitter.ts`) behind a registry switch
  `relayEnabled: false` on `solanadevnet`, with tests, so it can be enabled once
  the program and a same-network diamond exist.

### 8.4 Relay processor

Port the processing loop of `relayer/src/jobs/processor.ts` and the resolvers
in `relayer/src/resolvers/`, adapted to the diamond:

- **Wormhole resolver:** Wormholescan VAA by chain id / emitter / sequence
  (mainnet and testnet API hosts by network).
- **CCTP V2 resolver:** Circle Iris `GET /v2/messages/{sourceDomain}?transactionHash={txHash}`
  (`iris-api.circle.com` for mainnet, `iris-api-sandbox.circle.com` for
  testnet); wait for `status: "complete"`, pick the message whose destination
  domain matches the job, store `message` and `attestation` on the job.
- **EVM submitter:** simulate then send the destination call from §8.2 step 4
  on the destination diamond with the relayer wallet; wait for the receipt.
- Pick jobs with `status IN (PENDING, PROCESSING) AND notBefore <= now()`
  ordered by `createdAt`, processed strictly one at a time.
- Idempotent outcomes → `DONE` (the message was already applied by another
  path or an earlier attempt): `StalePayableUpdateNonce`,
  `WormholeMessageAlreadyConsumed`, `CctpBurnNonceAlreadyConsumed`,
  `CctpDataNonceAlreadyConsumed`, `PaymentNonceAlreadyConsumed`.
- `RelayerOnly` → `FAILED` immediately with a clear log (missing `RELAYER_ROLE`).
- `InsufficientFinality` and "attestation pending" are retryable.
- On a retryable failure: `attempts++`, `lastError`, `notBefore = now() + backoff`
  (30 s × 2^attempts, capped at 10 min), status back to `PENDING`.
  After 8 attempts → `FAILED` (CCTP standard finality can take ~15–20 min).
- Fetched artefacts are persisted on the job as soon as they are fetched so a
  retry does not refetch.

### 8.5 Worker housekeeping

Port the gas-balance check (every 5 min, warn below `minGasBalance`) and the
heartbeat log (every 15 min: cursors, diamond stats counters, idle time,
pending / failed job counts) from `relayer/src/index.ts`, plus the startup
`RELAYER_ROLE` check from §6.1.

---


## 9. Authentication

### 9.1 Flow

1. `POST /auth/nonce` → `{ nonce, expiresAt }`. 16+ random bytes, base58 or
   alphanumeric (SIWE requires ≥ 8 alphanumeric chars). Stored in `AuthNonce`,
   5-minute expiry. Throttled per IP.
2. The frontend builds and signs a standard message:
   - **EVM:** EIP-4361 message (`viem/siwe` `createSiweMessage`).
   - **Solana:** Sign-In With Solana message (the wallet-standard `solana:signIn`
     output, or the same text format signed with `signMessage`).
   Both carry `domain` (host of `APP_URL`), `address`, `uri` (`APP_URL`),
   `version: 1`, `chainId`, `nonce`, `issuedAt`, optional `expirationTime`.
3. `POST /auth/verify` with `{ namespace: 'evm' | 'solana', message, signature }`:
   - Parse the message (`viem/siwe` `parseSiweMessage` for EVM; a small tested
     parser for the SIWS text format).
   - Check: domain equals `APP_URL` host; uri equals `APP_URL`; nonce exists,
     unused, unexpired; `issuedAt` within `SIGN_IN_MESSAGE_TTL`; not past
     `expirationTime`; for EVM the `chainId` belongs to a registry EVM chain.
   - Verify the signature:
     - EVM: `verifySiweMessage` / `publicClient.verifyMessage` using the
       message's chain client (supports EOAs, ERC-1271 and ERC-6492).
     - Solana: ed25519 via `tweetnacl.sign.detached.verify` over the UTF-8
       message bytes; signature accepted as base58 or base64.
   - Mark the nonce used in the same transaction that upserts `Wallet` (+ new
     `User` on first sign-in) and creates the `Session`.
   - Respond `{ accessToken, expiresIn, user }` and set the refresh cookie.
4. `POST /auth/refresh` reads the cookie, finds the session by
   `sha256(token)`, rejects if revoked / expired, **rotates** the refresh token
   (new random value, new hash), returns a new access token. Reuse of an
   already-rotated token revokes that session (theft signal).
5. `POST /auth/logout` revokes the current session and clears the cookie.
   `POST /auth/logout-all` revokes every session of the user.

### 9.2 Tokens

- Access token: HS256 JWT, `sub = userId`, `wlt = walletKey`, `sid = sessionId`,
  TTL `ACCESS_TOKEN_TTL`. Sent as `Authorization: Bearer …`.
  The guard also checks the session is not revoked (one indexed lookup).
- Refresh token: 32 random bytes, base64url, TTL `REFRESH_TOKEN_TTL`.
  Cookie `cb_refresh`: `HttpOnly; Secure; SameSite=Lax; Path=/auth`,
  host-only unless `COOKIE_DOMAIN` is set. `chainbills.xyz` →
  `api.chainbills.xyz` is same-site, so `Lax` cookies flow on credentialed
  `fetch` calls. CORS must set `credentials: true` with the explicit
  `CORS_ORIGINS` allowlist.
- `@CurrentUser()` decorator gives `{ userId, walletKey, sessionId }`.
- `@Public()` marks routes that skip the guard; the guard is global and
  deny-by-default.

---

## 10. Users and email verification

Endpoints (all authenticated):

| Method | Path | Behaviour |
| --- | --- | --- |
| `GET` | `/me` | `{ id, wallets[], email, emailVerifiedAt, preferences{type: {email}} }` |
| `PATCH` | `/me/preferences` | Partial map of `NotificationType → { email: boolean }` |
| `POST` | `/me/email` | Body `{ email }`. Starts verification: sends a 6-digit code. |
| `POST` | `/me/email/verify` | Body `{ code }`. Completes verification of the latest pending request. |
| `DELETE` | `/me/email` | Removes the email; notifications stop. |

Verification rules:

- Normalise email (trim, lowercase); validate with `class-validator` `IsEmail`.
- Code: `crypto.randomInt(0, 1_000_000)`, zero-padded to 6 digits.
- Store `codeHash = HMAC-SHA256(OTP_HMAC_SECRET, verificationId + ':' + code)`.
- Expiry 10 min. Max 5 attempts per verification, compared with
  `crypto.timingSafeEqual`. A new request invalidates older pending ones.
- Rate limits (computed from `EmailVerification` rows): ≥ 60 s between sends
  per user; ≤ 5 sends per user per 24 h; ≤ 5 sends per target email per 24 h.
  Violations → `429` with a `retryAfter` seconds field.
- On success: set `User.email`, `emailVerifiedAt`; mark the verification consumed.
- The verification email is sent directly through `MailProvider` (the user is
  waiting), not through the outbox. A provider failure returns `502` and does
  not count against the rate limit.
- Error messages never reveal whether an email is used by another user.

---

## 11. Notifications

### 11.1 Outbox write (worker side)

When the indexer handles an activity that maps to a notification (§8.2), it
adds an `Outbox` row **in the same transaction**, only if all hold:

1. The event timestamp is within `EMAIL_MAX_EVENT_AGE` of now.
2. A `Wallet` exists for the recipient wallet key whose `User` has a verified email.

`dedupeKey = "<TYPE>:<entityId>:<walletKey>"`; insert with conflict-ignore so
reprocessing never duplicates.

| Type | Recipient | Trigger | Payload |
| --- | --- | --- | --- |
| `PAYABLE_CREATED` | host | `CreatedPayable` | payableId, chainId, allowed tokens |
| `PAYMENT_RECEIVED` | host | `PayableReceived` (lands on the payable's chain, so cross-chain payments notify on arrival) | paymentId, payableId, token, amount, payerChainId |
| `PAYMENT_RECEIPT` | payer | `UserPaid` on the payer's chain | paymentId, payableId, payableChainId, token, amount |
| `WITHDRAWAL_COMPLETED` | host | `Withdrew` | withdrawalId, payableId, token, amount |

### 11.2 Outbox processor

- Claims up to N rows with `status = PENDING AND nextAttemptAt <= now()` using
  `SELECT … FOR UPDATE SKIP LOCKED` (raw query) and sets `SENDING`.
- Re-resolves the recipient at send time: no user / no verified email /
  preference off → `SKIPPED` with the reason in `lastError`.
- Renders the template, sends via `MailProvider`, stores `providerMessageId`,
  sets `SENT`.
- Failure: `attempts++`, `nextAttemptAt = now() + 1 min × 2^attempts`
  (cap 1 h), back to `PENDING`; after 8 attempts `FAILED`.
- Rows stuck in `SENDING` for > 10 min (crash mid-send) return to `PENDING`.

### 11.3 Mail provider

```ts
interface MailMessage { to: string; subject: string; html: string; text: string; headers?: Record<string, string>; }
interface MailProvider { send(msg: MailMessage): Promise<{ messageId: string }>; }
```

- `ZeptoMailProvider`: `POST {ZEPTOMAIL_API_URL}/v1.1/email`, header
  `Authorization: Zoho-enczapikey {ZEPTOMAIL_API_KEY}`, JSON body with
  `from`, `to[].email_address`, `subject`, `htmlbody`, `textbody`. Verify
  the request format and custom-header support against the current ZeptoMail
  API docs; if custom headers are supported, send `List-Unsubscribe` and
  `List-Unsubscribe-Post: List-Unsubscribe=One-Click`.
- `ConsoleMailProvider`: logs the message (code included) — development only;
  config validation rejects `console` when `NODE_ENV=production`.
- Timeouts (10 s) and non-2xx responses throw typed errors carrying the
  provider's error code.

### 11.4 Templates

Plain TypeScript functions in `notifications/templates/` returning
`{ subject, html, text }`. Shared layout with inline CSS, Chainbills name,
the event summary, a primary button to the relevant page on `APP_URL`
(`/receipt/:id`, `/payable/:id`), and a footer with the unsubscribe link.
Amounts are formatted with the token's decimals and symbol from the registry.
All interpolated values are HTML-escaped. Snapshot tests per template.

### 11.5 Unsubscribe

- Link: `{PUBLIC_API_URL}/email/unsubscribe?u=<userId>&t=<type>&s=<sig>` with
  `sig = base64url(HMAC-SHA256(UNSUBSCRIBE_SECRET, userId + ':' + type))`.
- `GET` shows a minimal HTML confirmation page with a button that `POST`s to
  the same URL; `POST` sets the preference off (RFC 8058 one-click compatible).
- Public, signature-checked with `timingSafeEqual`, throttled.

---

## 12. Public API

### 12.1 Conventions

- JSON only. Errors: `{ statusCode, error, message }` via a global exception filter.
- Cursor pagination: `?limit=` (1–100, default 20) and `?cursor=` (opaque,
  base64url of the last row's sort key). Responses: `{ items, nextCursor }`.
- Amounts: `{ token, symbol, decimals, amount: "<raw integer string>", formatted: "<decimal string>" }`.
  Payments expose both `requestedAmount` (price) and `amount` (debited /
  credited); withdrawals expose `amount`, `fee` and `netAmount` (`amount - fee`).
- Chains: every chain field is `{ chainId: "<cbChainId>", slug, displayName }`.
- Addresses output: EVM checksummed, Solana base58.
- Every controller, DTO and response class has `@ApiTags`, `@ApiOperation`,
  `@ApiProperty` (with `description` and `example`) so `/docs` is complete.
- Throttled globally by IP (`THROTTLE_*`), stricter on auth + email routes.

### 12.2 Endpoints

| Method | Path | Auth | Description |
| --- | --- | --- | --- |
| `GET` | `/health` | public | `{ status, role, db, chains: [{ slug, lastTickAt }] }` |
| `GET` | `/chains` | public | Registry: chains, protocols supported, tokens |
| `GET` | `/payables/:id` | public | Payable with allowed tokens, balances, flags, description, counts |
| `GET` | `/payables` | public | Filter `host` (address or wallet key), `chain`; newest first |
| `PUT` | `/payables/:id/description` | host | Body `{ description }` (3–3000 chars, sanitised). If the payable is not indexed yet, ownership is verified on-chain via the diamond's `isPayableHost(payableId, account)` / the Solana payable account. |
| `GET` | `/payables/:id/payments` | public | `PayablePayment`s of a payable, newest first |
| `GET` | `/payables/:id/withdrawals` | public | Withdrawals of a payable |
| `GET` | `/payments/user/:id` | public | One `UserPayment` + the matching `PayablePayment` if indexed (cross-chain status) |
| `GET` | `/payments/payable/:id` | public | One `PayablePayment` + its `UserPayment` if indexed |
| `GET` | `/users/:walletKey/payments` | public | Payments made by a wallet across all chains |
| `GET` | `/users/:walletKey/payables` | public | Payables hosted by a wallet across all chains |
| `GET` | `/withdrawals/:id` | public | One withdrawal |
| `GET` | `/stats` | public | Totals per chain + token: payments count, paid volume, withdrawn volume |
| auth / me / email routes | | | §9, §10, §11.5 |

---

## 13. Security checklist

- Global JWT guard, deny-by-default; `@Public()` opt-out is explicit.
- Helmet-equivalent headers on the API; body size limit 100 kB.
- `ValidationPipe({ whitelist: true, forbidNonWhitelisted: true, transform: true })`.
- No secret or email address appears in logs (log user ids instead).
- Constant-time comparison for codes, token hashes and HMAC signatures.
- Worker keys are only loaded when the role needs them.
- Description input sanitised (strip HTML) on write; output is plain text.
- Prisma raw queries only through tagged templates (`$queryRaw\`…\``), never string concatenation.

---

## 14. Observability

- pino JSON logs with `chain`, `jobId`, `outboxId`, `userId` context fields.
- `/health` returns `503` when the DB is unreachable, or (worker roles) a
  chain's `lastTickAt` is older than 5× its poll interval.
- Heartbeat log every 15 min (§8.5).

---

## 15. Deployment

- **Dockerfile:** multi-stage (`node:24-slim`, pnpm via Corepack), `pnpm install --frozen-lockfile`, `prisma generate`,
  `nest build`; runtime stage copies `dist/`, production `node_modules` and
  `prisma/`; runs as non-root; `CMD` runs `prisma migrate deploy` then
  `node dist/main.js`. Honours `PORT`. Handles `SIGTERM`.
- **docker-compose.yml:** `postgres:16` with a volume and healthcheck, `app`
  built from the Dockerfile with `env_file: .env`; optional `caddy` service
  (profile `proxy`) terminating TLS for `api.<domain>`.
- **Cloud Run:** `ROLE=all`, min = max = 1 instance, CPU always allocated,
  secrets from Secret Manager as env vars, Neon `DATABASE_URL` (pooled) and
  `DIRECT_URL` (direct).
- **VPS:** `docker compose up -d` (with `--profile proxy` for TLS).
- `backend/README.md` documents both paths step by step.

---

## 16. Testing

- Unit tests for: env schema, SIWE/SIWS parsing + verification (fixtures
  signed with generated keys), token hashing / rotation, OTP rules, outbox
  claim + retry + skip logic, templates, amount formatting, payer
  normalisation, cursor pagination.
- e2e tests (`test/`) against a real Postgres from docker compose: auth
  round-trip, `/me` email flow with `ConsoleMailProvider`, public endpoints
  with seeded data.
- Chain-facing code is tested with mocked viem / web3 clients; no test needs
  a live RPC.
- Commands that must pass before every merge: `pnpm lint`, `pnpm build`,
  `pnpm test:cov`, `pnpm prisma validate`, and `pnpm test:e2e` where e2e tests exist.
- **Coverage is enforced** by `vitest.config.ts` thresholds: lines, functions
  and statements ≥ 90 %, branches ≥ 85 %, over all of `src/` except the
  entry point, module wiring, DTO classes and copied chain artefacts. Every
  phase keeps coverage above the thresholds with the code it adds; lowering a
  threshold or widening the exclusions is not allowed.

---

## 17. Phases

Work happens on one branch per phase, created from `main` in its own git
worktree, and is merged **locally** into `main` by the reviewer after review
(no GitHub pull requests). See `WORKER_RULES.md` §2.

| # | File | Scope | Depends on | Status |
| --- | --- | --- | --- | --- |
| 1 | [`phases/01-scaffold.md`](./phases/01-scaffold.md) | Project, config + env docs, Prisma schema, chain registry, Docker, health, Swagger | – | merged |
| 1b | [`phases/01b-diamond-alignment.md`](./phases/01b-diamond-alignment.md) | Diamond ABI + registry, `ENABLED_CHAINS`, schema migration, coverage to thresholds | 1 | next |
| 2a | [`phases/02a-evm-indexer-relay.md`](./phases/02a-evm-indexer-relay.md) | EVM indexer, relay job store + processor + resolvers + EVM submitter, worker lock + loops | 1b | |
| 2b | [`phases/02b-auth.md`](./phases/02b-auth.md) | Nonce, SIWE, SIWS, sessions, guard | 1b | |
| 3a | [`phases/03a-solana-indexer-relay.md`](./phases/03a-solana-indexer-relay.md) | Solana indexer; Solana relay ported behind a disabled switch | 2a | |
| 3b | [`phases/03b-users-email-outbox.md`](./phases/03b-users-email-outbox.md) | /me, OTP, preferences, outbox, ZeptoMail, templates, unsubscribe | 2a, 2b | |
| 4 | [`phases/04-public-api.md`](./phases/04-public-api.md) | Public read endpoints, description write, OpenAPI completeness | 2a, 2b, 3a | |
| 5 | [`phases/05-docs.md`](./phases/05-docs.md) | README, CLAUDE.md files, root docs entry | all | |

2a and 2b run in parallel; 3a and 3b run in parallel. Only phases 1 and 1b
edit `prisma/schema.prisma` and create migrations, unless a phase file says
otherwise. A later phase that genuinely needs a schema change adds a new
migration and states it in its handoff note.
