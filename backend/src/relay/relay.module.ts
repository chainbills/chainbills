// ──────────────────────────────────────────────────────────────────────────────
// Chainbills Backend — Relay module
//
// Provides RelayProcessor. Imported by WorkerModule.
// ──────────────────────────────────────────────────────────────────────────────

import { Module } from '@nestjs/common';
import { AppConfigModule } from '../config/config.module';
import { ChainsModule } from '../chains/chains.module';
import { PrismaModule } from '../prisma/prisma.module';
import { RelayProcessor } from './relay.processor';

/** Provides RelayProcessor to WorkerModule. */
@Module({
  imports: [PrismaModule, ChainsModule, AppConfigModule],
  providers: [RelayProcessor],
  exports: [RelayProcessor],
})
export class RelayModule {}
