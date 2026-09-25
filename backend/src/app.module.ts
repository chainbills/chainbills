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
import { APP_FILTER, APP_GUARD } from '@nestjs/core';
import { ThrottlerGuard, ThrottlerModule } from '@nestjs/throttler';
import { LoggerModule } from 'nestjs-pino';
import { ApiModule } from './api/api.module';
import { ChainsModule } from './chains/chains.module';
import { GlobalExceptionFilter } from './common/filters/global-exception.filter';
import { AppConfigService } from './config/app-config.service';
import { AppConfigModule } from './config/config.module';
import { loadEnv } from './config/env.schema';
import { HealthModule } from './health/health.module';
import { PrismaModule } from './prisma/prisma.module';
import { WorkerModule } from './worker/worker.module';

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
          autoLogging: true,
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
  ],
})
export class AppModule {}
