// ──────────────────────────────────────────────────────────────────────────────
// Chainbills Backend — Prisma module
//
// Global so every feature module can inject PrismaService without importing
// this module individually.
// ──────────────────────────────────────────────────────────────────────────────

import { Global, Module } from '@nestjs/common';
import { PrismaService } from './prisma.service';

/** Global module; makes PrismaService available to every feature module without explicit re-import. */
@Global()
@Module({
  providers: [PrismaService],
  exports: [PrismaService],
})
export class PrismaModule {}
