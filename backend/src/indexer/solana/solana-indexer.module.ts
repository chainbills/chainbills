// ──────────────────────────────────────────────────────────────────────────────
// Chainbills Backend — Solana indexer module
//
// Provides SolanaIndexer. Imported by WorkerModule.
// ──────────────────────────────────────────────────────────────────────────────

import { Module } from '@nestjs/common';
import { AppConfigModule } from '../../config/config.module';
import { ChainsModule } from '../../chains/chains.module';
import { PrismaModule } from '../../prisma/prisma.module';
import { SolanaIndexer } from './solana.indexer';

/** Provides SolanaIndexer to WorkerModule. */
@Module({
  imports: [PrismaModule, ChainsModule, AppConfigModule],
  providers: [SolanaIndexer],
  exports: [SolanaIndexer],
})
export class SolanaIndexerModule {}
