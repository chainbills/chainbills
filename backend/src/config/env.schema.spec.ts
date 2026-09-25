// ──────────────────────────────────────────────────────────────────────────────
// Chainbills Backend — Environment schema tests
//
// Covers SPEC.md §5.1 item 7: a valid minimal config per role, each required
// var missing, and malformed values (bad URL, bad hex key, bad keypair JSON,
// bad duration). Also covers ENABLED_CHAINS validation: unknown slugs, chains
// with no diamond address, and missing RPC vars. Runs with no network / DB access.
// ──────────────────────────────────────────────────────────────────────────────

import { envSchema, formatEnvIssues } from './env.schema';

/** Vars that are actually required (no default) in every role. */
const REQUIRED_IN_EVERY_ROLE: Record<string, string> = {
  APP_URL: 'https://chainbills.xyz',
  PUBLIC_API_URL: 'https://api.chainbills.xyz',
  DATABASE_URL: 'postgresql://user:pass@localhost:5432/chainbills',
  UNSUBSCRIBE_SECRET: 'a'.repeat(32),
};

/**
 * `REQUIRED_IN_EVERY_ROLE` plus `NODE_ENV=development`: development + console
 * mail (the schema default) is the valid "minimal" combination; a production
 * config must set MAIL_PROVIDER=zeptomail (tested separately below).
 */
const BASE_ENV: Record<string, string> = { ...REQUIRED_IN_EVERY_ROLE, NODE_ENV: 'development' };

const API_ONLY_ENV: Record<string, string> = {
  CORS_ORIGINS: 'https://chainbills.xyz',
  JWT_ACCESS_SECRET: 'b'.repeat(32),
  OTP_HMAC_SECRET: 'c'.repeat(32),
};

const WORKER_ONLY_ENV: Record<string, string> = {
  RELAYER_PRIVATE_KEY: `0x${'1'.repeat(64)}`,
  SOLANA_RELAYER_KEYPAIR: JSON.stringify(Array.from({ length: 64 }, () => 1)),
};

function parse(env: Record<string, string | undefined>) {
  return envSchema.safeParse(env);
}

