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
  ENABLED_CHAINS: 'solanadevnet',
  RPC_SOLANADEVNET: 'https://solana-devnet.example.com',
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

  // ENABLED_CHAINS validation
  describe('ENABLED_CHAINS validation', () => {
    it('rejects an unknown slug in ENABLED_CHAINS', () => {
      const result = parse({
        ...BASE_ENV,
        ...API_ONLY_ENV,
        ...WORKER_ONLY_ENV,
        ENABLED_CHAINS: 'unknownchain',
        RPC_UNKNOWNCHAIN: 'https://example.com',
      });
      expect(result.success).toBe(false);
      if (!result.success) {
        const lines = formatEnvIssues(result.error);
        expect(lines.some((l) => l.includes('unknown chain slugs'))).toBe(true);
      }
    });

    it('rejects enabling a chain with no diamond address', () => {
      const result = parse({
        ...BASE_ENV,
        ...API_ONLY_ENV,
        ...WORKER_ONLY_ENV,
        ENABLED_CHAINS: 'arcmainnet',
        RPC_ARCMAINNET: 'https://arc.example.com',
      });
      expect(result.success).toBe(false);
      if (!result.success) {
        const lines = formatEnvIssues(result.error);
        expect(lines.some((l) => l.includes('no deployed diamond address'))).toBe(true);
      }
    });

    it('rejects when RPC var is missing for an enabled chain', () => {
      const result = parse({
        ...BASE_ENV,
        ...API_ONLY_ENV,
        ...WORKER_ONLY_ENV,
        ENABLED_CHAINS: 'solanadevnet',
        // RPC_SOLANADEVNET is omitted
        RPC_SOLANADEVNET: undefined,
      });
      expect(result.success).toBe(false);
      if (!result.success) {
        const lines = formatEnvIssues(result.error);
        expect(lines.some((l) => l.startsWith('RPC_SOLANADEVNET'))).toBe(true);
      }
    });

    it('reports multiple ENABLED_CHAINS problems at once', () => {
      const result = parse({
        ...BASE_ENV,
        ...API_ONLY_ENV,
        ...WORKER_ONLY_ENV,
        ENABLED_CHAINS: 'badslug1,badslug2',
        RPC_BADSLUG1: 'https://example.com',
        RPC_BADSLUG2: 'https://example.com',
      });
      expect(result.success).toBe(false);
      if (!result.success) {
        const msg = formatEnvIssues(result.error).join('\n');
        expect(msg).toContain('badslug1');
        expect(msg).toContain('badslug2');
      }
    });

    it('accepts solanadevnet with its RPC var', () => {
      const result = parse({
        ...BASE_ENV,
        ...API_ONLY_ENV,
        ...WORKER_ONLY_ENV,
        ENABLED_CHAINS: 'solanadevnet',
        RPC_SOLANADEVNET: 'https://solana-devnet.example.com',
      });
      expect(result.success).toBe(true);
    });
  });
});

import { validateEnv, rpcVarName } from './env.schema';

describe('rpcVarName', () => {
  it('converts a slug to its RPC_ env var name', () => {
    expect(rpcVarName('arcmainnet')).toBe('RPC_ARCMAINNET');
    expect(rpcVarName('solanadevnet')).toBe('RPC_SOLANADEVNET');
    expect(rpcVarName('anvil')).toBe('RPC_ANVIL');
  });
});

describe('validateEnv', () => {
  it('returns a typed Env on valid input', () => {
    const env = validateEnv({
      ...BASE_ENV,
      ...API_ONLY_ENV,
      ...WORKER_ONLY_ENV,
      NODE_ENV: 'development',
    });
    expect(env.role).toBe('all');
    expect(env.enabledChainSlugs).toEqual(['solanadevnet']);
    expect(env.rpcBySlug['solanadevnet']).toBe('https://solana-devnet.example.com');
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

  it('populates rpcBySlug from enabled chain vars', () => {
    const env = validateEnv({
      ...BASE_ENV,
      ...API_ONLY_ENV,
      ...WORKER_ONLY_ENV,
      NODE_ENV: 'development',
      ENABLED_CHAINS: 'solanadevnet',
      RPC_SOLANADEVNET: 'https://solana.example.com',
    });
    expect(env.rpcBySlug).toEqual({ solanadevnet: 'https://solana.example.com' });
  });
});
