// ──────────────────────────────────────────────────────────────────────────────
// Chainbills Backend — Environment schema
//
// Single source of truth for every environment variable the service reads.
// `ConfigModule.forRoot({ validate })` runs `validateEnv` once
// at boot: on any problem it prints every issue (variable name + reason,
// never the offending value) to stderr and exits the process with code 1,
// before any Nest module initialises. `process.env` must never be read
// outside this directory — the parsed, typed `Env` object below is the only
// way the rest of the app sees configuration (see AppConfigService).
// ──────────────────────────────────────────────────────────────────────────────

import { z } from 'zod';

/** Deployment roles a running instance can take (SPEC.md §2.1). */
export const ROLES = ['all', 'api', 'worker'] as const;
export type Role = (typeof ROLES)[number];

/** pino log levels, from most to least verbose. */
const LOG_LEVELS = ['trace', 'debug', 'info', 'warn', 'error', 'fatal', 'silent'] as const;

const DURATION_PATTERN = /^(\d+)(s|m|h|d)$/;
const MS_PER_UNIT: Record<string, number> = { s: 1_000, m: 60_000, h: 3_600_000, d: 86_400_000 };

/**
 * Parses a human duration string (`"30s"`, `"15m"`, `"12h"`, `"30d"`) into
 * milliseconds. Returns `null` when the string does not match the pattern,
 * so callers can raise a schema issue without ever echoing the raw value.
 */
function parseDurationMs(raw: string): number | null {
  const match = DURATION_PATTERN.exec(raw);
  if (!match) return null;
  const [, amount, unit] = match;
  return Number(amount) * MS_PER_UNIT[unit];
}

/**
 * A zod schema for a duration env var, defaulted to `defaultValue` and
 * transformed straight to milliseconds so the rest of the app never parses
 * duration strings itself.
 */
function durationMs(defaultValue: string) {
  return z
    .string()
    .default(defaultValue)
    .transform((raw, ctx) => {
      const ms = parseDurationMs(raw);
      if (ms === null) {
        ctx.addIssue({ code: 'custom', message: 'must be a duration like "30s", "15m", "12h" or "30d"' });
        return z.NEVER;
      }
      return ms;
    });
}

/**
 * A zod schema for a boolean env var read as the literal strings `"true"` /
 * `"false"`. Plain `z.coerce.boolean()` treats any non-empty string
 * (including `"false"`) as `true`, which is the wrong behaviour for env vars.
 */
function boolString(defaultValue: boolean) {
  return z
    .enum(['true', 'false'])
    .default(defaultValue ? 'true' : 'false')
    .transform((raw) => raw === 'true');
}

/** A comma-separated list env var, trimmed and with empty entries dropped. */
const csvList = z
  .string()
  .optional()
  .transform((raw) =>
    (raw ?? '')
      .split(',')
      .map((origin) => origin.trim())
      .filter((origin) => origin.length > 0)
  );

/** `0x` + 64 hex chars — an EVM private key. */
const evmPrivateKey = z.string().regex(/^0x[0-9a-fA-F]{64}$/, 'must be "0x" followed by 64 hex characters');

/**
 * A JSON array of 64 integers (0-255) — the `solana/web3.js` `Keypair`
 * secret key encoding used by Solana CLI / wallet exports.
 */
const solanaKeypairJson = z
  .string()
  .transform((raw, ctx) => {
    let parsed: unknown;
    try {
      parsed = JSON.parse(raw);
    } catch {
      ctx.addIssue({ code: 'custom', message: 'must be a JSON array of 64 integers (0-255)' });
      return z.NEVER;
    }
    return parsed;
  })
  .pipe(z.array(z.number().int().min(0).max(255)).length(64, 'must contain exactly 64 integers (0-255)'));