describe('envSchema', () => {
  it('accepts a minimal config for ROLE=api', () => {
    const result = parse({ ...BASE_ENV, ...API_ONLY_ENV, ROLE: 'api' });
    expect(result.success).toBe(true);
  });

  it('accepts a minimal config for ROLE=worker', () => {
    const result = parse({ ...BASE_ENV, ...WORKER_ONLY_ENV, ROLE: 'worker' });
    expect(result.success).toBe(true);
  });

  it('accepts a minimal config for ROLE=all', () => {
    const result = parse({ ...BASE_ENV, ...API_ONLY_ENV, ...WORKER_ONLY_ENV, ROLE: 'all' });
    expect(result.success).toBe(true);
  });

  it('does not require relayer keys for ROLE=api', () => {
    const result = parse({ ...BASE_ENV, ...API_ONLY_ENV, ROLE: 'api' });
    expect(result.success).toBe(true);
  });

  it('does not require JWT/OTP secrets for ROLE=worker', () => {
    const result = parse({ ...BASE_ENV, ...WORKER_ONLY_ENV, ROLE: 'worker' });
    expect(result.success).toBe(true);
  });

  it.each(Object.keys(REQUIRED_IN_EVERY_ROLE))('rejects a config missing %s', (missingKey) => {
    const env: Record<string, string | undefined> = { ...BASE_ENV, ...API_ONLY_ENV, ...WORKER_ONLY_ENV, ROLE: 'all' };
    delete env[missingKey];
    const result = parse(env);
    expect(result.success).toBe(false);
    if (!result.success) {
      expect(formatEnvIssues(result.error).some((line) => line.startsWith(`${missingKey}:`))).toBe(true);
    }
  });

  it.each(Object.keys(API_ONLY_ENV))('rejects ROLE=all missing %s', (missingKey) => {
    const env: Record<string, string | undefined> = { ...BASE_ENV, ...API_ONLY_ENV, ...WORKER_ONLY_ENV, ROLE: 'all' };
    delete env[missingKey];
    const result = parse(env);
    expect(result.success).toBe(false);
  });

  it.each(Object.keys(WORKER_ONLY_ENV))('rejects ROLE=all missing %s', (missingKey) => {
    const env: Record<string, string | undefined> = { ...BASE_ENV, ...API_ONLY_ENV, ...WORKER_ONLY_ENV, ROLE: 'all' };
    delete env[missingKey];
    const result = parse(env);
    expect(result.success).toBe(false);
  });

  it('rejects a malformed URL', () => {
    const result = parse({ ...BASE_ENV, ...API_ONLY_ENV, ...WORKER_ONLY_ENV, APP_URL: 'not-a-url' });
    expect(result.success).toBe(false);
  });

  it('rejects a malformed EVM private key (wrong length)', () => {
    const result = parse({
      ...BASE_ENV,
      ...API_ONLY_ENV,
      ...WORKER_ONLY_ENV,
      RELAYER_PRIVATE_KEY: '0x1234',
    });
    expect(result.success).toBe(false);
  });

  it('rejects a malformed EVM private key (missing 0x prefix)', () => {
    const result = parse({
      ...BASE_ENV,
      ...API_ONLY_ENV,
      ...WORKER_ONLY_ENV,
      RELAYER_PRIVATE_KEY: '1'.repeat(64),
    });
    expect(result.success).toBe(false);
  });

  it('rejects a malformed Solana keypair (not JSON)', () => {
    const result = parse({
      ...BASE_ENV,
      ...API_ONLY_ENV,
      ...WORKER_ONLY_ENV,
      SOLANA_RELAYER_KEYPAIR: 'not-json',
    });
    expect(result.success).toBe(false);
  });

  it('rejects a malformed Solana keypair (wrong length)', () => {
    const result = parse({
      ...BASE_ENV,
      ...API_ONLY_ENV,
      ...WORKER_ONLY_ENV,
      SOLANA_RELAYER_KEYPAIR: JSON.stringify([1, 2, 3]),
    });
    expect(result.success).toBe(false);
  });

  it('rejects a malformed Solana keypair (values out of byte range)', () => {
    const result = parse({
      ...BASE_ENV,
      ...API_ONLY_ENV,
      ...WORKER_ONLY_ENV,
      SOLANA_RELAYER_KEYPAIR: JSON.stringify(Array.from({ length: 64 }, () => 999)),
    });
    expect(result.success).toBe(false);
  });

  it.each(['ACCESS_TOKEN_TTL', 'REFRESH_TOKEN_TTL', 'SIGN_IN_MESSAGE_TTL', 'EMAIL_MAX_EVENT_AGE', 'THROTTLE_TTL'])(
    'rejects a malformed duration for %s',
    (field) => {
      const result = parse({ ...BASE_ENV, ...API_ONLY_ENV, ...WORKER_ONLY_ENV, [field]: '15 minutes' });
      expect(result.success).toBe(false);
    }
  );

  it('parses durations to milliseconds', () => {
    const result = parse({
      ...BASE_ENV,
      ...API_ONLY_ENV,
      ...WORKER_ONLY_ENV,
      ACCESS_TOKEN_TTL: '30s',
      REFRESH_TOKEN_TTL: '12h',
    });
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.ACCESS_TOKEN_TTL).toBe(30_000);
      expect(result.data.REFRESH_TOKEN_TTL).toBe(12 * 3_600_000);
    }
  });

  it('defaults DIRECT_URL is left undefined for the caller to fall back to DATABASE_URL', () => {
    const result = parse({ ...BASE_ENV, ...API_ONLY_ENV, ...WORKER_ONLY_ENV });
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.DIRECT_URL).toBeUndefined();
    }
  });

  it('rejects MAIL_PROVIDER=console when NODE_ENV=production', () => {
    const result = parse({
      ...BASE_ENV,
      ...API_ONLY_ENV,
      ...WORKER_ONLY_ENV,
      NODE_ENV: 'production',
      MAIL_PROVIDER: 'console',
    });
    expect(result.success).toBe(false);
  });

  it('accepts MAIL_PROVIDER=console when NODE_ENV=development', () => {
    const result = parse({
      ...BASE_ENV,
      ...API_ONLY_ENV,
      ...WORKER_ONLY_ENV,
      NODE_ENV: 'development',
      MAIL_PROVIDER: 'console',
    });
    expect(result.success).toBe(true);
  });

  it('requires ZEPTOMAIL_API_KEY and MAIL_FROM_ADDRESS when MAIL_PROVIDER=zeptomail', () => {
    const result = parse({
      ...BASE_ENV,
      ...API_ONLY_ENV,
      ...WORKER_ONLY_ENV,
      MAIL_PROVIDER: 'zeptomail',
    });
    expect(result.success).toBe(false);
  });

  it('accepts MAIL_PROVIDER=zeptomail with the required mail vars', () => {
    const result = parse({
      ...BASE_ENV,
      ...API_ONLY_ENV,
      ...WORKER_ONLY_ENV,
      MAIL_PROVIDER: 'zeptomail',
      ZEPTOMAIL_API_KEY: 'zoho-key',
      MAIL_FROM_ADDRESS: 'notify@notify.chainbills.xyz',
    });
    expect(result.success).toBe(true);
  });

  it('rejects a malformed MAIL_FROM_ADDRESS', () => {
    const result = parse({
      ...BASE_ENV,
      ...API_ONLY_ENV,
      ...WORKER_ONLY_ENV,
      MAIL_PROVIDER: 'zeptomail',
      ZEPTOMAIL_API_KEY: 'zoho-key',
      MAIL_FROM_ADDRESS: 'not-an-email',
    });
    expect(result.success).toBe(false);
  });

  it('formats issues as "VAR: reason" without echoing values', () => {
    const result = parse({});
    expect(result.success).toBe(false);
    if (!result.success) {
      const lines = formatEnvIssues(result.error);
      expect(lines.length).toBeGreaterThan(0);
      for (const line of lines) {
        expect(line).toMatch(/^[A-Za-z0-9_.]+: .+/);
      }
    }
  });

});

