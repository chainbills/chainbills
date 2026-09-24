# Phase 2b — Authentication (SIWE + SIWS)

**Branch:** `backend-v2-02b-auth` → PR into `backend-v2`
**Depends on:** phase 1 merged into `backend-v2`
**Runs in parallel with:** phase 2a (do not touch `src/indexer/`, `src/relay/`, `src/worker/`)
**Read first:** `WORKER_RULES.md`, `SPEC.md` §5, §7 (User, Wallet, AuthNonce, Session), §9, §13

## Goal

Wallets on EVM and Solana sign in with standard messages and receive our own
tokens: a short-lived JWT access token and a rotating httpOnly refresh cookie.
A global guard protects every route not marked `@Public()`.

## Tasks

1. `src/auth/`: `AuthModule`, `AuthController`, `AuthService`, `NonceService`,
   `SessionService`, `SiweVerifier`, `SiwsVerifier`, `JwtAuthGuard` (global via
   `APP_GUARD`), `@CurrentUser()` decorator. Mark `/health`, `/docs*` and
   future public routes with `@Public()`.
2. Endpoints exactly per SPEC §9.1: `POST /auth/nonce`, `POST /auth/verify`,
   `POST /auth/refresh`, `POST /auth/logout`, `POST /auth/logout-all`, with
   DTOs and full Swagger annotations (request + response examples for both
   EVM and Solana).
3. SIWE via `viem/siwe` (`parseSiweMessage`, `verifySiweMessage` or
   `publicClient.verifyMessage` on the message's chain) — supports EOA,
   ERC-1271, ERC-6492. Reject chain ids not in the registry.
4. SIWS: a small, fully tested parser for the Sign-In With Solana text format
   (fields: domain line, address line, statement, URI, Version, Chain ID,
   Nonce, Issued At, Expiration Time, Not Before, Request ID, Resources),
   plus ed25519 verification with `tweetnacl`; signature as base58 or base64.
5. Refresh token rotation + reuse detection, cookie attributes and CORS
   credential handling exactly per SPEC §9.2.
6. Stricter throttling on `/auth/*` (e.g. 10 / min / IP for nonce + verify).
7. Expired `AuthNonce` rows are deleted opportunistically (e.g. on each
   nonce issue, delete rows expired > 1 h ago).
8. Docs: `backend/CLAUDE.md` auth section (flow, token model, invariants, how
   to protect a route), ENV docs for any auth var details.

## Tests

- Unit: SIWE + SIWS happy paths with generated keys (viem `privateKeyToAccount`,
  `tweetnacl` keypair); wrong domain / uri / nonce reused / nonce expired /
  issuedAt too old / expired message / wrong signature / unknown chain id.
- Unit: refresh rotation, reuse → session revoked, logout, logout-all.
- e2e: nonce → verify → `/auth/refresh` with cookie → protected dummy route
  (test-only controller) → logout → refresh rejected.

## Acceptance criteria

- First sign-in creates `User` + `Wallet`; later sign-ins reuse them and
  update `lastSignInAt`.
- Access tokens of a revoked session are rejected immediately.
- Routes are protected by default; `@Public()` opts out.
- All checks in `WORKER_RULES.md` §5 pass.
