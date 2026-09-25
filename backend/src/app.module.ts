// ──────────────────────────────────────────────────────────────────────────────
// Chainbills Backend — Root module
//
// Wires the always-on infrastructure (config, Prisma, chains, logging,
// throttling, the global exception filter, health) and gates WorkerModule /
// ApiModule by ROLE, per SPEC.md §2.1: "worker-side providers are registered
// by a WorkerModule that AppModule imports only when ROLE is worker or all;
// HTTP controllers other than HealthController are registered only when
// ROLE is api or all."
// ──────────────────────────────────────────────────────────────────────────────

import { Module } from '@nestjs/common';
import { APP_FILTER, APP_GUARD, APP_INTERCEPTOR } from '@nestjs/core';
import { ThrottlerGuard, ThrottlerModule } from '@nestjs/throttler';
import { LoggerModule } from 'nestjs-pino';
import { ApiModule } from './api/api.module';
import { ChainsModule } from './chains/chains.module';
import { GlobalExceptionFilter } from './common/filters/global-exception.filter';
import { LoggingInterceptor } from './common/interceptors/logging.interceptor';
import { AppConfigService } from './config/app-config.service';
import { AppConfigModule } from './config/config.module';
import { loadEnv } from './config/env.schema';
import { HealthModule } from './health/health.module';
import { PrismaModule } from './prisma/prisma.module';
import { WorkerModule } from './worker/worker.module';

// Load .env before reading process.env — ConfigModule.forRoot() does this too,
// but that runs after module decoration, too late for the role gate below.
try { process.loadEnvFile(); } catch { /* no .env file is fine in production */ }

// Resolved once, synchronously, before Nest builds the DI graph — see
// loadEnv()'s doc comment in env.schema.ts for why the role gate below
// cannot instead be driven by an injected ConfigService.
const env = loadEnv();

/** Secret-bearing fields never written to logs, on top of pino's own defaults. */
const PINO_REDACT_PATHS = [
  'req.headers.authorization',
  'req.headers.cookie',
  'res.headers["set-cookie"]',
  'req.body.password',
  'req.body.code',
  'req.body.signature',
];

/**
 * Bulky viem / anchor error properties that would otherwise dump the whole
 * contract ABI, program IDL, or a raw event payload into every error log line.
 * We keep the human-facing fields (`message`, `shortMessage`, `details`,
 * `functionName`, `code`, `stack`) and drop the rest. Same shape as pino's
 * default `err` serializer, minus the noise.
 */
const NOISY_ERROR_KEYS = new Set(['abi', 'idl', 'contract', 'contractAddress', 'sender', 'raw', 'signature', 'data', 'args', 'metaMessages']);

interface SerializableError {
  name?: string;
  message?: string;
  shortMessage?: string;
  details?: string;
  functionName?: string;
  code?: string | number;
  stack?: string;
  cause?: unknown;
  [key: string]: unknown;
}

/** Trims viem/anchor errors down to the useful fields — drops ABI/IDL/args dumps. */
function serializeError(err: unknown): SerializableError | unknown {
  if (!(err instanceof Error)) return err;
  const out: SerializableError = { name: err.name, message: err.message, stack: err.stack };
  for (const key of Object.keys(err)) {
    if (NOISY_ERROR_KEYS.has(key)) continue;
    const value = (err as unknown as Record<string, unknown>)[key];
    if (value instanceof Error) {
      out[key] = serializeError(value);
    } else if (typeof value !== 'function') {
      out[key] = value;
    }
  }
  return out;
}

/** Root application module; imports WorkerModule and/or ApiModule depending on the ROLE env var. */
@Module({
  imports: [
    AppConfigModule,
    PrismaModule,
    ChainsModule,
    LoggerModule.forRootAsync({
      imports: [AppConfigModule],
      inject: [AppConfigService],
      useFactory: (config: AppConfigService) => ({
        pinoHttp: {
          level: config.env.logLevel,
          redact: { paths: PINO_REDACT_PATHS, remove: true },
          // Per-request access logs come from LoggingInterceptor (one clean
          // line per request); pino's built-in autoLogging is off to avoid
          // duplicate "request completed" entries that dump every header.
          autoLogging: false,
          // pino-http auto-attaches a `req` object to every log emitted
          // during an HTTP request, which by default serialises every header
          // (host, cookie, sec-* etc.) and blows the log line up to several
          // hundred bytes. LoggingInterceptor already logs method + url; we
          // only keep the request id here so cross-log correlation still
          // works.
          serializers: {
            req: (req) => ({ id: req.id }),
            res: (res) => ({ statusCode: res.statusCode }),
            err: serializeError,
          },
          // Pretty-print in development only; production stays JSON-to-stdout
          // for the log collector, and pino-pretty is a devDependency only.
          transport:
            config.env.nodeEnv === 'development'
              ? { target: 'pino-pretty', options: { singleLine: true, colorize: true } }
              : undefined,
        },
      }),
    }),
    ThrottlerModule.forRootAsync({
      imports: [AppConfigModule],
      inject: [AppConfigService],
      useFactory: (config: AppConfigService) => [{ ttl: config.env.throttleTtlMs, limit: config.env.throttleLimit }],
    }),
    HealthModule,
    ...(env.role === 'worker' || env.role === 'all' ? [WorkerModule] : []),
    ...(env.role === 'api' || env.role === 'all' ? [ApiModule] : []),
  ],
  providers: [
    { provide: APP_FILTER, useClass: GlobalExceptionFilter },
    { provide: APP_GUARD, useClass: ThrottlerGuard },
    { provide: APP_INTERCEPTOR, useClass: LoggingInterceptor },
  ],
})
export class AppModule {}
