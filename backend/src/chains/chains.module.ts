// ──────────────────────────────────────────────────────────────────────────────
// Chainbills Backend — Chains module
//
// Global so every feature module (indexer, relay, api) can inject
// ChainsService without importing this module individually.
// ──────────────────────────────────────────────────────────────────────────────

import { Global, Module } from '@nestjs/common';
import { ChainsService } from './chains.service';

@Global()
@Module({
  providers: [ChainsService],
  exports: [ChainsService],
})
export class ChainsModule {}
