// ──────────────────────────────────────────────────────────────────────────────
// Chainbills Backend — EVM indexer module
//
// Provides EvmIndexer. Imported by WorkerModule.
// ──────────────────────────────────────────────────────────────────────────────

import { Module } from '@nestjs/common';
import { AppConfigModule } from '../../config/config.module';
import { ChainsModule } from '../../chains/chains.module';
import { PrismaModule } from '../../prisma/prisma.module';
import { EvmIndexer } from './evm.indexer';

/** Provides EvmIndexer to WorkerModule. */
@Module({
  imports: [PrismaModule, ChainsModule, AppConfigModule],
  providers: [EvmIndexer],
  exports: [EvmIndexer],
})
export class EvmIndexerModule {}
