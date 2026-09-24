# Environment variables

Every variable the backend reads, validated at boot by
[`src/config/env.schema.ts`](../src/config/env.schema.ts) (the single source
of truth — this table must stay in sync with it). On any problem the process
prints every issue (name and reason, never the value) to stderr and exits 1
before any module initialises.

"Roles requiring it" reads the same way as SPEC.md §5.2: **all** means
required regardless of `ROLE`; **api, all** / **worker, all** mean required
only when `ROLE` is one of those values; a dash means always optional
(uses its default).

## Process

| Name        | Roles requiring it | Default      | Format / notes                                    |
| ----------- | ------------------- | ------------ | -------------------------------------------------- |
| `NODE_ENV`  | –                    | `production` | `development` \| `test` \| `production`            |
| `ROLE`      | –                    | `all`        | `all` \| `api` \| `worker` — see SPEC.md §2.1       |
| `PORT`      | –                    | `8080`       | integer                                             |
| `LOG_LEVEL` | –                    | `info`       | pino level: `trace`\|`debug`\|`info`\|`warn`\|`error`\|`fatal`\|`silent` |

## Public URLs

| Name              | Roles requiring it | Default | Format / notes                                                                 |
| ----------------- | ------------------- | ------- | -------------------------------------------------------------------------------- |
| `APP_URL`         | all                  | –       | e.g. `https://chainbills.xyz`. SIWE/SIWS `domain` + `uri`, email links.          |
| `PUBLIC_API_URL`  | all                  | –       | e.g. `https://api.chainbills.xyz`. OpenAPI server URL, unsubscribe links.        |
| `CORS_ORIGINS`    | api, all             | –       | Comma-separated origins, e.g. `https://chainbills.xyz,https://staging.chainbills.xyz`. |

## Database

Get `DATABASE_URL` / `DIRECT_URL` from your Postgres provider's console (for
Neon: **Dashboard → your project → Connect** — copy the *pooled* connection
string for `DATABASE_URL` and the *direct* one for `DIRECT_URL`). For local
development, `docker-compose.yml`'s `postgres` service matches the example
value below.

| Name           | Roles requiring it | Default          | Format / notes                                                        |
| -------------- | ------------------- | ----------------- | ------------------------------------------------------------------------ |
| `DATABASE_URL` | all                  | –                 | Postgres URL, e.g. `postgresql://user:pass@host:5432/db?schema=public` (Neon: the pooled URL). |
| `DIRECT_URL`   | all                  | = `DATABASE_URL` | Direct (non-pooled) Postgres URL, used for migrations. Read by the Prisma CLI itself; the Docker `CMD` applies the fallback, so set it explicitly when running `pnpm prisma:*` outside the container. |

## Auth

Generate each secret with `openssl rand -base64 48`.

| Name                 | Roles requiring it | Default | Format / notes                                                      |
| -------------------- | ------------------- | ------- | ------------------------------------------------------------------------ |
| `JWT_ACCESS_SECRET`  | api, all             | –       | ≥ 32 characters. Signs access-token JWTs.                            |
| `ACCESS_TOKEN_TTL`   | –                    | `15m`   | Duration: `30s`, `15m`, `12h`, `30d`.                                 |
| `REFRESH_TOKEN_TTL`  | –                    | `30d`   | Duration, same format.                                                |
| `COOKIE_DOMAIN`      | –                    | unset (host-only cookie) | Set only when the API host differs from the cookie host. |
| `COOKIE_SECURE`      | –                    | `true`  | `true` \| `false` — `false` only for local `http://` development.     |
| `SIGN_IN_MESSAGE_TTL`| –                    | `10m`   | Max age of a SIWE/SIWS `issuedAt`, duration format.                    |

## Chain RPC URLs

Required for every role because the API verifies smart-contract wallet
signatures (ERC-1271 / ERC-6492) and payable ownership on-chain, not only
the worker's indexing loops. Get a free RPC endpoint from any EVM RPC
provider (Alchemy, Infura, etc.) for the three EVM vars; `RPC_SOLANA_DEVNET`
can be `https://api.devnet.solana.com` for light use or a dedicated Solana
RPC provider for anything sustained.

