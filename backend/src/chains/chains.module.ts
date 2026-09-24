// ──────────────────────────────────────────────────────────────────────────────
// Chainbills Backend — Chains module
//
// Global so every feature module (indexer, relay, api) can inject
// ChainsService without importing this module individually. Still imports
// AppConfigModule explicitly: Nest requires a declared `imports` edge for a
// provider dependency even between two @Global modules — globality only
// controls who can inject a module's exports, not what that module itself
// can resolve.
// ──────────────────────────────────────────────────────────────────────────────

import { Global, Module } from '@nestjs/common';
import { AppConfigModule } from '../config/config.module';
import { ChainsService } from './chains.service';

@Global()
@Module({
  imports: [AppConfigModule],
  providers: [ChainsService],
  exports: [ChainsService],
})
export class ChainsModule {}
