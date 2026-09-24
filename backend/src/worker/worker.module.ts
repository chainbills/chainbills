// ──────────────────────────────────────────────────────────────────────────────
// Chainbills Backend — Worker module (placeholder)
//
// Imported by AppModule only when ROLE is "worker" or "all" (SPEC.md §2.1).
// Intentionally empty in phase 1 — indexers, the relay processor, the
// outbox processor and worker housekeeping loops are added in phases
// 2a/3a/3b. Its only job right now is to exist so the role gate in
// app.module.ts has something real to import.
// ──────────────────────────────────────────────────────────────────────────────

import { Module } from '@nestjs/common';

@Module({})
export class WorkerModule {}
