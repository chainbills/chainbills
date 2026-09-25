// ──────────────────────────────────────────────────────────────────────────────
// Chainbills Backend — Health module
//
// Registered for every role (SPEC.md §2.1) — imported unconditionally by
// AppModule, unlike WorkerModule/ApiModule.
// ──────────────────────────────────────────────────────────────────────────────

import { Module } from '@nestjs/common';
import { AppConfigModule } from '../config/config.module';
import { ChainsModule } from '../chains/chains.module';
import { PrismaModule } from '../prisma/prisma.module';
import { HealthController } from './health.controller';

/** Registers HealthController for all roles; always imported by AppModule regardless of ROLE. */
@Module({
  imports: [PrismaModule, AppConfigModule, ChainsModule],
  controllers: [HealthController],
})
export class HealthModule {}
