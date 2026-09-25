# Phase 3b — Users, Email Verification, Outbox and ZeptoMail

**Branch:** `backend-v2-03b-users-email-outbox` (worktree from `main`) → merged locally into `main` after review
**Depends on:** phases 2a and 2b merged into `main`
**Runs in parallel with:** phase 3a (do not touch `src/indexer/`, `src/relay/`)
**Read first:** `WORKER_RULES.md`, `SPEC.md` §5, §7 (User, EmailVerification,
NotificationPreference, Outbox), §10, §11, §13

## Goal

Signed-in users manage a verified email address and per-type preferences;
indexed events turn into emails that are delivered reliably through ZeptoMail
with one-click unsubscribe.

## Tasks

1. `src/users/`: `/me`, `PATCH /me/preferences`, `POST /me/email`,
   `POST /me/email/verify`, `DELETE /me/email` exactly per SPEC §10, with
   DTOs, Swagger annotations and the rate-limit rules (`429` + `retryAfter`).
2. `src/notifications/mail/`: `MailProvider` interface, `ZeptoMailProvider`,
   `ConsoleMailProvider`, provider selection from `MAIL_PROVIDER`. Check the
   current ZeptoMail API docs for request format, auth header, region hosts
   and custom headers; document findings in the module README.
3. `src/notifications/templates/`: layout + one template per
   `NotificationType` + the verification-code email, per SPEC §11.4.
4. `src/notifications/outbox.processor.ts`: worker loop per SPEC §11.2
   (`FOR UPDATE SKIP LOCKED` claim, re-resolve recipient, render, send,
   retry / skip / fail, stuck-`SENDING` recovery). Registered only in worker roles.
5. `src/notifications/unsubscribe.controller.ts`: `GET` + `POST`
   `/email/unsubscribe` per SPEC §11.5 (public, signed, throttled, minimal
   HTML page for `GET`).
6. Docs: `backend/AGENTS.md` users + notifications sections; ENV docs for
   mail variables including step-by-step ZeptoMail setup (add domain, DKIM +
   bounce CNAME records, create Send Mail token, pick region URL) and a note
   to keep the sending subdomain separate from the Zoho Mail mailbox domain.

## Tests

- OTP: code format, hash, expiry, attempts, invalidation of older requests,
  every rate limit, timing-safe compare.
- Outbox processor: claim, send, skip reasons, backoff, max attempts,
  stuck-row recovery (e2e with compose Postgres).
- Templates: snapshot per type; HTML escaping of interpolated values.
- Unsubscribe: valid / tampered signature, preference switched off.
- ZeptoMail provider: request shape and error mapping with mocked `fetch`.

## Acceptance criteria

- With `MAIL_PROVIDER=console`, the full flow works locally: sign in → set
  email → code logged → verify → an indexed payment produces a logged email.
- All checks in `WORKER_RULES.md` §5 pass.