/** Raw (pre-refine) schema: every field optional/defaulted, no cross-field rules yet. Exported for tests only. */
export const rawEnvSchema = z.object({
  NODE_ENV: z.enum(['development', 'test', 'production']).default('production'),
  ROLE: z.enum(ROLES).default('all'),
  PORT: z.coerce.number().int().positive().default(8080),
  LOG_LEVEL: z.enum(LOG_LEVELS).default('info'),

  APP_URL: z.url().optional(),
  PUBLIC_API_URL: z.url().optional(),
  CORS_ORIGINS: csvList,

  DATABASE_URL: z.url().optional(),
  DIRECT_URL: z.url().optional(),

  JWT_ACCESS_SECRET: z.string().min(32, 'must be at least 32 characters').optional(),
  ACCESS_TOKEN_TTL: durationMs('15m'),
  REFRESH_TOKEN_TTL: durationMs('30d'),
  COOKIE_DOMAIN: z.string().optional(),
  COOKIE_SECURE: boolString(true),
  SIGN_IN_MESSAGE_TTL: durationMs('10m'),

  // Enabled chains and RPC URLs are hardcoded in src/chains/registry.ts (ENABLED_CHAIN_SLUGS and rpcUrl fields)
  // rather than read from env vars. No ENABLED_CHAINS or RPC_* variables needed.

  RELAYER_PRIVATE_KEY: evmPrivateKey.optional(),
  SOLANA_RELAYER_KEYPAIR: solanaKeypairJson.optional(),

  POLL_INTERVAL_MS: z.coerce.number().int().positive().optional(),

  EMAILS_ENABLED: boolString(false),
  MAIL_PROVIDER: z.enum(['zeptomail', 'console']).default('console'),
  ZEPTOMAIL_API_URL: z.url().default('https://cpaas.zoho.com'),
  ZEPTOMAIL_API_KEY: z.string().optional(),
  MAIL_FROM_ADDRESS: z.string().email().optional(),
  MAIL_FROM_NAME: z.string().default('Chainbills'),

  OTP_HMAC_SECRET: z.string().min(32, 'must be at least 32 characters').optional(),
  UNSUBSCRIBE_SECRET: z.string().min(32, 'must be at least 32 characters').optional(),
  EMAIL_MAX_EVENT_AGE: durationMs('1h'),

  THROTTLE_TTL: durationMs('60s'),
  THROTTLE_LIMIT: z.coerce.number().int().positive().default(120),
});

/**
 * Adds a "required" issue for `field` when `condition` holds and the value
 * is still undefined after defaults were applied. Centralises the
 * role-conditional requirements from SPEC.md §5.2 so each rule reads as one
 * line below.
 */
function requireWhen(ctx: z.RefinementCtx, value: unknown, field: string, condition: boolean, reason: string): void {
  if (condition && (value === undefined || value === null || value === '')) {
    ctx.addIssue({ code: 'custom', path: [field], message: `is required ${reason}` });
  }
}

/**
 * Full env schema: raw parsing plus every role- and provider-conditional
 * "required" rule from SPEC.md §5.2. `superRefine` runs after per-field
 * parsing/defaulting, so it only ever sees already-typed values.
 *
 * Reading the table in SPEC.md §5.2: a bare "all" in the "roles requiring
 * it" column means the variable is required unconditionally (every role
 * needs it to run, e.g. DATABASE_URL, ENABLED_CHAINS); "api, all" /
 * "worker, all" mean required only when ROLE is one of those values;
 * "if zeptomail" means required only when MAIL_PROVIDER=zeptomail.
 *
 * ENABLED_CHAINS validation: every problem (unknown slug, null address,
 * missing RPC var) is collected and reported together — the process never
 * stops at the first failure.
 */