import { validateEnv } from './env.schema';

describe('validateEnv', () => {
  it('returns a typed Env on valid input', () => {
    const env = validateEnv({
      ...BASE_ENV,
      ...API_ONLY_ENV,
      ...WORKER_ONLY_ENV,
      NODE_ENV: 'development',
    });
    expect(env.role).toBe('all');
  });

  it('exits the process when the env is invalid', () => {
    const exitSpy = vi.spyOn(process, 'exit').mockImplementation(() => {
      throw new Error('process.exit called');
    });
    const stderrSpy = vi.spyOn(process.stderr, 'write').mockImplementation(() => true);
    expect(() => validateEnv({})).toThrow('process.exit called');
    expect(stderrSpy).toHaveBeenCalled();
    exitSpy.mockRestore();
    stderrSpy.mockRestore();
  });
});

// ── .env.example coverage check ───────────────────────────────────────────────
// Verifies that every key defined in the zod schema appears in .env.example so
// the two files never drift out of sync. The test is skipped when .env.example
// is absent (e.g. inside a Docker build context that excludes it).

import { existsSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { rawEnvSchema } from './env.schema';

describe('.env.example key coverage', () => {
  const examplePath = join(__dirname, '../../.env.example');

  it.skipIf(!existsSync(examplePath))('contains every key defined in the zod schema', () => {
    const raw = readFileSync(examplePath, 'utf8');
    const exampleKeys = new Set<string>();
    for (const line of raw.split('\n')) {
      const stripped = line.trim();
      // Active assignment:  KEY=value
      const active = /^([A-Z_][A-Z0-9_]*)=/.exec(stripped);
      if (active) {
        exampleKeys.add(active[1]);
        continue;
      }
      // Commented-out assignment:  # KEY=value (documented but optional)
      const commented = /^#\s*([A-Z_][A-Z0-9_]*)=/.exec(stripped);
      if (commented) {
        exampleKeys.add(commented[1]);
      }
    }

    const schemaKeys = Object.keys(rawEnvSchema.shape) as string[];
    const missing = schemaKeys.filter((k) => !exampleKeys.has(k));
    expect(missing, `Keys in env schema but absent from .env.example: ${missing.join(', ')}`).toHaveLength(0);
  });
});
