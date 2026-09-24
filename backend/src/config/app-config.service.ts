// ──────────────────────────────────────────────────────────────────────────────
// Chainbills Backend — Typed config accessor
//
// Thin wrapper around Nest's `ConfigService<Env, true>` so the rest of the
// app injects one typed service and reads `.env` instead of scattering
// stringly-typed `configService.get('some.path')` calls everywhere. This —
// not `process.env` — is how every other module reads configuration
// (WORKER_RULES.md §3).
// ──────────────────────────────────────────────────────────────────────────────

import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import type { Env } from './env.schema';

/**
 * Typed configuration accessor. `ConfigModule.forRoot({ validate: validateEnv })`
 * (see `config.module.ts`) stores the object `validateEnv` returns as Nest's
 * internal config object, keyed by the same nested shape as {@link Env}; the
 * `true` generic parameter tells `ConfigService` to assume every property is
 * present (already guaranteed, since `validateEnv` exits the process on
 * failure before any module — including this one — is constructed).
 */
@Injectable()
export class AppConfigService {
  /** The full validated, typed environment object. */
  readonly env: Env;

  constructor(config: ConfigService<Env, true>) {
    this.env = {
      nodeEnv: config.get('nodeEnv', { infer: true }),
      role: config.get('role', { infer: true }),
      port: config.get('port', { infer: true }),
      logLevel: config.get('logLevel', { infer: true }),
      appUrl: config.get('appUrl', { infer: true }),
      publicApiUrl: config.get('publicApiUrl', { infer: true }),
      corsOrigins: config.get('corsOrigins', { infer: true }),
      databaseUrl: config.get('databaseUrl', { infer: true }),
      directUrl: config.get('directUrl', { infer: true }),
      jwtAccessSecret: config.get('jwtAccessSecret', { infer: true }),
      accessTokenTtlMs: config.get('accessTokenTtlMs', { infer: true }),
      refreshTokenTtlMs: config.get('refreshTokenTtlMs', { infer: true }),
      cookieDomain: config.get('cookieDomain', { infer: true }),
      cookieSecure: config.get('cookieSecure', { infer: true }),
      signInMessageTtlMs: config.get('signInMessageTtlMs', { infer: true }),
      rpc: config.get('rpc', { infer: true }),
      relayerPrivateKey: config.get('relayerPrivateKey', { infer: true }),
      solanaRelayerKeypair: config.get('solanaRelayerKeypair', { infer: true }),
      pollIntervalMsOverride: config.get('pollIntervalMsOverride', { infer: true }),
      mailProvider: config.get('mailProvider', { infer: true }),
      zeptomail: config.get('zeptomail', { infer: true }),
      otpHmacSecret: config.get('otpHmacSecret', { infer: true }),
      unsubscribeSecret: config.get('unsubscribeSecret', { infer: true }),
      emailMaxEventAgeMs: config.get('emailMaxEventAgeMs', { infer: true }),
      throttleTtlMs: config.get('throttleTtlMs', { infer: true }),
      throttleLimit: config.get('throttleLimit', { infer: true }),
    };
  }
}