export const envSchema = rawEnvSchema.superRefine((env, ctx) => {
  const isApiRole = env.ROLE === 'api' || env.ROLE === 'all';
  const isWorkerRole = env.ROLE === 'worker' || env.ROLE === 'all';
  const isZeptomail = env.MAIL_PROVIDER === 'zeptomail';

  requireWhen(ctx, env.APP_URL, 'APP_URL', true, 'in every role');
  requireWhen(ctx, env.PUBLIC_API_URL, 'PUBLIC_API_URL', true, 'in every role');
  requireWhen(ctx, env.DATABASE_URL, 'DATABASE_URL', true, 'in every role');
  requireWhen(ctx, env.UNSUBSCRIBE_SECRET, 'UNSUBSCRIBE_SECRET', true, 'in every role');
  // Enabled chains and RPC URLs are validated at module init by ChainsService (reading ENABLED_CHAIN_SLUGS
  // from registry.ts), not here.

  if (isApiRole && env.CORS_ORIGINS.length === 0) {
    ctx.addIssue({ code: 'custom', path: ['CORS_ORIGINS'], message: 'is required when ROLE is api or all' });
  }
  requireWhen(ctx, env.JWT_ACCESS_SECRET, 'JWT_ACCESS_SECRET', isApiRole, 'when ROLE is api or all');
  requireWhen(ctx, env.OTP_HMAC_SECRET, 'OTP_HMAC_SECRET', isApiRole, 'when ROLE is api or all');

  requireWhen(ctx, env.RELAYER_PRIVATE_KEY, 'RELAYER_PRIVATE_KEY', isWorkerRole, 'when ROLE is worker or all');
  requireWhen(ctx, env.SOLANA_RELAYER_KEYPAIR, 'SOLANA_RELAYER_KEYPAIR', isWorkerRole, 'when ROLE is worker or all');

  requireWhen(ctx, env.ZEPTOMAIL_API_KEY, 'ZEPTOMAIL_API_KEY', isZeptomail, 'when MAIL_PROVIDER=zeptomail');
  requireWhen(ctx, env.MAIL_FROM_ADDRESS, 'MAIL_FROM_ADDRESS', isZeptomail, 'when MAIL_PROVIDER=zeptomail');

  if (env.MAIL_PROVIDER === 'console' && env.NODE_ENV === 'production') {
    ctx.addIssue({
      code: 'custom',
      path: ['MAIL_PROVIDER'],
      message: 'cannot be "console" when NODE_ENV=production — configure MAIL_PROVIDER=zeptomail',
    });
  }
});

/** Parsed, fully-typed environment — see field docs on {@link Env}. */
export interface Env {
  /** Node runtime mode; gates dev-only conveniences (pretty logs, console mail). */
  nodeEnv: 'development' | 'test' | 'production';
  /** Which subsystems this process runs — see SPEC.md §2.1. */
  role: Role;
  /** HTTP port the API listens on. */
  port: number;
  /** pino log level. */
  logLevel: (typeof LOG_LEVELS)[number];
  /** Public frontend origin; SIWE/SIWS `domain` + `uri`, email links. */
  appUrl: string;
  /** Public API origin; OpenAPI server URL, unsubscribe links. */
  publicApiUrl: string;
  /** Allowed CORS origins for the HTTP API. */
  corsOrigins: string[];
  /** Pooled Postgres connection string used at runtime. */
  databaseUrl: string;
  /** Direct (non-pooled) Postgres connection string used for migrations. */
  directUrl: string;
  /** HMAC secret signing access-token JWTs. Required for api/all. */
  jwtAccessSecret?: string;
  /** Access token lifetime, in milliseconds. */
  accessTokenTtlMs: number;
  /** Refresh token lifetime, in milliseconds. */
  refreshTokenTtlMs: number;
  /** Cookie `Domain` attribute; unset means a host-only cookie. */
  cookieDomain?: string;
  /** Cookie `Secure` attribute; only ever `false` for local http development. */
  cookieSecure: boolean;
  /** Max age of a SIWE/SIWS `issuedAt`, in milliseconds. */
  signInMessageTtlMs: number;
  // Enabled chains and RPC URLs live in src/chains/registry.ts, not in Env.
  /** EVM relayer wallet private key. Required for worker/all. */
  relayerPrivateKey?: `0x${string}`;
  /** Solana relayer wallet secret key, as a 64-byte array. Required for worker/all. */
  solanaRelayerKeypair?: number[];
  /** Optional override of every chain's registry poll interval, in ms. */
  pollIntervalMsOverride?: number;
  /** When false, outbox rows are skipped rather than sent. Safe default for staging/deploy. */
  emailsEnabled: boolean;
  /** Which `MailProvider` implementation to use. */
  mailProvider: 'zeptomail' | 'console';
  zeptomail: {
    /** ZeptoMail API host for the Zoho account's region. */
    apiUrl: string;
    /** ZeptoMail "Send Mail" token. Required when mailProvider=zeptomail. */
    apiKey?: string;
    /** Verified sender address. Required when mailProvider=zeptomail. */
    fromAddress?: string;
    /** Sender display name. */
    fromName: string;
  };
  /** HMAC secret hashing email verification codes. Required for api/all. */
  otpHmacSecret?: string;
  /** HMAC secret signing one-click unsubscribe links. */
  unsubscribeSecret: string;
  /** On-chain events older than this never produce a notification, in ms. */
  emailMaxEventAgeMs: number;
  /** Throttler window, in ms. */
  throttleTtlMs: number;
  /** Max requests per throttler window, per IP. */
  throttleLimit: number;
}

