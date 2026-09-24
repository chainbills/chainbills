// ──────────────────────────────────────────────────────────────────────────────
// Chainbills Backend — Health module
//
// Registered for every role (SPEC.md §2.1) — imported unconditionally by
// AppModule, unlike WorkerModule/ApiModule.
// ──────────────────────────────────────────────────────────────────────────────

import { Module } from '@nestjs/common';
import { AppConfigModule } from '../config/config.module';
import { PrismaModule } from '../prisma/prisma.module';
import { HealthController } from './health.controller';

@Module({
  imports: [PrismaModule, AppConfigModule],
  controllers: [HealthController],
})
export class HealthModule {}
