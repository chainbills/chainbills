// ──────────────────────────────────────────────────────────────────────────────
// Chainbills Backend — API module
//
// Imported by AppModule only when ROLE is "api" or "all" (SPEC.md §2.1).
// Registers AuthModule (phase 2b). Later phases add UsersModule (3b) and the
// public read controllers (4).
// ──────────────────────────────────────────────────────────────────────────────

import { Module } from '@nestjs/common';
import { AuthModule } from '../auth/auth.module';

@Module({
  imports: [AuthModule],
})
export class ApiModule {}