/** zod's parsed output type before the ergonomic {@link Env} remap. */
type ParsedEnv = z.infer<typeof envSchema>;

/** Reshapes the flat, `SCREAMING_SNAKE_CASE` parsed env into the nested {@link Env} the app consumes. */
function toEnv(parsed: ParsedEnv): Env {
  return {
    nodeEnv: parsed.NODE_ENV,
    role: parsed.ROLE,
    port: parsed.PORT,
    logLevel: parsed.LOG_LEVEL,
    // Required-ness for these is enforced by superRefine above; the `?? ''`
    // fallback only satisfies the compiler for the (rejected) invalid state.
    appUrl: parsed.APP_URL ?? '',
    publicApiUrl: parsed.PUBLIC_API_URL ?? '',
    corsOrigins: parsed.CORS_ORIGINS,
    databaseUrl: parsed.DATABASE_URL ?? '',
    directUrl: parsed.DIRECT_URL ?? parsed.DATABASE_URL ?? '',
    jwtAccessSecret: parsed.JWT_ACCESS_SECRET,
    accessTokenTtlMs: parsed.ACCESS_TOKEN_TTL,
    refreshTokenTtlMs: parsed.REFRESH_TOKEN_TTL,
    cookieDomain: parsed.COOKIE_DOMAIN,
    cookieSecure: parsed.COOKIE_SECURE,
    signInMessageTtlMs: parsed.SIGN_IN_MESSAGE_TTL,
    relayerPrivateKey: parsed.RELAYER_PRIVATE_KEY as `0x${string}` | undefined,
    solanaRelayerKeypair: parsed.SOLANA_RELAYER_KEYPAIR,
    pollIntervalMsOverride: parsed.POLL_INTERVAL_MS,
    emailsEnabled: parsed.EMAILS_ENABLED,
    mailProvider: parsed.MAIL_PROVIDER,
    zeptomail: {
      apiUrl: parsed.ZEPTOMAIL_API_URL,
      apiKey: parsed.ZEPTOMAIL_API_KEY,
      fromAddress: parsed.MAIL_FROM_ADDRESS,
      fromName: parsed.MAIL_FROM_NAME,
    },
    otpHmacSecret: parsed.OTP_HMAC_SECRET,
    unsubscribeSecret: parsed.UNSUBSCRIBE_SECRET ?? '',
    emailMaxEventAgeMs: parsed.EMAIL_MAX_EVENT_AGE,
    throttleTtlMs: parsed.THROTTLE_TTL,
    throttleLimit: parsed.THROTTLE_LIMIT,
  };
}

/** One "VARNAME: reason" line per schema issue, values never included. */
export function formatEnvIssues(error: z.ZodError): string[] {
  return error.issues.map((issue) => {
    const field = issue.path.length > 0 ? issue.path.join('.') : '(root)';
    return `${field}: ${issue.message}`;
  });
}

/**
 * Validates `raw` (normally `process.env`) against {@link envSchema}.
 *
 * On failure this prints every problem to stderr — name and reason only,
 * never the offending value — and exits the process with code 1, matching
 * SPEC.md §5.1: config errors must be loud and total, and must never leak a
 * secret into logs. `ConfigModule.forRoot({ validate: validateEnv })` calls
 * this synchronously before any other module initialises.
 */
export function validateEnv(raw: Record<string, string | undefined>): Env {
  const result = envSchema.safeParse(raw);
  if (!result.success) {
    process.stderr.write('Invalid environment configuration:\n');
    for (const line of formatEnvIssues(result.error)) {
      process.stderr.write(`  - ${line}\n`);
    }
    process.exit(1);
  }
  return toEnv(result.data);
}

/**
 * Validates and returns the current process environment. This is the one
 * place outside `ConfigModule.forRoot({ validate: validateEnv })` allowed to
 * read `process.env` directly (it still only ever does so from inside
 * `src/config/`): `app.module.ts` needs `Env.role` synchronously, before Nest
 * builds the DI graph, to decide whether to include `WorkerModule` /
 * `ApiModule` at all (SPEC.md §2.1) — a decision Nest's module system can
 * only make at class-decoration time, not through injected providers.
 */
export function loadEnv(): Env {
  return validateEnv(process.env);
}
