// ──────────────────────────────────────────────────────────────────────────────
// Chainbills Backend — API module (placeholder)
//
// Imported by AppModule only when ROLE is "api" or "all" (SPEC.md §2.1).
// Intentionally empty in phase 1 — auth (2b), users/notifications (3b) and
// the public read API (4) register their controllers here in later phases.
// `HealthController` lives outside this module and is registered for every
// role, since even a worker-only deployment answers `/health`.
// ──────────────────────────────────────────────────────────────────────────────

import { Module } from '@nestjs/common';

@Module({})
export class ApiModule {}
