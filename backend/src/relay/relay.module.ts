// ──────────────────────────────────────────────────────────────────────────────
// Chainbills Backend — Relay module
//
// Provides RelayProcessor. Imported by WorkerModule.
// ──────────────────────────────────────────────────────────────────────────────

import { Module } from '@nestjs/common';
import { ChainsModule } from '../chains/chains.module';
import { PrismaModule } from '../prisma/prisma.module';
import { RelayProcessor } from './relay.processor';

@Module({
  imports: [PrismaModule, ChainsModule],
  providers: [RelayProcessor],
  exports: [RelayProcessor],
})
export class RelayModule {}
