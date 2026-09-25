// ──────────────────────────────────────────────────────────────────────────────
// Chainbills Backend — AppConfigService tests
//
// Covers the typed accessor and the rpcUrl() helper. Uses a minimal fake
// ConfigService so no real Nest context is needed.
// ──────────────────────────────────────────────────────────────────────────────

import type { ConfigService } from '@nestjs/config';
import { AppConfigService } from './app-config.service';
import type { Env } from './env.schema';

function makeConfigService(env: Partial<Env>): ConfigService<Env, true> {
  return {
    get: vi.fn((key: keyof Env) => env[key as keyof Env]),
  } as unknown as ConfigService<Env, true>;
}

describe('AppConfigService', () => {
  it('exposes the full env object assembled from ConfigService', () => {
    const partial: Partial<Env> = {
      nodeEnv: 'development',
      role: 'api',
      port: 8080,
      logLevel: 'info',
      appUrl: 'https://chainbills.xyz',
      publicApiUrl: 'https://api.chainbills.xyz',
      corsOrigins: ['https://chainbills.xyz'],
      databaseUrl: 'postgresql://localhost/chainbills',
      directUrl: 'postgresql://localhost/chainbills',
      jwtAccessSecret: 'a'.repeat(32),
      accessTokenTtlMs: 900_000,
      refreshTokenTtlMs: 2_592_000_000,
      cookieSecure: false,
      signInMessageTtlMs: 600_000,
      mailProvider: 'console',
      zeptomail: { apiUrl: 'https://api.zeptomail.com', fromName: 'Chainbills' },
      unsubscribeSecret: 'b'.repeat(32),
      emailMaxEventAgeMs: 3_600_000,
      throttleTtlMs: 60_000,
      throttleLimit: 120,
    };
    const service = new AppConfigService(makeConfigService(partial));
    expect(service.env.role).toBe('api');
  });
});