| Name                 | Roles requiring it | Default | Format / notes    |
| --------------------- | ------------------- | ------- | ------------------- |
| `RPC_ARC_TESTNET`     | all                  | –       | https URL           |
| `RPC_SEPOLIA`         | all                  | –       | https URL           |
| `RPC_MEGAETH`         | all                  | –       | https URL           |
| `RPC_SOLANA_DEVNET`   | all                  | –       | https URL           |

## Relayer keys

The EVM key needs gas plus `ADMIN_ROLE` on every deployed EVM contract (see
`evm/DEPLOYED.md`); the Solana keypair needs devnet SOL for transaction fees.
Never share these outside a secrets manager — they hold real (testnet/mainnet)
funds and admin privileges.

| Name                      | Roles requiring it | Default | Format / notes                                                           |
| -------------------------- | ------------------- | ------- | --------------------------------------------------------------------------- |
| `RELAYER_PRIVATE_KEY`      | worker, all          | –       | `0x` + 64 hex characters.                                                   |
| `SOLANA_RELAYER_KEYPAIR`   | worker, all          | –       | JSON array of 64 integers (0-255) — a Solana CLI/wallet secret key export.  |

## Worker tuning

| Name               | Roles requiring it | Default                   | Format / notes                          |
| ------------------- | ------------------- | -------------------------- | ------------------------------------------ |
| `POLL_INTERVAL_MS`  | –                    | per-chain registry value  | Global override, integer ms.               |

## Mail

`ZEPTOMAIL_API_KEY` and `MAIL_FROM_ADDRESS` come from the Zoho ZeptoMail
console: **Mail Agents → your agent → SMTP/API → API tokens** for the key,
and the **Domains** tab for a verified `MAIL_FROM_ADDRESS`. `MAIL_PROVIDER=console`
is rejected when `NODE_ENV=production` — it only logs the message, useful in
development so verification codes are visible without sending real email.

| Name                  | Roles requiring it | Default                     | Format / notes                                                  |
| ---------------------- | ------------------- | ---------------------------- | ------------------------------------------------------------------- |
| `MAIL_PROVIDER`        | –                    | `console`                    | `zeptomail` \| `console`. `console` forbidden when `NODE_ENV=production`. |
| `ZEPTOMAIL_API_URL`    | if `zeptomail`       | `https://api.zeptomail.com`  | Region host matching the Zoho account (`.eu`, `.in`, `.com.au`, …). |
| `ZEPTOMAIL_API_KEY`    | if `zeptomail`       | –                             | ZeptoMail "Send Mail" token.                                       |
| `MAIL_FROM_ADDRESS`    | if `zeptomail`       | –                             | A verified sender, e.g. `notify@notify.chainbills.xyz`.            |
| `MAIL_FROM_NAME`       | –                    | `Chainbills`                  |                                                                      |

## Email verification / unsubscribe secrets

Generate each with `openssl rand -base64 48`.

| Name                   | Roles requiring it | Default | Format / notes                                                        |
| ----------------------- | ------------------- | ------- | -------------------------------------------------------------------------- |
| `OTP_HMAC_SECRET`       | api, all             | –       | ≥ 32 characters. HMACs email verification codes.                       |
| `UNSUBSCRIBE_SECRET`    | all                  | –       | ≥ 32 characters. Signs one-click unsubscribe links.                    |
| `EMAIL_MAX_EVENT_AGE`   | –                    | `1h`    | Duration format. On-chain events older than this never notify.          |

## Rate limiting

| Name              | Roles requiring it | Default | Format / notes                     |
| ------------------ | ------------------- | ------- | ------------------------------------- |
| `THROTTLE_TTL`     | –                    | `60s`   | Throttler window, duration format.    |
| `THROTTLE_LIMIT`   | –                    | `120`   | Max requests per window, per IP.      |
