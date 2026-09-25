// ──────────────────────────────────────────────────────────────────────────────
// Chainbills Backend — Prisma service
//
// Thin lifecycle wrapper around PrismaClient: connects during Nest's module
// init and disconnects on shutdown, so a graceful SIGTERM (SPEC.md §2.3)
// never leaves a dangling connection. Every module that touches the database
// injects this instead of constructing its own PrismaClient.
// ──────────────────────────────────────────────────────────────────────────────

import { Injectable, Logger, OnModuleDestroy, OnModuleInit } from '@nestjs/common';
import { PrismaPg } from '@prisma/adapter-pg';
import { PrismaClient } from '@prisma/client';
import { AppConfigService } from '../config/app-config.service';

/** NestJS lifecycle wrapper around PrismaClient; connects on module init and disconnects on shutdown. */
@Injectable()
export class PrismaService extends PrismaClient implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(PrismaService.name);

  // Prisma 7 requires either a driver adapter or Accelerate — schema-level `url`
  // is gone. The `pg` adapter routes queries through the already-installed pg
  // driver, using the validated DATABASE_URL from AppConfigService.
  constructor(config: AppConfigService) {
    super({ adapter: new PrismaPg({ connectionString: config.env.databaseUrl }) });
  }

  /**
   * Connects eagerly at module init rather than lazily on first query, so a
   * misconfigured DATABASE_URL fails fast during boot instead of on the
   * first request or indexing tick.
   */
  async onModuleInit(): Promise<void> {
    await this.$connect();
    this.logger.log('connected to Postgres');
  }

  /** Releases the pool cleanly so a SIGTERM shutdown does not leak connections. */
  async onModuleDestroy(): Promise<void> {
    await this.$disconnect();
  }
}
